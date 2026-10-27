const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { inspectPe, zipDirectory, zipEntryBytes, verifyPortableZip, crc32 } = require('./windows-artifacts.cjs');

function executable(architecture = 'x64') {
  const bytes = Buffer.alloc(1024), pe = 128, optional = pe + 24;
  const x86 = architecture === 'x86', size = x86 ? 224 : 240;
  bytes.write('MZ'); bytes.writeUInt32LE(pe, 0x3c); bytes.write('PE\0\0', pe, 'binary');
  bytes.writeUInt16LE({ x86: 0x14c, x64: 0x8664, arm64: 0xaa64 }[architecture], pe + 4);
  bytes.writeUInt16LE(1, pe + 6); bytes.writeUInt16LE(size, pe + 20); bytes.writeUInt16LE(2, pe + 22);
  bytes.writeUInt16LE(x86 ? 0x10b : 0x20b, optional); bytes.writeUInt32LE(0x1000, optional + 16);
  bytes.writeUInt32LE(0x2000, optional + 56); bytes.writeUInt32LE(512, optional + 60); bytes.writeUInt16LE(2, optional + 68);
  const section = optional + size;
  bytes.write('.text', section); bytes.writeUInt32LE(0x100, section + 8); bytes.writeUInt32LE(0x1000, section + 12);
  bytes.writeUInt32LE(512, section + 16); bytes.writeUInt32LE(512, section + 20); bytes.writeUInt32LE(0x60000020, section + 36);
  bytes[512] = 0xc3;
  return bytes;
}
function zip(files, compressed = true) {
  const parts = [], entries = []; let offset = 0;
  for (const [name, input] of Object.entries(files)) {
    const filename = Buffer.from(name), content = Buffer.from(input), packed = compressed ? zlib.deflateRawSync(content) : content;
    const local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(compressed ? 8 : 0, 8);
    local.writeUInt32LE(crc32(content), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(compressed ? 8 : 0, 10);
    central.writeUInt32LE(crc32(content), 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    parts.push(local, filename, packed); entries.push(central, filename); offset += local.length + filename.length + packed.length;
  }
  const directory = Buffer.concat(entries), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length / 2, 8); end.writeUInt16LE(entries.length / 2, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mole-win-artifact-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const unpacked = path.join(root, 'win-unpacked');
  fs.mkdirSync(path.join(unpacked, 'resources'), { recursive: true });
  const files = { '拉姆.exe': executable(), 'resources/app.asar': Buffer.from('verified app payload'), 'resources/app-update.yml': Buffer.from('provider: github\n') };
  for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(unpacked, name), bytes);
  const archive = path.join(root, 'portable.zip');
  const write = next => fs.writeFileSync(archive, zip(next)); write(files);
  return { root, unpacked, files, archive, write };
}

test('PE validation distinguishes x64 application, x86 installer stub and incompatible architecture', () => {
  assert.equal(inspectPe(executable()).architecture, 'x64');
  assert.equal(inspectPe(executable('x86'), { architectures: ['x86', 'x64'] }).architecture, 'x86');
  assert.throws(() => inspectPe(executable('x86')), /expected x64, got x86/);
  assert.throws(() => inspectPe(executable('arm64')), /got arm64/);
});
test('PE validation rejects HTML downloads, DOS-only files, invalid image sections and truncated executables', () => {
  assert.throws(() => inspectPe(Buffer.from('<html>download failed</html>')), /truncated/);
  const dos = executable(); dos.fill(0, 128, 132); assert.throws(() => inspectPe(dos), /PE signature/);
  const badOffset = executable(); badOffset.writeUInt32LE(0x7fffffff, 0x3c); assert.throws(() => inspectPe(badOffset), /bounds/);
  assert.throws(() => inspectPe(executable().subarray(0, 800)), /section 0.*truncated/);
  const badEntry = executable(); badEntry.writeUInt32LE(0x3000, 128 + 24 + 16); assert.throws(() => inspectPe(badEntry), /entry point/);
});
test('PE validation rejects truncated certificate data without altering signature/checksum expectations', () => {
  const bytes = executable(), optional = 128 + 24;
  bytes.writeUInt32LE(16, optional + 108); bytes.writeUInt32LE(1000, optional + 112 + 32); bytes.writeUInt32LE(100, optional + 112 + 36);
  assert.throws(() => inspectPe(bytes), /certificate.*truncated/);
});
test('ZIP validates stored and deflated bytes with CRC and local/central agreement', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  for (const compressed of [false, true]) {
    const bytes = zip({ '拉姆.exe': executable() }, compressed), [entry] = zipDirectory(bytes);
    assert.deepEqual(zipEntryBytes(bytes, entry), executable());
  }
  const bytes = zip({ 'data.bin': Buffer.from('hello') }, false), [entry] = zipDirectory(bytes);
  bytes[entry.data] ^= 1; assert.throws(() => zipEntryBytes(bytes, entry), /CRC mismatch/);
});
test('ZIP rejects truncated archives, inconsistent headers and unsafe entry paths', () => {
  const bytes = zip({ 'data.bin': Buffer.from('hello') });
  assert.throws(() => zipDirectory(bytes.subarray(0, bytes.length - 1)), /truncated/);
  const mismatch = Buffer.from(bytes); mismatch.writeUInt16LE(0, 6); assert.throws(() => zipDirectory(mismatch), /inconsistent local/);
  for (const name of ['../app.exe', '/app.exe', 'C:/app.exe', 'resources\\app.asar']) assert.throws(() => zipDirectory(zip({ [name]: 'invalid' })), /invalid entry path/);
});
test('portable archive must match every file in the exact application tested by the runner', async t => {
  const f = fixture(t);
  assert.equal((await verifyPortableZip(f.archive, f.unpacked, '拉姆.exe')).files, 3);
  f.write({ ...f.files, 'resources/app.asar': Buffer.from('another version') });
  await assert.rejects(verifyPortableZip(f.archive, f.unpacked, '拉姆.exe'), /differs from the tested/);
  const missing = { ...f.files }; delete missing['resources/app-update.yml']; f.write(missing);
  await assert.rejects(verifyPortableZip(f.archive, f.unpacked, '拉姆.exe'), /file list differs/);
});
test('portable archive cannot hide a wrong-architecture executable even when unpacked bytes match', async t => {
  const f = fixture(t); f.files['拉姆.exe'] = executable('arm64');
  fs.writeFileSync(path.join(f.unpacked, '拉姆.exe'), f.files['拉姆.exe']); f.write(f.files);
  await assert.rejects(verifyPortableZip(f.archive, f.unpacked, '拉姆.exe'), /got arm64/);
});

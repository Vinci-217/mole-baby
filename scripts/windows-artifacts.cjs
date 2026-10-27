/** Validate release bytes before publishing Windows downloads. Built-ins only. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const MACHINES = { x86: 0x014c, x64: 0x8664, arm64: 0xaa64 };
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = CRC_TABLE[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function check(condition, message) { if (!condition) throw new Error(message); }
function range(bytes, offset, size, label) {
  check(Number.isSafeInteger(offset) && Number.isSafeInteger(size) && offset >= 0 && size >= 0 && offset + size <= bytes.length, `${label}: truncated or invalid bounds`);
}

function inspectPe(bytes, { architectures = ['x64'], label = 'Windows executable' } = {}) {
  range(bytes, 0, 64, label);
  check(bytes.readUInt16LE(0) === 0x5a4d, `${label}: missing DOS/PE header (not a Windows executable)`);
  const pe = bytes.readUInt32LE(0x3c);
  check(pe >= 64, `${label}: invalid PE header offset`);
  range(bytes, pe, 24, label);
  check(bytes.readUInt32LE(pe) === 0x00004550, `${label}: missing PE signature`);
  const machine = bytes.readUInt16LE(pe + 4), sectionCount = bytes.readUInt16LE(pe + 6);
  const architecture = Object.keys(MACHINES).find(name => MACHINES[name] === machine);
  check(architecture && architectures.includes(architecture), `${label}: expected ${architectures.join('/')}, got ${architecture ?? `machine 0x${machine.toString(16)}`}`);
  const characteristics = bytes.readUInt16LE(pe + 22);
  check((characteristics & 0x0002) !== 0 && (characteristics & 0x2000) === 0, `${label}: must be an executable, not a DLL/object`);
  check(sectionCount > 0 && sectionCount <= 96, `${label}: invalid PE section count`);
  const optional = pe + 24, optionalSize = bytes.readUInt16LE(pe + 20);
  range(bytes, optional, optionalSize, label);
  const pe64 = architecture !== 'x86', minimum = pe64 ? 112 : 96;
  check(optionalSize >= minimum && bytes.readUInt16LE(optional) === (pe64 ? 0x20b : 0x10b), `${label}: invalid optional header for ${architecture}`);
  const table = optional + optionalSize;
  range(bytes, table, sectionCount * 40, label);
  const headerSize = bytes.readUInt32LE(optional + 60), imageSize = bytes.readUInt32LE(optional + 56);
  check(headerSize >= table + sectionCount * 40 && headerSize <= bytes.length, `${label}: incomplete PE headers`);
  check(bytes.readUInt16LE(optional + 68) === 2, `${label}: expected a Windows GUI executable`);
  const entry = bytes.readUInt32LE(optional + 16);
  let executableEntry = false;
  for (let index = 0; index < sectionCount; index++) {
    const offset = table + index * 40;
    const virtualSize = bytes.readUInt32LE(offset + 8), address = bytes.readUInt32LE(offset + 12);
    const rawSize = bytes.readUInt32LE(offset + 16), rawOffset = bytes.readUInt32LE(offset + 20);
    if (rawSize) {
      check(rawOffset >= headerSize, `${label}: section overlaps PE headers`);
      range(bytes, rawOffset, rawSize, `${label} section ${index}`);
    }
    check(address + Math.max(virtualSize, rawSize) <= imageSize, `${label}: section exceeds declared image size`);
    if (entry >= address && entry < address + Math.max(virtualSize, rawSize) && (bytes.readUInt32LE(offset + 36) & 0x20000000)) executableEntry = true;
  }
  check(executableEntry, `${label}: entry point is outside executable sections`);
  const directoryCount = bytes.readUInt32LE(optional + minimum - 4);
  if (directoryCount > 4) {
    range(bytes, optional + minimum, 5 * 8, label);
    check(optionalSize >= minimum + 5 * 8, `${label}: truncated PE data directories`);
    const certificate = optional + minimum + 4 * 8;
    const offset = bytes.readUInt32LE(certificate), size = bytes.readUInt32LE(certificate + 4);
    if (size) range(bytes, offset, size, `${label} certificate`);
  }
  return { architecture, sectionCount, bytes: bytes.length };
}

function zipDirectory(bytes) {
  let end = -1;
  for (let index = bytes.length - 22, minimum = Math.max(0, bytes.length - 22 - 65535); index >= minimum; index--) {
    if (bytes.readUInt32LE(index) === 0x06054b50 && index + 22 + bytes.readUInt16LE(index + 20) === bytes.length) { end = index; break; }
  }
  check(end >= 0, 'ZIP: missing/truncated central directory');
  check(bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0, 'ZIP: split archives are not supported');
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), offset = bytes.readUInt32LE(end + 16);
  check(count > 0 && count !== 0xffff && offset !== 0xffffffff && size !== 0xffffffff, 'ZIP: empty or ZIP64 archive is not a supported Windows package');
  check(count === bytes.readUInt16LE(end + 8), 'ZIP: inconsistent entry counts');
  range(bytes, offset, size, 'ZIP central directory');
  check(offset + size === end, 'ZIP: central directory does not match archive length');
  const entries = [], names = new Set();
  let cursor = offset, total = 0;
  for (let index = 0; index < count; index++) {
    range(bytes, cursor, 46, 'ZIP entry');
    check(bytes.readUInt32LE(cursor) === 0x02014b50, 'ZIP: invalid central entry signature');
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const checksum = bytes.readUInt32LE(cursor + 16), packed = bytes.readUInt32LE(cursor + 20), unpacked = bytes.readUInt32LE(cursor + 24);
    const nameSize = bytes.readUInt16LE(cursor + 28), extraSize = bytes.readUInt16LE(cursor + 30), commentSize = bytes.readUInt16LE(cursor + 32);
    range(bytes, cursor + 46, nameSize + extraSize + commentSize, 'ZIP entry name');
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameSize).toString('utf8');
    check(name && !name.includes('\\') && !name.includes('\0') && !name.includes('\ufffd') && !name.startsWith('/') && !/^[A-Za-z]:/.test(name) && !name.split('/').some(part => part === '..' || part === '.'), `ZIP: invalid entry path ${name}`);
    check(!names.has(name), `ZIP: duplicate entry ${name}`); names.add(name);
    check((flags & 1) === 0 && (method === 0 || method === 8), `ZIP ${name}: unsupported encryption/compression`);
    check(bytes.readUInt16LE(cursor + 34) === 0, `ZIP ${name}: split entry`);
    check((bytes.readUInt32LE(cursor + 38) >>> 16 & 0xf000) !== 0xa000, `ZIP ${name}: symlink is not a Windows payload file`);
    check(unpacked <= 512 * 1024 * 1024 && (total += unpacked) <= 2 * 1024 * 1024 * 1024, 'ZIP: unexpected payload size');
    const local = bytes.readUInt32LE(cursor + 42);
    range(bytes, local, 30, `ZIP ${name} local header`);
    check(bytes.readUInt32LE(local) === 0x04034b50, `ZIP ${name}: missing local header`);
    check(bytes.readUInt16LE(local + 6) === flags && bytes.readUInt16LE(local + 8) === method, `ZIP ${name}: inconsistent local header`);
    const localNameSize = bytes.readUInt16LE(local + 26), localExtra = bytes.readUInt16LE(local + 28), data = local + 30 + localNameSize + localExtra;
    range(bytes, local + 30, localNameSize + localExtra, `ZIP ${name} local name`);
    check(bytes.subarray(local + 30, local + 30 + localNameSize).equals(bytes.subarray(cursor + 46, cursor + 46 + nameSize)), `ZIP ${name}: local filename mismatch`);
    range(bytes, data, packed, `ZIP ${name} payload`);
    check(data + packed <= offset, `ZIP ${name}: payload overlaps central directory`);
    if (!(flags & 8)) check(bytes.readUInt32LE(local + 14) === checksum && bytes.readUInt32LE(local + 18) === packed && bytes.readUInt32LE(local + 22) === unpacked, `ZIP ${name}: local sizes/checksum disagree`);
    entries.push({ name, method, checksum, packed, unpacked, data, local });
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  check(cursor === offset + size, 'ZIP: central directory size/count mismatch');
  const regions = [...entries].sort((a, b) => a.local - b.local);
  for (let index = 1; index < regions.length; index++) check(regions[index].local >= regions[index - 1].data + regions[index - 1].packed, 'ZIP: overlapping entries');
  return entries;
}
function zipEntryBytes(bytes, entry) {
  const packed = bytes.subarray(entry.data, entry.data + entry.packed);
  const result = entry.method === 0 ? packed : zlib.inflateRawSync(packed, { maxOutputLength: Math.max(1, entry.unpacked) });
  check(result.length === entry.unpacked && crc32(result) === entry.checksum, `ZIP ${entry.name}: truncated/corrupt file or CRC mismatch`);
  return result;
}
async function fileDigest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function listFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name, file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(file, name + '/');
    check(entry.isFile(), `Windows payload contains a non-regular file: ${name}`);
    return [name];
  });
}
async function verifyPortableZip(filename, unpackedDirectory, executableName, architectures = ['x64']) {
  const bytes = fs.readFileSync(filename), entries = zipDirectory(bytes);
  const files = entries.filter(entry => !entry.name.endsWith('/'));
  const expected = listFiles(unpackedDirectory).sort();
  const actual=files.map(entry=>entry.name).sort();
  check(JSON.stringify(actual) === JSON.stringify(expected), `ZIP: file list differs from the tested unpacked application; missing=${JSON.stringify(expected.filter(name=>!actual.includes(name)))}; unexpected=${JSON.stringify(actual.filter(name=>!expected.includes(name)))}`);
  check(expected.includes(executableName) && expected.includes('resources/app.asar') && expected.includes('resources/app-update.yml'), 'ZIP: required application/update payload is missing');
  for (const entry of entries) {
    const content = zipEntryBytes(bytes, entry);
    if (entry.name.endsWith('/')) { check(content.length === 0, 'ZIP: directory entry has file content'); continue; }
    if (entry.name === executableName) inspectPe(content, { architectures, label: `ZIP ${executableName}` });
    const digest = crypto.createHash('sha256').update(content).digest('hex');
    check(digest === await fileDigest(path.join(unpackedDirectory, ...entry.name.split('/'))), `ZIP ${entry.name}: differs from the tested unpacked file`);
  }
  return { files: files.length, bytes: bytes.length };
}
module.exports = { inspectPe, zipDirectory, zipEntryBytes, verifyPortableZip, crc32 };

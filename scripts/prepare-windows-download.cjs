#!/usr/bin/env node
'use strict';
// Short, individually verified HTTP downloads avoid proxy limits on one long
// installer transfer. The parts reassemble the original bytes without repacking.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { verifyNsisInstaller } = require('./windows-artifacts.cjs');
const root = path.resolve(__dirname, '..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function prepareWindowsDownload({ installer, output, chunkBytes = 8 * 1024 * 1024 }) {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1024 || chunkBytes > 16 * 1024 * 1024) throw Error('Invalid download chunk size');
  const nsis = await verifyNsisInstaller(installer);
  fs.mkdirSync(output, { recursive: true });
  const chunks = [], whole = crypto.createHash('sha256');
  let offset = 0;
  for await (const bytes of fs.createReadStream(installer, { highWaterMark: chunkBytes })) {
    const digest = sha256(bytes), file = `parts/${digest}.bin`;
    const target = path.join(output, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Repeated preparation does not rewrite verified deliverable parts.
    if (!fs.existsSync(target) || sha256(fs.readFileSync(target)) !== digest) {
      fs.writeFileSync(target + '.tmp', bytes); fs.renameSync(target + '.tmp', target);
    }
    chunks.push({ file, offset, bytes: bytes.length, sha256: digest });
    whole.update(bytes); offset += bytes.length;
  }
  if (offset !== nsis.bytes) throw Error('Installer changed during download preparation');
  const manifest = { schema: 1, filename: path.basename(installer), bytes: offset, sha256: whole.digest('hex'), chunkBytes, chunks, nsis };
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const name of ['index.html', 'download.mjs', 'download-worker.js']) fs.copyFileSync(path.join(__dirname, 'windows-download', name), path.join(output, name));
  return manifest;
}
async function main() {
  const directory = path.join(root, 'release/windows-preview');
  const manifest = await prepareWindowsDownload({
    installer: path.join(directory, `mole-baby-${require('../package.json').version}-windows-test-Setup.exe`),
    output: path.join(directory, 'download'),
  });
  const link = path.join(root, 'dist/downloads/windows');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  if (!fs.existsSync(link)) fs.symlinkSync(path.join(directory, 'download'), link, 'dir');
  else if (fs.realpathSync(link) !== fs.realpathSync(path.join(directory, 'download'))) throw Error('Existing download path belongs to another delivery');
  console.log(JSON.stringify({ filename: manifest.filename, bytes: manifest.bytes, sha256: manifest.sha256, chunks: manifest.chunks.length, nsis: manifest.nsis, urlPath: '/downloads/windows/' }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { prepareWindowsDownload };

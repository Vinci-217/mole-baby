const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const { verifyOfflineAssets } = require('./verify-offline-assets.cjs');
const { verifyMotionResources } = require('./packaged-motion-assets.cjs');

function verifyRendererPackage(archive, resources) {
  const index = JSON.parse(asar.extractFile(archive, 'dist/offline-resources.json'));
  assert.equal(index.revision, resources.revision, 'Wrong renderer was bundled');
  assert(!asar.extractFile(archive, 'dist/index.html').toString().includes('rel="manifest"'), 'PWA renderer entered the desktop package');
  assert(!asar.listPackage(archive).some(file => /[\\/]dist[\\/](?:sw\.js|manifest\.webmanifest)$/.test(file)), 'Live web artifacts entered the desktop package');
  for (const entry of index.files) {
    const data = asar.extractFile(archive, path.normalize('dist/' + entry.path));
    assert.equal(data.length, entry.bytes, entry.path);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), entry.sha256, entry.path);
  }
}

module.exports = async function afterPack(context) {
  const output = path.dirname(context.appOutDir), renderer = path.join(output, 'renderer');
  const resources = verifyOfflineAssets(renderer), archive = path.join(context.appOutDir, 'resources/app.asar');
  verifyRendererPackage(archive, resources);
  const textures = await verifyMotionResources(archive, renderer);
  fs.writeFileSync(path.join(output, 'packed-assets.json'), JSON.stringify({ resources, textures }, null, 2) + '\n');
  fs.rmSync(renderer, { recursive: true });
  console.log('PASS: every installed resource verified; temporary native renderer removed');
};

module.exports.verifyRendererPackage = verifyRendererPackage;

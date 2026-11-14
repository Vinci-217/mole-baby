#!/usr/bin/env node
/** Explicit build-cache allowlist; never prune assets, dependencies or saves. */
const fs = require('node:fs');
const path = require('node:path');
const { findPreviewFrames, trackedFiles } = require('./clean-preview-frames.cjs');

function measure(file) {
  const info = fs.lstatSync(file);
  if (info.isSymbolicLink()) return 0;
  if (info.isDirectory()) return fs.readdirSync(file).reduce((sum, name) => sum + measure(path.join(file, name)), 0);
  return info.size;
}

function planCleanup(root) {
  const tracked = trackedFiles(root), candidates = findPreviewFrames(root, tracked);
  const add = (file, reason) => {
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) return;
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (tracked.some(name => name === relative || name.startsWith(relative + '/'))) return;
    candidates.push({ path: file, reason, bytes: measure(file) });
  };
  for (const entry of fs.readdirSync(root, { withFileTypes: true }))
    if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) add(path.join(root, entry.name), 'regenerable TypeScript build metadata');
  for (const name of ['.vite', '.vite-temp']) add(path.join(root, 'node_modules', name), 'regenerable Vite cache');
  function pythonCaches(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) if (entry.isDirectory()) {
      const child = path.join(folder, entry.name);
      if (entry.name === '__pycache__') add(child, 'regenerable Python bytecode');
      else pythonCaches(child);
    }
  }
  pythonCaches(path.join(root, 'scripts'));
  const empty = path.join(root, 'github-artifact');
  if (fs.existsSync(empty) && fs.lstatSync(empty).isDirectory() && !fs.readdirSync(empty).length) add(empty, 'empty legacy artifact directory');
  return candidates;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..'), applied = process.argv.includes('--apply'), entries = planCleanup(root);
  if (applied) for (const entry of entries) fs.rmSync(entry.path, { recursive: true });
  const report = { checkedAt: new Date().toISOString(), applied, filesOrFolders: entries.length,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    entries: entries.map(entry => ({ ...entry, path: path.relative(root, entry.path) })) };
  if (applied) fs.writeFileSync(path.join(root, 'artifacts/workspace-cleanup.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}

module.exports = { planCleanup };

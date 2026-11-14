/** Disposable recording frames only; tracked art and QA profiles survive. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
}

function findPreviewFrames(root, tracked = trackedFiles(root)) {
  const result = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || /profile|backup|save|wine/i.test(entry.name)) continue;
      const folder = path.join(directory, entry.name);
      if (!entry.name.endsWith('-frames')) { visit(folder); continue; }
      const files = fs.readdirSync(folder, { withFileTypes: true });
      if (!files.every(file => file.isFile() && /^\d+\.png$/.test(file.name))) continue;
      const relative = path.relative(root, folder).split(path.sep).join('/');
      if (tracked.some(file => file.startsWith(relative + '/'))) continue;
      result.push({ path: folder, reason: 'disposable numeric recording frames', bytes: files.reduce((sum, file) => sum + fs.statSync(path.join(folder, file.name)).size, 0) });
    }
  }
  visit(path.join(root, 'artifacts'));
  return result;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..'), apply = process.argv.includes('--apply');
  const folders = findPreviewFrames(root);
  if (apply) for (const folder of folders) fs.rmSync(folder.path, { recursive: true });
  const bytes = folders.reduce((sum, folder) => sum + folder.bytes, 0);
  console.log(JSON.stringify({ applied: apply, folders: folders.length, bytes, MiB: Math.round(bytes / 1048576 * 10) / 10 }));
}

module.exports = { findPreviewFrames, trackedFiles };

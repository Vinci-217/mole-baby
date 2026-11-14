const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { planCleanup } = require('./clean-workspace.cjs');

test('cleanup protects tracked frames, mixed folders, assets, saved profiles and symlink targets', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mole-clean-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  const write = file => { const p = path.join(root, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, 'keep'); };
  for (const file of ['artifacts/old-frames/01.png', 'artifacts/tracked-frames/01.png',
    'artifacts/mixed-frames/save.json', 'artifacts/player-profile/pose-frames/01.png',
    'artifacts/player-profile/save.json', 'public/old-frames/01.png', 'local-assets/raw/source.swf',
    'scripts/__pycache__/generated.pyc', 'scripts/tracked/__pycache__/keep.pyc',
    'tsconfig.app.tsbuildinfo', 'node_modules/.vite/cache.json', 'node_modules/keep/index.js']) write(file);
  execFileSync('git', ['add', '-f', 'artifacts/tracked-frames/01.png', 'scripts/tracked/__pycache__/keep.pyc'], { cwd: root });
  fs.symlinkSync(path.join(root, 'artifacts/player-profile'), path.join(root, 'artifacts/linked-frames'));
  const candidates = planCleanup(root).map(entry => path.relative(root, entry.path).split(path.sep).join('/')).sort();
  assert.deepEqual(candidates, ['artifacts/old-frames', 'node_modules/.vite', 'scripts/__pycache__', 'tsconfig.app.tsbuildinfo']);
  assert(fs.existsSync(path.join(root, 'artifacts/player-profile/save.json')));
});

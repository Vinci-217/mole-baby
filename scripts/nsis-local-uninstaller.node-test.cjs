const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { withLocalNsisReader } = require('./nsis-local-uninstaller.cjs');

test('Linux preview intercepts only its own empty-argument generator and restores the builder', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mole-nsis-reader-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const installer = path.join(folder, 'preview-Setup.exe');
  fs.writeFileSync(installer, 'generator');
  const delegated = [], read = [], verified = [];
  class Vm { async exec(...args) { delegated.push(args); return 'delegated'; } }
  const original = Vm.prototype.exec;
  await withLocalNsisReader({ installer, platform: 'linux', Vm,
    reader: async (...args) => read.push(args), verify: file => verified.push(file),
    run: async () => {
      const vm = new Vm();
      await vm.exec(installer, []);
      assert.equal(await vm.exec(path.join(folder, 'other.exe'), []), 'delegated');
      assert.equal(await vm.exec(installer, ['/S']), 'delegated');
    },
  });
  assert.deepEqual(read, [[installer, path.join(folder, 'preview-Setup.__uninstaller.exe')]]);
  assert.deepEqual(verified, [read[0][1]]);
  assert.equal(delegated.length, 2);
  assert.equal(Vm.prototype.exec, original);
  await assert.rejects(withLocalNsisReader({ installer, platform: 'linux', Vm,
    reader: async () => { throw Error('invalid NSIS data'); }, verify: () => {}, run: () => new Vm().exec(installer, []),
  }), /invalid NSIS data/);
  assert.equal(Vm.prototype.exec, original);
});

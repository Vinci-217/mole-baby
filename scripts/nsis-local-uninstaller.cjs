/** Use electron-builder's own NSIS parser for the Linux preview generator. */
const path = require('node:path');
const fs = require('node:fs');
const { inspectPe } = require('./windows-artifacts.cjs');

async function withLocalNsisReader({ installer, run, platform = process.platform,
  Vm = require('app-builder-lib/out/vm/WineVm').WineVmManager,
  reader = require('app-builder-lib/out/targets/nsis/nsisUtil').UninstallerReader.exec,
  verify = file => inspectPe(fs.readFileSync(file), { architectures: ['x86', 'x64'], label: 'NSIS uninstaller' }),
}) {
  if (platform !== 'linux') return run();
  const expected = path.resolve(installer);
  const output = path.join(path.dirname(expected), path.basename(expected, 'exe') + '__uninstaller.exe');
  const original = Vm.prototype.exec;
  Vm.prototype.exec = async function (file, args, ...options) {
    if (path.resolve(file) !== expected || (args?.length ?? 0) !== 0)
      return original.call(this, file, args, ...options);
    // This is the small BUILD_UNINSTALLER generator, never a final app or
    // installer. The same parser is used by the builder on macOS without Wine.
    if (fs.statSync(expected).size > 2 * 1024 * 1024) throw Error('Refusing to parse a full installer as an uninstaller generator');
    await reader(expected, output);
    verify(output);
    console.log('PASS: built-in NSIS reader produced and verified the uninstaller');
    return '';
  };
  try { return await run(); }
  finally { Vm.prototype.exec = original; }
}

module.exports = { withLocalNsisReader };

const assert = require('node:assert/strict');
const path = require('node:path');
const { verifyApplication, requireFile } = require('./package-smoke.cjs');
const { writeChecksums } = require('./package-checksums.cjs');
const { version, build } = require('../package.json');
async function main() {
  assert.equal(process.platform,'win32','Run on the Windows packaging runner');
  const release=path.resolve(__dirname,'../release');
  const files=[`mole-baby-${version}-x64.zip`,`mole-baby-${version}-Setup.exe`];
  requireFile(path.join(release,files[0]),[0x50,0x4b,0x03,0x04]);
  requireFile(path.join(release,files[1]),[0x4d,0x5a]);
  const executable=path.join(release,'win-unpacked',`${build.productName}.exe`);
  requireFile(executable,[0x4d,0x5a]);
  await verifyApplication({executable,archive:path.join(release,'win-unpacked/resources/app.asar'),screenshot:'windows-smoke.png'});
  require('node:child_process').execFileSync('pwsh',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'windows-installer-smoke.ps1'),'-Installer',path.join(release,files[1])],{stdio:'inherit',timeout:360000});
  await writeChecksums(release,files,'SHA256SUMS.txt');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyApplication, requireFile } = require('./package-smoke.cjs');
const { writeChecksums } = require('./package-checksums.cjs');
const { version, build } = require('../package.json');
const { windowsRuntime } = require('../electron/windows-runtime.cjs');
const { inspectPe, verifyPortableZip } = require('./windows-artifacts.cjs');
async function main() {
  assert.equal(process.platform,'win32','Run on the Windows packaging runner');
  const args=process.argv.slice(2),legacy=args.includes('--legacy');
  const option=(flag,fallback)=>{const index=args.indexOf(flag);if(index<0)return fallback;assert.ok(args[index+1]&&!args[index+1].startsWith('--'),`Missing ${flag}`);return args[index+1]};
  const arch=option('--arch','x64'),runtime=windowsRuntime(legacy?{windowsEdition:'legacy'}:{},arch);
  const release=path.resolve(option('--directory',path.join(__dirname,'../release')));
  const prefix=`mole-baby-${version}${legacy?`-legacy-${arch}`:''}`;
  const files=[`${prefix}${legacy?'':'-x64'}.zip`,`${prefix}-Setup.exe`];
  const unpacked=path.join(release,arch==='ia32'?'win-ia32-unpacked':'win-unpacked');
  const name=`${legacy?runtime.productName:build.productName}.exe`,executable=path.join(unpacked,name);
  const architectures=[arch==='ia32'?'x86':'x64'];
  inspectPe(requireFile(executable),{architectures,label:name});
  inspectPe(requireFile(path.join(release,files[1])),{architectures:['x86','x64'],label:'NSIS installer'});
  const zip=await verifyPortableZip(path.join(release,files[0]),unpacked,name,architectures);
  console.log(`PASS: ${runtime.edition}/${arch} PE architecture and complete ZIP integrity (${zip.files} matching files)`);
  const yaml=require('yaml'),feed=yaml.parse(fs.readFileSync(path.join(unpacked,'resources/app-update.yml'),'utf8'));
  if(legacy){assert.equal(feed.provider,'generic');assert.equal(feed.channel,runtime.channel)}
  await verifyApplication({executable,archive:path.join(unpacked,'resources/app.asar'),screenshot:legacy?`windows-legacy-${arch}-smoke.png`:'windows-smoke.png'});
  require('node:child_process').execFileSync('pwsh',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'windows-installer-smoke.ps1'),'-Installer',path.join(release,files[1]),'-ProductName',runtime.productName,'-InstallDirName',legacy?'mole-baby-legacy':'mole-baby'],{stdio:'inherit',timeout:360000});
  await writeChecksums(release,files,legacy?`SHA256SUMS-legacy-${arch}.txt`:'SHA256SUMS.txt');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

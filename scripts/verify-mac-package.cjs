const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { verifyApplication, requireFile } = require('./package-smoke.cjs');
const { writeChecksums } = require('./package-checksums.cjs');
const { verifyMacTrust } = require('./mac-trust.cjs');
const { version, build } = require('../package.json');
async function main() {
  assert.equal(process.platform,'darwin','Run on the macOS packaging runner');
  const arch=process.argv[2] || process.arch;
  assert.ok(['arm64','x64'].includes(arch));
  assert.equal(process.arch,arch,'Each package must be launched on its native architecture');
  const release=path.resolve(__dirname,'../release');
  const files=[`mole-baby-${version}-mac-${arch}.dmg`,`mole-baby-${version}-mac-${arch}.zip`];
  for(const filename of files) requireFile(path.join(release,filename));
  requireFile(path.join(release,files[1]),[0x50,0x4b,0x03,0x04]);
  execFileSync('/usr/bin/unzip',['-tq',path.join(release,files[1])],{stdio:'pipe'});
  const app=path.join(release,arch==='arm64'?'mac-arm64':'mac',`${build.productName}.app`);
  const contents=path.join(app,'Contents');
  const plist=path.join(contents,'Info.plist');
  const readPlist=key=>execFileSync('/usr/libexec/PlistBuddy',['-c',`Print:${key}`,plist],{encoding:'utf8'}).trim();
  assert.equal(readPlist('CFBundleIdentifier'),build.appId);
  assert.equal(readPlist('CFBundleExecutable'),'拉姆');
  assert.equal(readPlist('CFBundleShortVersionString'),version);
  assert.equal(readPlist('LSUIElement'),'true');
  assert.equal(readPlist('LSMinimumSystemVersion'),'12.0');
  const executable=path.join(contents,'MacOS',readPlist('CFBundleExecutable'));
  assert.equal(execFileSync('/usr/bin/lipo',['-archs',executable],{encoding:'utf8'}).trim(),arch==='x64'?'x86_64':'arm64');
  execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app],{stdio:'pipe'});
  const archive=path.join(contents,'Resources/app.asar');
  // Verify the disk image that users download, including its application payload.
  execFileSync('/usr/bin/hdiutil',['verify',path.join(release,files[0])],{stdio:'pipe'});
  const mount=fs.mkdtempSync(path.join(os.tmpdir(),'mole-dmg-check-'));
  let attached=false;
  try {
    execFileSync('/usr/bin/hdiutil',['attach',path.join(release,files[0]),'-readonly','-nobrowse','-mountpoint',mount],{stdio:'pipe'});attached=true;
    assert.ok(fs.lstatSync(path.join(mount,'Applications')).isSymbolicLink());
    const guide=fs.readFileSync(path.join(mount,'Mac 打开说明.html'),'utf8');assert.ok(guide.includes('x-apple.systempreferences:com.apple.preference.security?General'));assert.ok(guide.includes('仍要打开'));
    const diskArchive=path.join(mount,`${build.productName}.app/Contents/Resources/app.asar`);
    const hash=filename=>createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
    assert.equal(hash(diskArchive),hash(archive));
  } finally {
    if(attached) execFileSync('/usr/bin/hdiutil',['detach',mount],{stdio:'pipe'});
    await fs.promises.rm(mount,{recursive:true,force:true});
  }
  const trust = verifyMacTrust({ app, dmg: path.join(release,files[0]), mode: process.env.MOLE_MAC_DISTRIBUTION || 'local' });
  console.log(`PASS: macOS ${arch} DMG/ZIP, bundle identity, native Mach-O architecture; trust mode=${trust.mode}`);
  await verifyApplication({executable,archive,screenshot:`mac-${arch}-smoke.png`});
  await writeChecksums(release,files,`SHA256SUMS-mac-${arch}.txt`);
  fs.writeFileSync(path.join(release,`macos-trust-${arch}.json`),JSON.stringify({ architecture:arch, sourceSha:process.env.GITHUB_SHA || null, ...trust },null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

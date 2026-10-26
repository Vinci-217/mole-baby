const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { REQUIRED, signingMode, macBuildConfig, removeEmptySigningCredentials } = require('./mac-signing-policy.cjs');
const { verifyMacTrust } = require('./mac-trust.cjs');
const { notarizeDmg: runDmgNotarization } = require('./notarize-mac-dmg.cjs');
const notarizeDmg = options => runDmgNotarization({ log: () => {}, ...options });
const { prepareReleaseNotes,writeReleaseFiles } = require('./prepare-release-notes.cjs');
const credentials = Object.fromEntries(REQUIRED.map(name => [name, `dummy-${name}`]));
const base = { mac: { identity: '-', notarize: false }, dmg: {} };

test('absent GitHub Secrets do not become empty certificate imports', () => {
  const env = { CSC_LINK: '', CSC_KEY_PASSWORD: '  ', APPLE_ID: '', KEEP: 'value' };
  removeEmptySigningCredentials(env);
  assert.deepEqual(env, { KEEP: 'value' });
  const complete = { ...credentials };
  removeEmptySigningCredentials(complete);
  assert.deepEqual(complete, credentials);
});

test('no credentials is explicitly local; incomplete credentials never silently downgrade', () => {
  assert.equal(signingMode({}), 'local');
  for (const name of REQUIRED) {
    const env = { ...credentials }; delete env[name];
    assert.throws(() => signingMode(env), error => error.message.includes(name) && !error.message.includes('dummy-'));
  }
  assert.throws(() => signingMode({ MOLE_MAC_DISTRIBUTION: 'notarized' }), /Missing/);
  assert.throws(() => signingMode({ ...credentials, MOLE_MAC_DISTRIBUTION: 'local' }), /cannot ignore/);
  assert.throws(() => signingMode({ MOLE_MAC_DISTRIBUTION: 'unknown' }), /Invalid/);
});

test('notarized configuration forces Developer ID distribution, hardened runtime and Apple notarization', () => {
  const config = macBuildConfig(base, credentials);
  assert.equal(config.forceCodeSigning, true);
  assert.equal(config.mac.type, 'distribution');
  assert.equal(config.mac.identity, undefined);
  assert.equal(config.mac.notarize, true);
  assert.equal(config.mac.hardenedRuntime, true);
  assert.equal(config.dmg.sign, true);
  assert.equal(base.mac.identity, '-', 'configuration must not mutate local defaults');
  assert.equal(JSON.stringify(config).includes('dummy-'), false, 'credentials stay out of generated config');
  assert.equal(macBuildConfig(base, {}).mac.identity, '-');
});

test('Mac installer includes an accessible pre-launch guide outside the blocked application',()=>{
 const source={...base,dmg:{contents:[{x:150,y:220},{x:430,y:220,type:'link',path:'/Applications'}]}};
 const config=macBuildConfig(source,{});assert.equal(source.dmg.contents.length,2);assert.equal(config.dmg.contents.length,3);
 const guide=config.dmg.contents[2];assert.equal(path.basename(guide.path),'Mac 打开说明.html');assert.ok(fs.readFileSync(guide.path,'utf8').includes('x-apple.systempreferences:'));
});

test('Gatekeeper acceptance requires a real Developer ID, both tickets and both policy assessments', () => {
  const calls=[];
  const input={app:'/test/拉姆.app',dmg:'/test/download.dmg',mode:'notarized',describe:()=> 'Authority=Developer ID Application: Test (DUMMY)\n',run:(...args)=>calls.push(args)};
  const result=verifyMacTrust(input);
  assert.equal(result.gatekeeperAccepted,true);
  assert.equal(calls.length,5);
  assert.equal(calls.filter(call=>call[0].endsWith('spctl')).length,2);
  assert.equal(calls.filter(call=>call[1][0]==='stapler').length,2);
  assert.throws(()=>verifyMacTrust({...input,describe:()=> 'Signature=adhoc\n'}),/Developer ID/);
  for(let failure=0;failure<5;failure++) {
    let index=0;
    assert.throws(()=>verifyMacTrust({...input,run:()=>{if(index++===failure)throw Error('policy rejected');}}),/policy rejected/);
  }
  assert.equal(verifyMacTrust({...input,mode:'local',run:()=>{throw Error('not a trusted build');}}).gatekeeperAccepted,false);
});

test('DMG notarization uses the final architecture-specific image and cannot hide Apple rejection', async t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mole-notary-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const version=require('../package.json').version;
  const filename=path.join(directory,`mole-baby-${version}-mac-arm64.dmg`);fs.writeFileSync(filename,'dummy image');
  let requests=0;
  await notarizeDmg({env:{},platform:'linux',notarize:async()=>requests++});assert.equal(requests,0);
  await notarizeDmg({env:credentials,platform:'darwin',arch:'arm64',directory,notarize:async options=>{requests++;assert.equal(options.appPath,filename);assert.equal(options.teamId,credentials.APPLE_TEAM_ID);assert.equal(options.tool,'notarytool');}});
  assert.equal(requests,1);
  await assert.rejects(notarizeDmg({env:credentials,platform:'darwin',arch:'arm64',directory,notarize:async()=>{throw Error('Apple rejected');}}),/Apple rejected/);
  await assert.rejects(notarizeDmg({env:credentials,platform:'linux'}),/macOS/);
});

test('release notes can claim Apple trust only with matching verified receipts for both architectures', t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mole-trust-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const write=(arch,extra={})=>fs.writeFileSync(path.join(directory,`macos-trust-${arch}.json`),JSON.stringify({architecture:arch,sourceSha:'source',mode:'notarized',developerIdSigned:true,stapled:true,gatekeeperAccepted:true,...extra}));
  write('arm64');write('x64');assert.match(prepareReleaseNotes(directory,'source','notes'),/已通过 Developer ID/);
  for (const change of [{sourceSha:'different'},{gatekeeperAccepted:false},{stapled:false},{developerIdSigned:false},{mode:'local'},{mode:'unknown'}]) {
    write('x64',change);assert.throws(()=>prepareReleaseNotes(directory,'source','notes'));
  }
  for(const arch of ['arm64','x64'])write(arch,{mode:'local',developerIdSigned:false,stapled:false,gatekeeperAccepted:false});
  const localNotes=prepareReleaseNotes(directory,'source','notes');
  assert.match(localNotes,/尚未经过 Apple 公证/);
  for(const instruction of ['mac-arm64.dmg','mac-x64.dmg','Applications','仍要打开','隐私与安全性','退出拉姆']) assert.ok(localNotes.includes(instruction), `Release must include Mac instruction: ${instruction}`);
  const guide=prepareReleaseNotes(directory,'source','change log', '9.8.7');
  assert.ok(guide.startsWith('# 下载与安装 · 拉姆 v9.8.7'));
  for(const file of ['Setup.exe','mac-arm64.dmg','mac-x64.dmg','x64.zip','mac-arm64.zip','mac-x64.zip']){
    const url=`https://github.com/Vinci-217/mole-baby/releases/download/v9.8.7/mole-baby-9.8.7-${file}`;
    assert.ok(guide.includes(`](${url})`),`Missing exact downloadable link ${file}`);
  }
  assert.ok(guide.indexOf('下载 Windows 安装版')<guide.indexOf('## 本次更新'));
  for(const instruction of ['Windows 10 / 11','关于本机','macOS 12','全部解压','Source code','无需注册或登录 GitHub','无需卸载'])assert.ok(guide.includes(instruction),`Missing installation instruction ${instruction}`);
  assert.throws(()=>prepareReleaseNotes(directory,'source','notes','v9.8.7'),/stable version/);
});

test('release includes a standalone Mac guide with an idempotent matching checksum',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mole-guide-release-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'release'));fs.mkdirSync(path.join(root,'electron'));
 const guide=fs.readFileSync(path.join(__dirname,'../electron/Mac 打开说明.html'));fs.writeFileSync(path.join(root,'electron/Mac 打开说明.html'),guide);fs.writeFileSync(path.join(root,'RELEASE_NOTES.md'),'new release');
 for(const arch of ['arm64','x64'])fs.writeFileSync(path.join(root,`release/macos-trust-${arch}.json`),JSON.stringify({architecture:arch,sourceSha:'source',mode:'local'}));
 fs.writeFileSync(path.join(root,'release/SHA256SUMS.txt'),'original  original.zip\n');writeReleaseFiles(root,'source');writeReleaseFiles(root,'source');
 assert.deepEqual(fs.readFileSync(path.join(root,'release/mole-baby-mac-help.html')),guide);const lines=fs.readFileSync(path.join(root,'release/SHA256SUMS.txt'),'utf8').trim().split('\n');assert.equal(lines.length,2);
 assert.equal(lines[1],require('node:crypto').createHash('sha256').update(guide).digest('hex')+'  mole-baby-mac-help.html');assert.match(fs.readFileSync(path.join(root,'release/RELEASE_NOTES.md'),'utf8'),/独立 Mac 打开说明/);
});

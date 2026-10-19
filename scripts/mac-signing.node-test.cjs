const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { REQUIRED, signingMode, macBuildConfig, removeEmptySigningCredentials } = require('./mac-signing-policy.cjs');
const { verifyMacTrust } = require('./mac-trust.cjs');
const { notarizeDmg: runDmgNotarization } = require('./notarize-mac-dmg.cjs');
const notarizeDmg = options => runDmgNotarization({ log: () => {}, ...options });
const { prepareReleaseNotes } = require('./prepare-release-notes.cjs');
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
  assert.match(prepareReleaseNotes(directory,'source','notes'),/尚未经过 Apple 公证/);
});

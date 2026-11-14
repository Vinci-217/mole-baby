const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{Platform,Arch}=require('electron-builder');
const{packageWindows}=require('./package-windows.cjs');
test('an explicitly requested installer-only preview skips ZIP without changing the NSIS target',async()=>{
 const calls=[];await packageWindows({portable:false,build:async options=>calls.push(options)});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].targets.get(Platform.WINDOWS).get(Arch.x64),['nsis']);
 assert.equal(calls[0].publish,'never');
});
test('portable ZIP waits for NSIS mutations and archives the same completed application',async()=>{
 for(const[legacy,arch]of[[false,'x64'],[true,'x64'],[true,'ia32']]){
  const calls=[];let finish;
  const pending=packageWindows({legacy,arch,build:options=>{calls.push(options);return calls.length===1?new Promise(resolve=>finish=resolve):Promise.resolve()}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);
  assert.deepEqual(calls[0].targets.get(Platform.WINDOWS).get(Arch[arch]),['nsis']);
  finish();await pending;assert.equal(calls.length,2);
  assert.deepEqual(calls[1].targets.get(Platform.WINDOWS).get(Arch[arch]),['zip']);
  assert.equal(calls[1].prepackaged,path.resolve(__dirname,'..',legacy?`release/legacy-${arch}`:'release',arch==='ia32'?'win-ia32-unpacked':'win-unpacked'));
  assert.equal(calls[1].config,calls[0].config);assert.equal(calls[1].publish,'never');
 }
});
test('failed NSIS packaging cannot archive a partial payload and restores architecture configuration',async()=>{
 const previous=process.env.MOLE_LEGACY_ARCH;let calls=0;
 await assert.rejects(packageWindows({legacy:true,arch:'ia32',build:async()=>{calls++;throw Error('incomplete installer')}}),/incomplete installer/);
 assert.equal(calls,1);assert.equal(process.env.MOLE_LEGACY_ARCH,previous);
 await assert.rejects(packageWindows({arch:'ia32',build:async()=>calls++}),/Unsupported/);assert.equal(calls,1);
});
test('local preview installer and ZIP use one isolated output and preserve application identity',async()=>{
 const config=require('../electron-builder.windows-preview.cjs'),base=require('../package.json').build,calls=[];
 await packageWindows({config,build:async options=>calls.push(options)});
 assert.equal(config.appId,base.appId);assert.equal(config.productName,base.productName);
 assert.equal(config.extraMetadata.animationPreview,true);
 assert.equal(calls[0].publish,'never');assert.equal(calls[1].publish,'never');
 assert.equal(calls[1].config,config);
 assert.equal(calls[1].prepackaged,path.resolve(__dirname,'../release/windows-preview/win-unpacked'));
 assert.ok(config.files.some(entry=>typeof entry==='object'&&entry.to==='dist'));
 assert.ok(!config.files.includes('dist/**/*'),'Do not package the live PWA renderer as the native app');
});
test('standalone preview configuration validates without inheriting the live web FileSet',async()=>{
 const {spawnSync}=require('node:child_process');
 // Isolate the builder's direct logger writes from node:test's IPC stream.
 const child=spawnSync(process.execPath,['-e',`(async()=>{
  const assert=require('node:assert/strict');
  const {getConfig,validateConfiguration}=require('app-builder-lib/out/util/config/config');
  const config=await getConfig(process.cwd(),require('node:path').resolve('electron-builder.windows-preview.cjs'));
  await validateConfiguration(config,{isEnabled:false});
  assert.equal(config.publish[0].provider,'github');
  assert.equal(Object.hasOwn(config.publish[0],'0'),false);
  assert.equal(config.extraMetadata.animationPreview,true);
  assert(!config.files.some(entry=>entry.filter?.includes('dist/**/*')));
  const {FileMatcher}=require('app-builder-lib/out/fileMatcher');
  const match=new FileMatcher(process.cwd(),process.cwd(),value=>value,config.asarUnpack).createFilter();
  for(const group of ['uploaded-actions','daily-frames'])assert(match(require('node:path').join(process.cwd(),'release/windows-preview/renderer/assets/original',group,'sample.webp'),{isDirectory:()=>false}));
 })().catch(error=>{console.error(error);process.exitCode=1})`],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
 assert.equal(child.status,0,child.stderr||child.stdout);
});

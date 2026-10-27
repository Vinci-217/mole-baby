const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{Platform,Arch}=require('electron-builder');
const{packageWindows}=require('./package-windows.cjs');
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

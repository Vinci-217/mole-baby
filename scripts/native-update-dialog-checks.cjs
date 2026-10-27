/** Exercise the real native cancel/default path without network or installers.
 * Positive consent/installation paths are covered by update-prompts.node-test. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const{execFileSync}=require('node:child_process'),{expect}=require('@playwright/test');
async function verifyNativeUpdateDialog(page,desktop){
 if(process.platform!=='linux')return;
 const display=await desktop.evaluate(()=>process.env.DISPLAY),out=path.resolve(__dirname,'../artifacts/update-consent');fs.mkdirSync(out,{recursive:true});
 const escape='import ctypes\nx=ctypes.CDLL("libX11.so.6"); t=ctypes.CDLL("libXtst.so.6"); x.XOpenDisplay.restype=ctypes.c_void_p; d=x.XOpenDisplay(None); assert d; x.XKeysymToKeycode.argtypes=[ctypes.c_void_p,ctypes.c_ulong]; x.XKeysymToKeycode.restype=ctypes.c_uint; k=x.XKeysymToKeycode(d,0xff1b); t.XTestFakeKeyEvent.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_int,ctypes.c_ulong]; t.XTestFakeKeyEvent(d,k,1,0); t.XTestFakeKeyEvent(d,k,0,0); x.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int]; x.XSync(d,0)';
 try{
  await desktop.evaluate(({app,dialog})=>{
   const load=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
   const{createUpdatePrompts}=load('./electron/update-prompts.cjs');
   const probe={downloads:0,installs:0,result:null,status:'available',dialogs:[]};globalThis.updateConsentProbe=probe;
   probe.prompts=createUpdatePrompts({getUpdates:()=>({getState:()=>({status:probe.status,version:'0.30.0',automaticInstall:true}),download:async()=>{probe.downloads++;return true},install:async()=>{probe.installs++;return true}}),showMessageBox:options=>{probe.dialogs.push(options);return dialog.showMessageBox(options)}});
   void probe.prompts.offerDownload().then(result=>probe.result=result);
  });
  await expect.poll(()=>desktop.evaluate(()=>globalThis.updateConsentProbe.dialogs.length)).toBe(1);
  await page.waitForTimeout(500);
  execFileSync('import',['-display',display,'-window','root',path.join(out,'download-confirmation.png')],{timeout:10000});
  execFileSync('python3',['-c',escape],{env:{...process.env,DISPLAY:display},timeout:5000});
  await expect.poll(()=>desktop.evaluate(()=>globalThis.updateConsentProbe.result)).toBe(false);
  await desktop.evaluate(()=>{const p=globalThis.updateConsentProbe;p.result=null;p.status='ready';void p.prompts.offerInstall().then(result=>p.result=result)});
  await expect.poll(()=>desktop.evaluate(()=>globalThis.updateConsentProbe.dialogs.length)).toBe(2);
  await page.waitForTimeout(500);
  execFileSync('import',['-display',display,'-window','root',path.join(out,'install-confirmation.png')],{timeout:10000});
  execFileSync('python3',['-c',escape],{env:{...process.env,DISPLAY:display},timeout:5000});
  await expect.poll(()=>desktop.evaluate(()=>globalThis.updateConsentProbe.result)).toBe(false);
  const result=await desktop.evaluate(()=>{const p=globalThis.updateConsentProbe;return{downloads:p.downloads,installs:p.installs,defaults:p.dialogs.map(d=>[d.defaultId,d.cancelId])}});
  assert.deepEqual(result,{downloads:0,installs:0,defaults:[[1,1],[1,1]]});
  console.log('PASS native update confirmation: download/install prompts render; Escape defers both without network, installer or restart');
 }finally{await desktop.evaluate(()=>{delete globalThis.updateConsentProbe}).catch(()=>{})}
}
module.exports={verifyNativeUpdateDialog};

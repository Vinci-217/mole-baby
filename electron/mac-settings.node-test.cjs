const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {SETTINGS,createMacHelp}=require('./mac-settings.cjs');
test('Mac help opens only the installation settings pane and rejects arbitrary URLs',async()=>{
 const opened=[],help=createMacHelp({platform:'darwin',shell:{openExternal:async u=>opened.push(u)}});
 await help.openSettings('security');assert.deepEqual(opened,[SETTINGS.security]);await assert.rejects(help.openSettings('dictation'),/不支持/);
 await assert.rejects(help.openSettings('https://example.com'),/不支持/);assert.equal(opened.length,1);
});
test('settings fallback opens the app if a pane URI fails and reports total failure',async()=>{
 const calls=[],help=createMacHelp({platform:'darwin',shell:{openExternal:async u=>{calls.push(u);if(calls.length===1)throw Error('pane unavailable');}}});
 await help.openSettings('security');assert.deepEqual(calls,[SETTINGS.security,'x-apple.systempreferences:']);
 await assert.rejects(createMacHelp({platform:'darwin',shell:{openExternal:async()=>{throw Error('offline');}}}).openSettings('security'),/苹果菜单/);
 await assert.rejects(createMacHelp({platform:'win32'}).openSettings('security'),/仅在 Mac/);
});
test('local guide is extracted from the packaged path before external opening',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-mac-help-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const opened=[];
 const help=createMacHelp({platform:'darwin',guidePath:path.join(__dirname,'Mac 打开说明.html'),guideDirectory:()=>dir,shell:{openPath:async p=>{opened.push(p);return '';}}});
 await help.openGuide();assert.equal(opened.length,1);assert.equal(path.dirname(opened[0]),dir);
 const guide=fs.readFileSync(opened[0],'utf8');for(const text of ['仍要打开',SETTINGS.security,'Applications'])assert.ok(guide.includes(text));
 assert.ok(!guide.includes('xattr')&&!guide.includes('master-disable'));
});

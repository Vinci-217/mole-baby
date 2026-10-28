const{test}=require('node:test'),assert=require('node:assert/strict');
const{createUpdatePrompts}=require('./update-prompts.cjs');
function fixture(answer=1,platform='win32'){let state={status:'available',version:'1.1.0',automaticInstall:true},downloads=0,installs=0,dialogs=[];const updates={getState:()=>({...state}),download:async consent=>{assert.equal(consent,true);downloads++;state.status='ready';return true},install:async consent=>{assert.equal(consent,true);installs++;return true}};const prompts=createUpdatePrompts({getUpdates:()=>updates,platform,showMessageBox:async options=>{dialogs.push(options);return{response:answer}}});return{prompts,dialogs,get downloads(){return downloads},get installs(){return installs},setState:next=>Object.assign(state,next)}}
test('startup offers a release once, safe defaults and dismissal leave the current pet running',async()=>{const f=fixture();assert.equal(await f.prompts.offerDownload(),false);assert.equal(await f.prompts.offerDownload(),false);assert.equal(f.dialogs.length,1);assert.equal(f.dialogs[0].defaultId,1);assert.equal(f.dialogs[0].cancelId,1);assert.equal(f.downloads,0);assert.equal(f.installs,0);await f.prompts.download();assert.equal(f.dialogs.length,2);assert.equal(f.downloads,0)});
test('download and installation each require a separate positive answer',async()=>{const f=fixture(0);assert.equal(await f.prompts.offerDownload(),true);assert.equal(f.downloads,1);assert.equal(f.installs,0);assert.equal(await f.prompts.offerInstall(),true);assert.equal(f.installs,1);assert.match(f.dialogs[1].message,/1\.1\.0/);assert.equal(await f.prompts.offerInstall(),false)});
test('a downloaded portable installer asks before opening the installer',async()=>{const f=fixture();f.setState({status:'ready',automaticInstall:false});await f.prompts.offerInstall();assert.equal(f.dialogs[0].buttons[0],'打开安装包');assert.equal(f.installs,0)});
test('local-signature Mac explicitly distinguishes opening a DMG from replacing the app',async()=>{const f=fixture(0,'darwin');f.setState({status:'ready',automaticInstall:false});await f.prompts.offerInstall();assert.equal(f.dialogs[0].buttons[0],'打开 DMG 安装');assert.match(f.dialogs[0].detail,/选择替换.*退出旧版/);assert.equal(f.installs,1)});
test('concurrent offers share one dialog and a stale version cannot receive consent',async()=>{let release,dialogs=0,downloads=0,state={status:'available',version:'1.1.0'};const prompts=createUpdatePrompts({getUpdates:()=>({getState:()=>({...state}),download:async()=>{downloads++;return true}}),showMessageBox:()=>{dialogs++;return new Promise(r=>release=r)}});const a=prompts.offerDownload(),b=prompts.download();assert.equal(a,b);await Promise.resolve();state={status:'available',version:'1.2.0'};release({response:0});assert.equal(await a,false);assert.equal(dialogs,1);assert.equal(downloads,0)});
test('failed native dialogs do not grant consent and a manual retry remains available',async()=>{let errors=0,dialogs=0,downloads=0;const prompts=createUpdatePrompts({getUpdates:()=>({getState:()=>({status:'available',version:'1.1.0'}),download:async()=>{downloads++;return true}}),showMessageBox:async()=>{dialogs++;throw Error('native prompt unavailable')},onError:()=>errors++});assert.equal(await prompts.offerDownload(),false);assert.equal(await prompts.download(),false);assert.equal(dialogs,2);assert.equal(errors,2);assert.equal(downloads,0)});

test('queued release prompts are revalidated before showing stale information',async()=>{
 let state={status:'available',version:'1.1.0'},shown=0;
 const prompts=createUpdatePrompts({getUpdates:()=>({getState:()=>({...state})}),showMessageBox:async()=>{shown++;return{response:1}}});
 const pending=prompts.offerDownload();state={status:'available',version:'1.2.0'};
 assert.equal(await pending,false);assert.equal(shown,0);
});

test('different release dialogs are serialized instead of stacking native windows',async()=>{
 let state={status:'available',version:'1.1.0'},answer,shown=0;
 const prompts=createUpdatePrompts({getUpdates:()=>({getState:()=>({...state})}),showMessageBox:()=>{shown++;return new Promise(resolve=>answer=resolve)}});
 const first=prompts.offerDownload();await new Promise(resolve=>setImmediate(resolve));
 state={status:'available',version:'1.2.0'};const second=prompts.offerDownload();await new Promise(resolve=>setImmediate(resolve));assert.equal(shown,1);
 answer({response:1});await first;await new Promise(resolve=>setImmediate(resolve));assert.equal(shown,2);answer({response:1});await second;
});

test('shutdown ignores pending answers and prevents new native dialogs',async()=>{
 let answer,downloads=0,shown=0;
 const prompts=createUpdatePrompts({getUpdates:()=>({getState:()=>({status:'available',version:'1.1.0'}),download:async()=>{downloads++;return true}}),showMessageBox:()=>{shown++;return new Promise(resolve=>answer=resolve)}});
 const pending=prompts.offerDownload();await new Promise(resolve=>setImmediate(resolve));prompts.dispose();answer({response:0});
 assert.equal(await pending,false);assert.equal(await prompts.download(),false);assert.equal(downloads,0);assert.equal(shown,1);
});

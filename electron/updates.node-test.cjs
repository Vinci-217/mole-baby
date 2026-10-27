const{test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const{createUpdates,stableNewer}=require('./updates.cjs');
function fixture(t,extra={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mole-updates-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const pending=new Map();let seq=0;const timers={set(fn,ms){const id=++seq;pending.set(id,{fn,ms});return id},clear(id){pending.delete(id)}};
 const engine=new EventEmitter();let downloads=0,installs=0,saves=0,busy=false,next='1.1.0',acceptSave=true;
 engine.checkForUpdates=async()=>{engine.emit('checking-for-update');if(stableNewer(next,'1.0.0'))engine.emit('update-available',{version:next});else engine.emit('update-not-available',{version:next})};
 engine.downloadUpdate=async()=>{downloads++;engine.emit('download-progress',{percent:50});engine.emit('update-downloaded',{version:next,downloadedFile:path.join(directory,'installer.exe')});return[path.join(directory,'installer.exe')]};engine.quitAndInstall=(silent,relaunch)=>{assert.equal(silent,true);assert.equal(relaunch,true);installs++};
 const configFile=path.join(directory,'updates.json'),cacheDirectory=path.join(directory,'cache');
 const options={version:'1.0.0',platform:'win32',arch:'x64',configFile,cacheDirectory,installed:true,macSigned:false,engineFactory:()=>engine,isBusy:()=>busy,prepareInstall:async()=>{saves++;return acceptSave},openPath:async()=>'',timers,...extra};
 const updates=createUpdates(options);t.after(()=>updates.dispose());
 return{updates,engine,directory,configFile,cacheDirectory,timers,pending,get downloads(){return downloads},get installs(){return installs},get saves(){return saves},busy(value){busy=value},save(value){acceptSave=value},next(value){next=value},async tick(){const entry=pending.entries().next().value;if(entry){pending.delete(entry[0]);await entry[1].fn()}}};
}
test('accepts only newer stable semantic versions',()=>{for(const v of['0.9.9','1.0.0','1.1.0-beta.1','banana','1.0.0+other'])assert.equal(stableNewer(v,'1.0.0'),false);assert.equal(stableNewer('1.2.0','1.0.0'),true)});
test('each Windows/Mac launch checks after startup even when the previous launch was current, respecting the saved off switch',async t=>{
 for(const platform of ['win32','darwin']){
  let checks=0;
  const options={platform,engineFactory:()=>{const e=new EventEmitter();e.checkForUpdates=async()=>{checks++;e.emit('update-not-available',{version:'1.0.0'})};return e},fetch:async url=>{assert.ok(url.endsWith('/latest'));checks++;const r=new Response('');Object.defineProperty(r,'url',{value:'https://github.com/Vinci-217/mole-baby/releases/tag/v1.0.0'});return r}};
  const first=fixture(t,options);first.updates.start();assert.equal(checks,0);assert.equal([...first.pending.values()][0].ms,8000);await first.tick();await new Promise(r=>setImmediate(r));assert.equal(checks,1);assert.equal(first.updates.getState().status,'current');first.updates.dispose();
  const reopened=fixture(t,{...options,configFile:first.configFile});reopened.updates.start();await reopened.tick();await new Promise(r=>setImmediate(r));assert.equal(checks,2);assert.equal(reopened.updates.getState().status,'current');reopened.updates.setEnabled(false);reopened.updates.dispose();
  const disabled=fixture(t,{...options,configFile:first.configFile});disabled.updates.start();assert.equal(disabled.pending.size,0);assert.equal(disabled.updates.getState().enabled,false);assert.equal(checks,2);
 }
});
test('detecting a new release waits for separate download and installation consent',async t=>{
 let noticed=0,ready=0;const f=fixture(t,{onAvailable:()=>noticed++,onReady:()=>ready++});
 await f.updates.check();assert.equal(noticed,1);assert.equal(f.downloads,0);assert.equal(f.updates.getState().status,'available');assert.equal(f.pending.size,0);
 assert.equal(await f.updates.download(),false);assert.equal(await f.updates.download(false),false);assert.equal(f.downloads,0);
 assert.equal(await f.updates.download(true),true);assert.equal(ready,1);assert.equal(f.downloads,1);assert.equal(f.installs,0);assert.equal(f.engine.autoInstallOnAppQuit,false);assert.equal(f.pending.size,0);
 await f.tick();assert.equal(await f.updates.install(),false);assert.equal(await f.updates.install(false),false);assert.equal(f.installs,0);assert.equal(f.saves,0);
 assert.equal(await f.updates.install(true),true);assert.equal(f.saves,1);assert.equal(f.installs,1);assert.equal(f.updates.getState().status,'installing');
});
test('failed save never quits or invokes the installer and supports explicit retry',async t=>{const f=fixture(t);await f.updates.check();await f.updates.download(true);f.save(false);assert.equal(await f.updates.install(true),false);assert.equal(f.installs,0);assert.equal(f.updates.getState().status,'ready');f.save(true);assert.equal(await f.updates.install(true),true);assert.equal(f.installs,1);assert.equal(await f.updates.install(true),false)});
test('checking preference persists and never grants download or quit-install consent',async t=>{const f=fixture(t);await f.updates.check();f.updates.setEnabled(false);assert.equal(f.engine.autoInstallOnAppQuit,false);assert.equal(f.pending.size,0);assert.equal(JSON.parse(fs.readFileSync(f.configFile)).enabled,false);assert.throws(()=>f.updates.setEnabled('true'),/boolean/)});
test('disabled/development contexts never create an engine or touch the network',async t=>{let calls=0;const f=fixture(t,{disabled:true,engineFactory:()=>{calls++;throw Error('must not load')}});f.updates.start();assert.equal(await f.updates.check(),false);assert.equal(await f.updates.install(true),false);assert.equal(calls,0);assert.equal(f.updates.getState().status,'disabled')});
test('current releases do not download and network failures leave the pet running',async t=>{const f=fixture(t);f.next('0.9.0');await f.updates.check();assert.equal(f.downloads,0);assert.equal(f.updates.getState().status,'current');f.engine.checkForUpdates=async()=>{throw Error('offline')};assert.equal(await f.updates.check(),false);assert.equal(f.updates.getState().status,'error');assert.equal(f.installs,0)});
test('concurrent checks reuse the same operation and cannot download twice',async t=>{const f=fixture(t);let release;f.engine.checkForUpdates=async()=>{await new Promise(r=>release=r);f.engine.emit('update-available',{version:'1.1.0'})};const a=f.updates.check(),b=f.updates.check();assert.equal(a,b);await Promise.resolve();release();await a;assert.equal(f.downloads,0);assert.equal(f.updates.getState().status,'available');assert.equal(await f.updates.download(true),true);assert.equal(f.downloads,1)});
test('portable Windows builds download and open an installer only after confirmation',async t=>{let opened;const f=fixture(t,{installed:false,openPath:async file=>{opened=file;return''}});await f.updates.check();assert.equal(f.downloads,0);assert.equal(f.engine.autoInstallOnAppQuit,false);assert.equal(f.pending.size,0);await f.updates.download(true);await f.updates.install(true);assert.ok(opened.endsWith('installer.exe'));assert.equal(f.installs,0)});
function macFetch(payload,broken=false){const digest=crypto.createHash('sha256').update(payload).digest('hex');return async url=>{if(url.endsWith('/latest')){const response=new Response('');Object.defineProperty(response,'url',{value:'https://github.com/Vinci-217/mole-baby/releases/tag/v1.1.0'});return response}if(url.endsWith('SHA256SUMS.txt'))return new Response(`${broken?'0'.repeat(64):digest}  mole-baby-1.1.0-mac-arm64.dmg\n`);assert.ok(url.endsWith('mac-arm64.dmg'));return new Response(payload,{headers:{'content-length':String(payload.length)}})}}
test('local-signature Mac downloads its architecture, verifies SHA256 and exposes the installer',async t=>{const bytes=Buffer.from('verified test disk image');let opened;const f=fixture(t,{platform:'darwin',arch:'arm64',fetch:macFetch(bytes),engineFactory:()=>{throw Error('Squirrel must not load for ad-hoc builds')},openPath:async file=>{opened=file;return''}});await f.updates.check();assert.equal(f.updates.getState().status,'available');assert.equal(fs.existsSync(f.cacheDirectory),false);await f.updates.download(true);assert.equal(f.updates.getState().status,'ready');assert.equal(f.updates.getState().automaticInstall,false);assert.deepEqual(fs.readFileSync(path.join(f.cacheDirectory,'mole-baby-1.1.0-mac-arm64.dmg')),bytes);await f.updates.install(true);assert.ok(opened.endsWith('.dmg'));assert.equal(f.pending.size,0)});
test('a checksum mismatch deletes the partial Mac download and cannot launch anything',async t=>{const f=fixture(t,{platform:'darwin',arch:'arm64',fetch:macFetch(Buffer.from('tampered'),true)});assert.equal(await f.updates.check(),true);assert.equal(await f.updates.download(true),false);assert.equal(f.updates.getState().status,'error');assert.equal(await f.updates.install(true),false);assert.deepEqual(fs.readdirSync(f.cacheDirectory),[])});
test('a release redirect outside the configured GitHub repository is rejected',async t=>{const f=fixture(t,{platform:'darwin',fetch:async()=>{const r=new Response('');Object.defineProperty(r,'url',{value:'https://example.com/releases/tag/v9.0.0'});return r}});assert.equal(await f.updates.check(),false);assert.equal(f.updates.getState().status,'error')});

test('a synchronous engine initialization failure releases the check lock for retry',async t=>{let calls=0;const f=fixture(t,{engineFactory:()=>{calls++;throw Error('configuration unavailable')}});assert.equal(await f.updates.check(),false);assert.equal(await f.updates.check(),false);assert.equal(calls,2)});

test('enabling startup checks with a pending release never downloads or installs it',async t=>{
 const f=fixture(t);f.updates.setEnabled(false);await f.updates.check();f.updates.setEnabled(true);await new Promise(r=>setImmediate(r));assert.equal(f.downloads,0);assert.equal(f.installs,0);assert.equal(f.updates.getState().status,'available');
 await f.updates.download(true);f.updates.setEnabled(false);f.updates.setEnabled(true);assert.equal(f.engine.autoInstallOnAppQuit,false);assert.equal(f.pending.size,0);assert.equal(f.installs,0);
});
test('unrequested engine download events cannot create an installable update',async t=>{
 let ready=0;const f=fixture(t,{onReady:()=>ready++});await f.updates.check();f.engine.emit('update-downloaded',{version:'1.1.0',downloadedFile:'unrequested.exe'});assert.equal(ready,0);assert.equal(f.updates.getState().status,'available');assert.equal(await f.updates.install(true),false);
});

test('disposing a queued confirmed download prevents starting its network operation',async t=>{
 const f=fixture(t);await f.updates.check();const downloading=f.updates.download(true);f.updates.dispose();
 assert.equal(await downloading,false);assert.equal(f.downloads,0);assert.equal(f.pending.size,0);
});

test('disposing while the save checkpoint is pending cannot restart the application',async t=>{
 let saved;const f=fixture(t,{prepareInstall:()=>new Promise(resolve=>saved=resolve)});
 await f.updates.check();await f.updates.download(true);const installing=f.updates.install(true);
 await new Promise(resolve=>setImmediate(resolve));f.updates.dispose();saved(true);
 assert.equal(await installing,false);assert.equal(f.installs,0);
});

test('late engine events after disposal cannot notify or schedule retries',async t=>{
 let notices=0;const f=fixture(t,{onAvailable:()=>notices++});await f.updates.check();assert.equal(notices,1);
 f.updates.dispose();f.engine.emit('update-available',{version:'1.2.0'});f.engine.emit('error',Error('late network failure'));
 assert.equal(notices,1);assert.equal(f.pending.size,0);
});

test('late check results cannot replace an authorized download or its ready state',async t=>{
 const f=fixture(t);let finish;f.engine.downloadUpdate=()=>new Promise(resolve=>finish=resolve);
 await f.updates.check();const downloading=f.updates.download(true);await Promise.resolve();
 f.engine.emit('update-not-available',{version:'1.0.0'});f.engine.emit('update-available',{version:'1.2.0'});
 assert.equal(f.updates.getState().status,'downloading');assert.equal(f.updates.getState().version,'1.1.0');
 f.engine.emit('download-progress',{percent:NaN});assert.equal(f.updates.getState().percent,0);
 f.engine.emit('update-downloaded',{version:'1.1.0',downloadedFile:'installer.exe'});finish(['installer.exe']);assert.equal(await downloading,true);
 f.engine.emit('update-not-available',{version:'1.0.0'});assert.equal(f.updates.getState().status,'ready');
});

test('disposing an in-flight Mac download aborts requests and removes partial files',async t=>{
 const payload=Buffer.from('partial verified image'),base=macFetch(payload);let signal,release,ready=0;
 const f=fixture(t,{platform:'darwin',arch:'arm64',onReady:()=>ready++,fetch:async(url,options)=>{
  if(!url.endsWith('.dmg'))return base(url,options);
  signal=options.signal;
  return {ok:true,headers:new Headers({'content-length':String(payload.length)}),body:{async *[Symbol.asyncIterator](){await new Promise(resolve=>release=resolve);yield payload}}};
 }});
 await f.updates.check();const downloading=f.updates.download(true);
 while(!release)await new Promise(resolve=>setImmediate(resolve));f.updates.dispose();assert.equal(signal.aborted,true);release();
 assert.equal(await downloading,false);assert.equal(ready,0);assert.deepEqual(fs.readdirSync(f.cacheDirectory),[]);assert.equal(f.pending.size,0);
});

test('repeated start calls do not create duplicate startup checks',async t=>{
 const f=fixture(t);f.updates.start();f.updates.start();assert.equal(f.pending.size,1);f.updates.dispose();assert.equal(f.pending.size,0);
});

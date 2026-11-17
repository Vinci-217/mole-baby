const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {createStartupRecovery}=require('./startup-recovery.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t,options={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'mole-startup-'));
 const timers=new Map(),dialogs=[],opened=[];let sequence=0,retries=0,quits=0;
 const window=new EventEmitter();window.webContents=new EventEmitter();
 const recovery=createStartupRecovery({directory,details:{version:'0.34.2',edition:'legacy',arch:'ia32'},
  showMessageBox:async config=>{dialogs.push(config);return options.answer?options.answer(config):{response:2}},
  openPath:async file=>{opened.push(file);return options.openError??''},
  retry:async()=>{retries++;if(options.retryError)throw options.retryError},quit:()=>quits++,
  timers:{set:callback=>{const id=++sequence;timers.set(id,callback);return id},clear:id=>timers.delete(id)},
 });
 const data=path.join(directory,'save-backups','latest.json');fs.mkdirSync(path.dirname(data),{recursive:true});fs.writeFileSync(data,'unchanged pet backup');
 t.after(()=>{assert.equal(fs.readFileSync(data,'utf8'),'unchanged pet backup');recovery.dispose();fs.rmSync(directory,{recursive:true,force:true})});
 recovery.watch(window);
 return{directory,recovery,window,dialogs,opened,timers,get retries(){return retries},get quits(){return quits},fire(){const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)callback()},readLog(){return fs.readFileSync(recovery.logfile,'utf8')}};
}
test('missing renderer acknowledgement times out to one native prompt and retains runtime diagnostics',async t=>{
 const f=fixture(t);f.fire();await tick();
 assert.equal(f.dialogs.length,1);assert.match(f.dialogs[0].message,/未能正常打开/);
 assert.deepEqual(f.dialogs[0].buttons,['重新加载','查看启动日志','稍后再试','退出拉姆']);
 assert.equal(f.dialogs[0].cancelId,2);assert.match(f.readLog(),/startup-timeout/);
 assert.match(f.readLog(),/"arch":"ia32"/);assert.equal(f.timers.size,0);assert.equal(f.quits,0);
});
test('healthy readiness cancels its timeout and ignores navigation/load failures belonging to child frames',async t=>{
 const f=fixture(t);f.recovery.markReady();
 f.window.webContents.emit('did-start-navigation',{},'ram-original://assets/runtime.html',false,false);
 f.window.webContents.emit('did-fail-load',{},-6,'Missing clip','ram-original://assets/file.swf',false);
 f.fire();await tick();assert.equal(f.dialogs.length,0);assert.equal(f.timers.size,0);
});
test('preload failure and an accompanying renderer crash share one prompt; dismissed recovery stays reachable',async t=>{
 let resolve;const f=fixture(t,{answer:()=>new Promise(done=>{resolve=done})});
 f.window.webContents.emit('preload-error',{},'preload.cjs',Error('Module failed'));
 f.window.webContents.emit('render-process-gone',{}, {reason:'crashed',exitCode:1});
 await tick();assert.equal(f.dialogs.length,1);assert.match(f.readLog(),/Module failed/);assert.match(f.readLog(),/renderer-gone/);
 resolve({response:2});await tick();
 const reopened=f.recovery.show();await tick();assert.equal(f.dialogs.length,2);resolve({response:2});await reopened;
});
test('explicit retry reloads once, rearms readiness and leaves a subsequent healthy startup quiet',async t=>{
 const f=fixture(t,{answer:()=>({response:0})});
 await f.recovery.fail('renderer-gone',{reason:'oom',exitCode:134});
 assert.equal(f.retries,1);assert.equal(f.quits,0);assert.equal(f.timers.size,1);
 f.recovery.markReady();f.fire();await tick();assert.equal(f.dialogs.length,1);
});
test('a slow page that becomes healthy while its dialog is open cannot be reloaded or quit by a stale answer',async t=>{
 for(const response of [0,3]){
  let resolve;const f=fixture(t,{answer:()=>new Promise(done=>{resolve=done})});
  const pending=f.recovery.fail('startup-timeout');await tick();f.recovery.markReady();resolve({response});await pending;
  assert.equal(f.retries,0);assert.equal(f.quits,0);
 }
});
test('opening diagnostics uses only the fixed log path and exposes failures without a reload or exit',async t=>{
 const f=fixture(t,{answer:()=>({response:1}),openError:'No application associated with this file'});
 await f.recovery.fail('preload-error',Error('Missing dependency'));
 assert.deepEqual(f.opened,[f.recovery.logfile]);assert.equal(f.dialogs.length,2);
 assert.equal(f.dialogs[1].message,'暂时无法打开启动日志');assert.equal(f.retries,0);assert.equal(f.quits,0);
});
test('unwritable logs still produce an actionable native prompt and do not touch the backup',async t=>{
 const f=fixture(t);fs.rmSync(path.dirname(f.recovery.logfile),{recursive:true});fs.writeFileSync(path.dirname(f.recovery.logfile),'blocked logs directory');
 await f.recovery.fail('preload-error',Error('Load failed'));
 assert.equal(f.dialogs.length,1);assert.match(f.dialogs[0].detail,/无法写入/);assert.equal(f.quits,0);
});
test('large diagnostics rotate only their own logs and record the next failure',async t=>{
 const f=fixture(t);fs.writeFileSync(f.recovery.logfile,'x'.repeat(256*1024+1));
 await f.recovery.fail('renderer-gone',{reason:'oom',exitCode:134});
 assert.match(f.readLog(),/"reason":"oom"/);
 assert.equal(fs.statSync(path.join(path.dirname(f.recovery.logfile),'startup.previous.log')).size,256*1024+1);
});
test('canceled loads and a former window cannot report failures into a new healthy window',async t=>{
 const f=fixture(t);f.window.webContents.emit('did-fail-load',{},-3,'Canceled','file:///index.html',true);await tick();assert.equal(f.dialogs.length,0);
 const next=new EventEmitter();next.webContents=new EventEmitter();f.recovery.watch(next);f.recovery.markReady();
 f.window.webContents.emit('render-process-gone',{}, {reason:'crashed',exitCode:1});await tick();assert.equal(f.dialogs.length,0);
});
test('shutdown cancels timers and pending decisions without invoking retry or quit',async t=>{
 let resolve;const f=fixture(t,{answer:()=>new Promise(done=>{resolve=done})});
 const pending=f.recovery.fail('preload-error');await tick();f.recovery.dispose();resolve({response:0});await pending;
 f.window.webContents.emit('render-process-gone',{}, {reason:'crashed',exitCode:1});f.fire();await tick();
 assert.equal(f.dialogs.length,1);assert.equal(f.timers.size,0);assert.equal(f.retries,0);assert.equal(f.quits,0);
});

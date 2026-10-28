const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createRoomFullscreen}=require('./room-fullscreen.cjs');
function fixture(options={}){
 const window=new EventEmitter();window.fullscreen=false;window.requests=[];window.isDestroyed=()=>false;window.isFullScreen=()=>window.fullscreen;window.setFullScreen=value=>window.requests.push(value);
 const counts={enter:0,leave:0,change:0};
 const api=createRoomFullscreen({getWindow:()=>window,isPetMode:()=>false,beforeEnter:()=>counts.enter++,afterLeave:()=>counts.leave++,onChange:()=>counts.change++,...options});
 const finish=value=>{window.fullscreen=value;window.emit(value?'enter-full-screen':'leave-full-screen')};
 return {window,api,counts,finish};
}
test('fullscreen waits for native transitions and restores only after leaving',async()=>{
 const {window,api,counts,finish}=fixture();const entering=api.set(true);
 assert.equal(api.isChanging(),true);assert.deepEqual(window.requests,[true]);assert.equal(counts.enter,1);
 finish(true);assert.equal(await entering,true);assert.equal(api.isChanging(),false);
 const leaving=api.set(false);assert.equal(counts.leave,0);finish(false);assert.equal(await leaving,false);assert.equal(counts.leave,1);assert.equal(counts.change,2);
});
test('a rapid opposite request is serialized behind the first transition',async()=>{
 const {window,api,finish}=fixture(),first=api.set(true),second=api.set(false);
 assert.deepEqual(window.requests,[true]);finish(true);await first;await new Promise(setImmediate);assert.deepEqual(window.requests,[true,false]);finish(false);await second;
});
test('compact desktop mode cannot enter room fullscreen and input must be boolean',async()=>{
 const {api}=fixture({isPetMode:()=>true});await assert.rejects(api.set(true),/小屋/);assert.equal(await api.set(false),false);assert.throws(()=>api.set('true'),/boolean/);
});
test('a timed-out transition clears its listeners and permits retry',async()=>{
 const {api,window,finish}=fixture({timeoutMs:5});await assert.rejects(api.set(true),/未完成/);
 assert.equal(api.isChanging(),false);assert.equal(window.listenerCount('enter-full-screen'),0);assert.equal(window.listenerCount('closed'),0);
 const next=api.set(true);finish(true);assert.equal(await next,true);
});
test('closing the window rejects an in-flight operation instead of hanging',async()=>{
 const {api,window}=fixture();const request=api.set(true);window.emit('closed');await assert.rejects(request,/关闭/);assert.equal(api.isChanging(),false);
});
test('restoration errors do not strand a pending transition',async()=>{
 const {api,finish}=fixture({afterLeave:()=>{throw Error('restore failed')}});const first=api.set(true);finish(true);await first;
 const second=api.set(false);finish(false);await assert.rejects(second,/restore failed/);assert.equal(api.isChanging(),false);assert.equal(await api.set(false),false);
});

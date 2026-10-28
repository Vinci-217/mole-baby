/** Electron fullscreen transitions are asynchronous on macOS. Serialize them
 * and wait for completion before restoring the compact desktop window. */
function createRoomFullscreen({getWindow,isPetMode,beforeEnter,afterLeave,onChange,timeoutMs=10000}){
 let transition=null,changing=false;
 function set(enabled){
  if(typeof enabled!=='boolean')throw new TypeError('Room fullscreen must be a boolean');
  const window=getWindow();if(!window||window.isDestroyed())return Promise.reject(new Error('窗口暂时不可用。'));
  if(enabled&&isPetMode())return Promise.reject(new Error('进入小屋后才能全屏查看。'));
  if(transition)return transition.then(()=>set(enabled));
  if(window.isFullScreen()===enabled)return Promise.resolve(enabled);
  if(enabled)beforeEnter();
  changing=true;
  const event=enabled?'enter-full-screen':'leave-full-screen';
  const promise=new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);window.removeListener(event,done);window.removeListener('closed',closed)};
   const fail=error=>{cleanup();changing=false;reject(error)};
   const closed=()=>fail(new Error('窗口已关闭。'));
   const done=()=>{try{cleanup();if(!enabled)afterLeave();changing=false;onChange();resolve(enabled)}catch(error){fail(error)}};
   const timer=setTimeout(()=>fail(new Error('全屏切换未完成，请稍后重试。')),timeoutMs);
   window.once(event,done);window.once('closed',closed);
   try{window.setFullScreen(enabled)}catch(error){fail(error)}
  });
  transition=promise.finally(()=>{transition=null;changing=false});
  return transition;
 }
 return {set,isChanging:()=>changing};
}
module.exports={createRoomFullscreen};

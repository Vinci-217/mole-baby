/** Serialize native fullscreen transitions before changing back to the pet.
 * Transparent Windows windows emit fullscreen events but Electron 22/35 can
 * keep isFullScreen() false (NativeWindowViews' no-thick-frame path). Track
 * completed requests there, and wait until setFullScreen returns: Windows
 * emits enter-full-screen BEFORE it actually applies the display bounds. */
function createRoomFullscreen({getWindow,isPetMode,beforeEnter,afterLeave,onChange,platform=process.platform,timeoutMs=10000}){
 let transition=null,changing=false;
 const windowsFullscreen=new WeakSet();
 function isFullscreen(){
  const window=getWindow();if(!window||window.isDestroyed())return false;
  return platform==='win32'?windowsFullscreen.has(window):window.isFullScreen();
 }
 function set(enabled){
  if(typeof enabled!=='boolean')throw new TypeError('Room fullscreen must be a boolean');
  const window=getWindow();if(!window||window.isDestroyed())return Promise.reject(new Error('窗口暂时不可用。'));
  if(enabled&&isPetMode())return Promise.reject(new Error('进入小屋后才能全屏查看。'));
  if(transition)return transition.then(()=>set(enabled));
  if(isFullscreen()===enabled)return Promise.resolve(enabled);
  if(enabled)beforeEnter();
  changing=true;
  const event=enabled?'enter-full-screen':'leave-full-screen';
  const promise=new Promise((resolve,reject)=>{
   let returned=false,observed=false;
   const cleanup=()=>{clearTimeout(timer);window.removeListener(event,done);window.removeListener('closed',closed)};
   const fail=error=>{cleanup();changing=false;reject(error)};
   const closed=()=>fail(new Error('窗口已关闭。'));
   const finish=()=>{
    cleanup();if(enabled)windowsFullscreen.add(window);else windowsFullscreen.delete(window);
    let error;
    try{if(!enabled)afterLeave()}catch(e){error=e}
    changing=false;
    try{onChange()}catch(e){error??=e}
    if(error)reject(error);else resolve(enabled);
   };
   const done=()=>{observed=true;if(returned)finish()};
   const timer=setTimeout(()=>fail(new Error('全屏切换未完成，请稍后重试。')),timeoutMs);
   window.once(event,done);window.once('closed',closed);
   try{window.setFullScreen(enabled);returned=true;if(observed)finish()}catch(error){fail(error)}
  });
  transition=promise.finally(()=>{transition=null;changing=false});
  return transition;
 }
 return {set,isFullscreen,isChanging:()=>changing};
}
module.exports={createRoomFullscreen};

export function isWebApp(){return import.meta.env.VITE_WEB_APP==='1'&&!window.desktop&&!window.mobile}

export type WebCacheState='starting'|'ready'|'update-ready'|'unavailable';
let state:WebCacheState='starting';
const listeners=new Set<()=>void>();
const setState=(value:WebCacheState)=>{state=value;listeners.forEach(listener=>listener())};
export const webCacheState=()=>state;
export const subscribeWebCache=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};

/** Installation is optional; storage and the game keep working if unavailable. */
export function installWebApp(){
 if(!isWebApp())return;
 document.documentElement.classList.add('web-edition');
 if(!window.isSecureContext||!('serviceWorker'in navigator)){setState('unavailable');return}
 void navigator.serviceWorker.register(new URL('./sw.js',document.baseURI),{scope:'./',updateViaCache:'none'}).then(registration=>{
  const status=()=>setState(registration.waiting?'update-ready':registration.active?'ready':'starting');
  const observe=()=>{registration.installing?.addEventListener('statechange',status);status()};
  registration.addEventListener('updatefound',observe);navigator.serviceWorker.addEventListener('controllerchange',status);observe();
  // Let a new worker wait for all old windows to close. Taking over a running
  // original SWF could mix old metadata with new source bytes.
  void registration.update().catch(()=>{});
 }).catch(()=>setState('unavailable'));
}

/** The Android host keeps the same renderer alive when switching to the overlay. */
export interface AndroidPermissions {
  overlay:boolean;notifications:boolean;exactAlarms:boolean;installPackages:boolean;
  batteryOptimized:boolean;touchThrough:boolean;autoDownloadWifi:boolean;api:number;version:string;channel:string;
}
type Listener=(value:Record<string,unknown>)=>void;
declare global {
  interface Window {
    MoleAndroid?:{bootstrap:()=>string;persist:(key:string,value:string|null)=>boolean;invoke:(id:string,method:string,args:string)=>void};
    __moleAndroidReceive?:(id:string,value:unknown,error:string|null)=>void;
    __moleAndroidEvent?:(type:string,value:Record<string,unknown>)=>void;
    mobile?:{
      permissions:()=>Promise<AndroidPermissions>;
      requestPermission:(kind:'overlay'|'notifications'|'alarms'|'battery'|'install')=>Promise<boolean>;
      exportSave:(text:string,name:string)=>Promise<boolean>;
      scheduleReminder:(id:string,at:number,title:string,body:string)=>Promise<boolean>;
      cancelReminder:(id:string)=>Promise<boolean>;
      wasNotified:(id:string)=>Promise<boolean>;
      cancelUpdate:()=>Promise<boolean>;
      setAutoDownloadWifi:(enabled:boolean)=>Promise<AndroidPermissions>;
      on:(event:string,callback:Listener)=>()=>void;
    };
  }
}

export function installAndroidHost(){
  const native=window.MoleAndroid;if(!native)return;
  const bootstrap=JSON.parse(native.bootstrap()) as {storage:Record<string,string>;permissions:AndroidPermissions;state:DesktopState};
  document.documentElement.classList.add('android-host');
  const original={set:Storage.prototype.setItem,remove:Storage.prototype.removeItem,clear:Storage.prototype.clear};
  const allowed=(key:string)=>key.startsWith('ramu-')&&key.length<160;
  for(const key of Object.keys(localStorage))if(allowed(key)&&!(key in bootstrap.storage))original.remove.call(localStorage,key);
  for(const [key,value] of Object.entries(bootstrap.storage))if(allowed(key)&&typeof value==='string')original.set.call(localStorage,key,value);
  Storage.prototype.setItem=function(key,value){
    const k=String(key),v=String(value),previous=this.getItem(k);original.set.call(this,k,v);
    if(this===localStorage&&allowed(k)&&!native.persist(k,v)){
      if(previous===null)original.remove.call(this,k);else original.set.call(this,k,previous);
      throw new DOMException('本机存档空间不足，请导出备份。','QuotaExceededError');
    }
  };
  Storage.prototype.removeItem=function(key){const k=String(key);if(this===localStorage&&allowed(k)&&!native.persist(k,null))throw new Error('本机存档暂时无法删除');original.remove.call(this,k);};
  Storage.prototype.clear=function(){if(this===localStorage)for(const k of Object.keys(this))if(allowed(k))native.persist(k,null);original.clear.call(this);};
  const listeners=new Map<string,Set<Listener>>();
  const on=(type:string,listener:Listener)=>{const set=listeners.get(type)??new Set<Listener>();set.add(listener);listeners.set(type,set);return()=>{set.delete(listener);};};
  const pending=new Map<string,{resolve:(v:unknown)=>void;reject:(reason:Error)=>void;timer:ReturnType<typeof setTimeout>}>();let sequence=0;
  const rpc=<T,>(method:string,args:Record<string,unknown>={},timeout=15000):Promise<T>=>new Promise((resolve,reject)=>{
    const id=String(++sequence);const timer=setTimeout(()=>{pending.delete(id);reject(new Error('安卓操作超时，请重试。'));},timeout);
    pending.set(id,{resolve:resolve as (v:unknown)=>void,reject,timer});
    try{native.invoke(id,method,JSON.stringify(args));}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
  });
  const send=(method:string,args:Record<string,unknown>={})=>{void rpc(method,args).catch(()=>{});};
  window.__moleAndroidReceive=(id,value,error)=>{const task=pending.get(id);if(!task)return;pending.delete(id);clearTimeout(task.timer);if(error)task.reject(new Error(error));else task.resolve(value);};
  const prepare=new Set<()=>boolean|Promise<boolean>>();
  window.__moleAndroidEvent=(type,payload)=>{
    if(type==='prepare')void(async()=>{let ok=true;for(const callback of prepare)try{if(!await callback())ok=false;}catch{ok=false;}send('prepared',{token:payload.token,ok});})();
    for(const callback of listeners.get(type)??[])callback(payload);
  };
  window.mobile={permissions:()=>rpc('permissions'),requestPermission:kind=>rpc('permission',{kind}),exportSave:(text,name)=>rpc('exportSave',{text,name},300000),scheduleReminder:(id,at,title,body)=>rpc('scheduleReminder',{id,at,title,body}),cancelReminder:id=>rpc('cancelReminder',{id}),wasNotified:id=>rpc('wasNotified',{id}),cancelUpdate:()=>rpc('updatesCancel'),setAutoDownloadWifi:enabled=>rpc('updatesWifi',{enabled}),on};
  window.desktop={
    platform:'android',isElectron:false,
    getState:()=>rpc('getState'),
    updates:{getState:()=>rpc('updatesState'),check:()=>rpc('updatesCheck'),download:()=>rpc('updatesDownload'),install:()=>rpc('updatesInstall'),setEnabled:enabled=>rpc('updatesEnabled',{enabled}),setDownloadPolicy:policy=>rpc('updatesPolicy',{policy}),setBusy:busy=>send('updatesBusy',{busy}),openRelease:()=>rpc('updatesOpenRelease'),onStateChanged:callback=>on('updates',v=>callback(v as unknown as UpdateState)),onPrepare:callback=>{prepare.add(callback);return()=>{prepare.delete(callback);};}},
    setMusicState:state=>rpc('setMusicState',state),onMusicToggle:callback=>on('music',v=>callback(v.enabled===true)),
    openMacSettings:async()=>false,openMacGuide:async()=>false,
    minimize:()=>send('minimize'),close:()=>send('close'),hideToTray:()=>send('hideToTray'),readyToShow:hasPet=>send('readyToShow',{hasPet}),
    preparePetDrag:()=>rpc('preparePetDrag'),dragPetToCursor:()=>rpc('dragPetToCursor'),startPetDrag:offset=>rpc('startPetDrag',offset??{}),endPetDrag:()=>rpc('endPetDrag'),
    setMouseThrough:enabled=>rpc('setMouseThrough',{enabled}),toggleAlwaysOnTop:()=>rpc('toggleAlwaysOnTop'),setMousePassthrough:ignore=>send('setMousePassthrough',{ignore}),
    setPetMode:enabled=>rpc('setPetMode',{enabled}),setRoomFullscreen:enabled=>rpc('setRoomFullscreen',{enabled}),startRoomResize:edge=>rpc('startRoomResize',{edge}),endRoomResize:()=>rpc('endRoomResize'),adjustRoomSize:(dx,dy)=>rpc('adjustRoomSize',{dx,dy}),openManorSite:()=>rpc('openManorSite'),
    setCompanionPanel:(open,layout)=>rpc('setCompanionPanel',{open,layout}),setPetStatus:status=>rpc('setPetStatus',{status}),setPetEffectBounds:bounds=>rpc('setPetEffectBounds',{bounds}),setPetAppearance:form=>rpc('setPetAppearance',{form}),setPetCanMove:enabled=>rpc('setPetCanMove',{enabled}),
    setEdgeHiding:enabled=>rpc('setEdgeHiding',{enabled}),revealPet:()=>rpc('revealPet'),setEdgeHovered:hovered=>rpc('setEdgeHovered',{hovered}),setInteracting:enabled=>rpc('setInteracting',{enabled}),movePet:(dx,dy)=>rpc('movePet',{dx,dy}),wander:enabled=>rpc('wander',{enabled}),
    onStateChanged:callback=>{const off=on('state',v=>callback(v as unknown as DesktopState));void rpc<DesktopState>('getState').then(callback).catch(()=>{});return off;},onPetModeChanged:callback=>on('state',v=>callback(v.petMode===true)),notify:(title,body)=>send('notify',{title,body}),
  };
}

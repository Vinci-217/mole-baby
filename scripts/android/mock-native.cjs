'use strict';
function mockNative(initialStorage){
 const storage=initialStorage||JSON.parse(sessionStorage.getItem('android-native-mirror')||'{}'),calls=[];
 const state={petMode:false,alwaysOnTop:true,wandering:true,companionPanel:false,panelSide:'right',edgeHiding:true,edgeSide:null,edgePose:'visible',windowVisible:true};
 const permissions={overlay:false,notifications:true,exactAlarms:true,installPackages:false,batteryOptimized:true,touchThrough:false,autoDownloadWifi:false,api:35,version:'0.32.0-preview.1',channel:'android-preview'};
 const emit=(event,value)=>window.__moleAndroidEvent?.(event,value);
 window.__androidTest={storage,calls,state,permissions,emit,failWrites:false};
 window.MoleAndroid={bootstrap:()=>JSON.stringify({storage,state,permissions}),persist:(key,value)=>{if(window.__androidTest.failWrites)return false;if(value===null)delete storage[key];else storage[key]=value;sessionStorage.setItem('android-native-mirror',JSON.stringify(storage));return true;},invoke:(id,method,raw)=>{
  const a=JSON.parse(raw);calls.push({method,args:a});let value=true,error=null;
  if(method==='getState')value={...state};
  if(method==='permissions')value={...permissions};
  if(method==='permission'){if(a.kind==='overlay')permissions.overlay=true;emit('permissions',permissions);}
  if(method==='updatesState')value={status:'idle',currentVersion:permissions.version,version:null,percent:0,enabled:true,automaticInstall:false,checkedAt:null,message:'安卓预览渠道待发布'};
  if(method==='updatesWifi'){permissions.autoDownloadWifi=a.enabled;value={...permissions};emit('permissions',permissions);}
  if(method==='setPetMode'){if(a.enabled&&!permissions.overlay)error='请先允许拉姆显示在其他应用上层，再点击悬浮陪伴。';else{state.petMode=a.enabled;value=a.enabled;emit('state',state);}}
  if(method==='setCompanionPanel'){state.companionPanel=a.open;state.panelGeometry=a.open?{petX:90,petY:0,panelX:8,panelY:230,panelWidth:324,panelHeight:362,scale:1}:null;value={...state};emit('state',state);}
  if(method==='setPetAppearance'||method==='setPetEffectBounds'||method==='revealPet')value={...state};
  if(method==='wasNotified')value=false;
  setTimeout(()=>window.__moleAndroidReceive?.(id,value,error),0);
 }};
}
module.exports={mockNative};

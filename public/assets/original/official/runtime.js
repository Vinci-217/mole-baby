/* Offline original vectors. No application bridge or access to parent storage. */
(async function(){
 const token=new URLSearchParams(location.search).get('token'),pollLimit=300; // 45s at 150ms, matching the host's cold-start budget
 let player,ready=false,visible=false,poseSettling=false,timer,lastPose,id,sequence=0,clip,looping,pose,requestAcknowledged=false;
 const manifest=fetch('manifest.json?v=5').then(response=>{if(!response.ok)throw Error('Manifest unavailable');return response.json()});
 const send=(type,value)=>parent.postMessage({type:'ram-original-'+type,token,id,sequence,value},'*');
 const call=(name,...args)=>player&&player.ruffle().callExternalInterface(name,...args);
 const maskCanvas=document.createElement('canvas');maskCanvas.width=100;maskCanvas.height=108;
 function pixels(){
  const canvas=player.shadowRoot.querySelector('canvas'),ctx=maskCanvas.getContext('2d',{willReadFrequently:true});
  if(!canvas||!ctx)return null;
  // Match the host's original body hit area, excluding transparent padding.
  ctx.clearRect(0,0,100,108);ctx.drawImage(canvas,canvas.width*11/32,canvas.height*11/32,canvas.width*10/32,canvas.height*10/32,0,0,100,108);
  const rgba=ctx.getImageData(0,0,100,108).data,alpha=[];
  for(let i=3;i<rgba.length;i+=4)alpha.push(rgba[i]);return alpha;
 }
 function sendMask(){try{const alpha=pixels();if(alpha)send('mask',alpha);}catch(error){window.originalMaskError=String(error);send('diagnostic',{phase:'mask',error:String(error)});}}
 function apply(){
  if(!ready)return;
  player.ruffle().resume();
  call('setBodyColor',...pose.color);
  if(!lastPose||lastPose.form!==pose.form||lastPose.direction!==pose.direction||lastPose.moving!==pose.moving){call('previewPose',pose.form,pose.direction,pose.moving,clip.kind==='outfit'&&!visible);poseSettling=clip.kind==='outfit';}
  player.ruffle().volume=pose.sound?Math.max(0,Math.min(1,pose.volume??.45)):0;lastPose={...pose};
  if(!poseSettling&&(pose.paused||document.hidden))player.ruffle().suspend();
 }
 async function load(request){
  if(request.sequence<=sequence)return;
  ready=false;visible=false;poseSettling=false;requestAcknowledged=false;clearInterval(timer);lastPose=null;
  sequence=request.sequence;id=request.value.id;pose=request.value.pose;looping=request.value.loop;
  const current=sequence;
  // Retire a superseded load immediately. A slow/failed old engine must not
  // hold every later wardrobe selection in a serial loading queue.
  if(player){player.remove();player=null;}
  try{
   const library=await manifest;
   if(current!==sequence)return;
   clip=library.clips.find(row=>row.id===id);if(!clip)throw Error('Unknown source');
   if(clip.forms.length&&!clip.forms.includes(pose.form))throw Error('Unsupported form');
   // Each source gets a fresh AVM2 application. Reloading different client
   // libraries in one player can retain conflicting exported class definitions.
   // The iframe and already loaded Ruffle module remain in place.
   player=window.RufflePlayer.newest().createPlayer();window.player=player;document.body.append(player);
   const referenceForm=request.value.referenceForm||pose.form;
   const formName={level1:'seed',level2:'junior',level3:'middle',level4:'senior',level101:'classic',level101_7:'super',level5_1:'fire',level5_2:'water',level5_4:'wood'}[referenceForm]||'junior';
   await player.ruffle().load({url:'controller.swf?v=5',parameters:{source:'files/'+clip.path,symbol:clip.symbol,form:pose.form,kind:clip.kind,registerBody:request.value.registerBody!==false?'1':'',referenceForm,referenceBounds:library.bodyBounds[formName].join(','),base:clip.base?'files/resource/NPC/lamubone.swf':''},autoplay:'on',splashScreen:false,unmuteOverlay:'hidden',wmode:'transparent',allowScriptAccess:true,openUrlMode:'deny',logLevel:'error',preferredRenderer:'canvas'});
   if(current!==sequence)return;
   player.ruffle().volume=0;
   let tries=0,lastMask=0;
   timer=setInterval(()=>{
    try{
     // A suspended Ruffle timeline does not reliably service ExternalInterface.
     // Its loaded state remains valid; repeat the handshake and pixel mask
     // without asking the paused engine to run code.
     if(ready&&visible&&!poseSettling&&(pose.paused||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)){
      if(!requestAcknowledged)send('ready',{path:clip.path,sha256:clip.sha256});
      if(performance.now()-lastMask>600){lastMask=performance.now();sendMask();}
      return;
     }
     const state=call('previewStatus');
     if(state&&state.error){send('error',state.error);clearInterval(timer);return;}
     if(state&&state.ended){if(looping){call('previewSymbol',clip.symbol);lastPose=null;}else{send('finished');clearInterval(timer);}return;}
     if(state&&state.ready&&state.settled&&state.width>0){
      if(!ready){ready=true;try{apply();}catch(error){ready=false;throw error;}if(poseSettling)return;}
      poseSettling=false;
      // Pose selection recreates nested source timelines. Wait for the new
      // pose and actual outfit pixels before hiding the host's visible fallback.
      if(clip.kind==='outfit'&&!visible){const alpha=pixels();if(!alpha||!alpha.some(value=>value>32)){if(++tries>pollLimit){send('error','Source has no visible character');clearInterval(timer);}return;}}
      visible=true;
      tries=0;
      // Ready is an idempotent handshake. Repeat until the host acknowledges;
      // custom-protocol frames may become ready before their host listener.
      if(!requestAcknowledged)send('ready',{path:clip.path,sha256:clip.sha256});
      if(performance.now()-lastMask>600){lastMask=performance.now();sendMask();}
      try{send('state',JSON.parse(JSON.stringify(state)));}catch(error){window.originalStateError=String(error);send('diagnostic',{phase:'state',error:String(error)});}
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)player.ruffle().suspend();
     }else if(++tries>pollLimit){send('error','Source requires the full client');clearInterval(timer);}
    }catch(error){window.originalRuntimeError=String(error);send('diagnostic',{phase:'status',error:String(error)});if(++tries>pollLimit){send('error',String(error));clearInterval(timer);}}
   },150);
  }catch(error){if(current===sequence)send('error',String(error));}
 }
 addEventListener('message',event=>{
  if(event.source!==parent||!event.data||event.data.token!==token)return;
  if(event.data.type==='ram-original-load')load(event.data);
  if(event.data.type==='ram-original-ack'&&event.data.sequence===sequence){requestAcknowledged=true;}
  if(event.data.type==='ram-original-pose'&&event.data.sequence===sequence){pose=event.data.value;apply();}
 });
 send('boot');
 const initial=new URLSearchParams(location.search);if(initial.get('id'))load({sequence:1,value:{id:initial.get('id'),loop:initial.get('loop')==='1',registerBody:initial.get('registerBody')==='1',pose:{form:initial.get('form')||'level2',direction:'down',moving:false,color:(initial.get('color')||'0,-21,-255').split(',').map(Number),sound:false,volume:.45}}});
 document.addEventListener('visibilitychange',()=>{if(player)player.ruffle()[document.hidden||pose?.paused?'suspend':'resume']();});
 addEventListener('pagehide',()=>{clearInterval(timer);if(player)player.remove();});
})();

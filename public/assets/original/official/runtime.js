/* Offline original vectors. No application bridge or access to parent storage. */
(async function(){
 const token=new URLSearchParams(location.search).get('token');
 let player,ready=false,timer,lastPose,id,sequence=0,loading=false,pending,clip,looping,pose,requestAcknowledged=false;
 const manifest=fetch('manifest.json').then(response=>{if(!response.ok)throw Error('Manifest unavailable');return response.json()});
 const send=(type,value)=>parent.postMessage({type:'ram-original-'+type,token,id,sequence,value},'*');
 const call=(name,...args)=>player&&player.ruffle().callExternalInterface(name,...args);
 const maskCanvas=document.createElement('canvas');maskCanvas.width=100;maskCanvas.height=108;
 function pixels(){
  const canvas=player.shadowRoot.querySelector('canvas'),ctx=maskCanvas.getContext('2d',{willReadFrequently:true});
  if(!canvas||!ctx)return null;
  ctx.clearRect(0,0,100,108);ctx.drawImage(canvas,0,0,100,108);
  const rgba=ctx.getImageData(0,0,100,108).data,alpha=[];
  for(let i=3;i<rgba.length;i+=4)alpha.push(rgba[i]);return alpha;
 }
 function apply(){if(!ready)return;call('setBodyColor',...pose.color);if(!lastPose||lastPose.form!==pose.form||lastPose.direction!==pose.direction||lastPose.moving!==pose.moving)call('previewPose',pose.form,pose.direction,pose.moving);player.ruffle().volume=pose.sound?Math.max(0,Math.min(1,pose.volume??.45)):0;lastPose={...pose};player.ruffle()[pose.paused||document.hidden?'suspend':'resume']();}
 async function load(request){
  if(request.sequence<=sequence)return;
  if(loading){pending=request;return;}
  loading=true;ready=false;requestAcknowledged=false;clearInterval(timer);lastPose=null;
  sequence=request.sequence;id=request.value.id;pose=request.value.pose;looping=request.value.loop;
  try{
   clip=(await manifest).clips.find(row=>row.id===id);if(!clip)throw Error('Unknown source');
   if(clip.forms.length&&!clip.forms.includes(pose.form))throw Error('Unsupported form');
   if(!player){player=window.RufflePlayer.newest().createPlayer();window.player=player;document.body.append(player);}
   await player.ruffle().load({url:'controller.swf',parameters:{source:'files/'+clip.path,symbol:clip.symbol,form:pose.form,registerBody:request.value.registerBody?'1':'',referenceForm:request.value.referenceForm||pose.form,base:clip.base?'files/resource/NPC/lamubone.swf':''},autoplay:'on',splashScreen:false,unmuteOverlay:'hidden',wmode:'transparent',allowScriptAccess:true,openUrlMode:'deny',logLevel:'error',preferredRenderer:'canvas'});
   player.ruffle().volume=0;
   let tries=0,lastMask=0;
   timer=setInterval(()=>{
    try{
     // A suspended Ruffle timeline does not reliably service ExternalInterface.
     // Its loaded state remains valid; repeat the handshake and pixel mask
     // without asking the paused engine to run code.
     if(ready&&(pose.paused||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)){
      if(!requestAcknowledged)send('ready',{path:clip.path,sha256:clip.sha256});
      if(performance.now()-lastMask>600){lastMask=performance.now();send('mask',pixels());}
      return;
     }
     const state=call('previewStatus');
     if(state&&state.error){send('error',state.error);clearInterval(timer);return;}
     if(state&&state.ended){if(looping){call('previewSymbol',clip.symbol);lastPose=null;}else{send('finished');clearInterval(timer);}return;}
     if(state&&state.ready&&state.settled&&state.width>0){
      tries=0;
      if(!ready){ready=true;apply();}
      // Ready is an idempotent handshake. Repeat until the host acknowledges;
      // custom-protocol frames may become ready before their host listener.
      if(!requestAcknowledged)send('ready',{path:clip.path,sha256:clip.sha256});
      if(performance.now()-lastMask>600){lastMask=performance.now();send('mask',pixels());}
      send('state',state);
      if(matchMedia('(prefers-reduced-motion: reduce)').matches)player.ruffle().suspend();
     }else if(++tries>100){send('error','Source requires the full client');clearInterval(timer);}
    }catch(error){send('error',String(error));clearInterval(timer);}
   },150);
  }catch(error){send('error',String(error));}
  finally{loading=false;if(pending){const next=pending;pending=null;load(next);}}
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

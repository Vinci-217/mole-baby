/** Keep a ready, isolated AVM across room/desktop remounts. moveBefore preserves
 * the iframe's document; appendChild would silently reload its WASM and SWF. */
type MovableElement=HTMLElement&{moveBefore?:(node:Node,before:Node|null)=>void};
interface PlayerEntry{frame:HTMLIFrameElement;token:string;sequence:number;key:string;source:string;pose:unknown;ready:boolean}
export interface OriginalPlayerLease{
 frame:HTMLIFrameElement;token:string;reused:boolean;
 nextSequence:()=>number;
 update:(key:string,pose:unknown,ready:boolean)=>void;
 release:()=>void;
}
const parked:PlayerEntry[]=[];
let parking:HTMLElement|undefined;
const limit=2;
function parkingPlace(){
 if(!parking?.isConnected){parking=document.createElement('div');parking.hidden=true;parking.setAttribute('aria-hidden','true');parking.dataset.originalPlayerCache='true';document.body.append(parking)}
 return parking as MovableElement;
}
export function acquireOriginalPlayer(host:HTMLElement,key:string,source:string):OriginalPlayerLease{
 const target=host as MovableElement;
 let entry:PlayerEntry|undefined;
 if(target.moveBefore){
  const index=parked.findIndex(row=>row.key===key&&row.source===source&&row.frame.isConnected);
  if(index>=0){const candidate=parked.splice(index,1)[0];try{target.moveBefore(candidate.frame,null);entry=candidate}catch{candidate.frame.remove()}}
 }
 const reused=Boolean(entry);
 if(!entry){
  const frame=document.createElement('iframe'),token=Math.random().toString(36).slice(2);
  frame.className='official-clip-player';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.allow='autoplay';
  frame.src=source+`runtime.html?v=12&token=${token}`;
  entry={frame,token,sequence:0,key,source,pose:undefined,ready:false};host.append(frame);
 }
 const player=entry;let released=false;
 return {frame:player.frame,token:player.token,reused,
  nextSequence:()=>++player.sequence,
  update:(nextKey,pose,ready)=>{player.key=nextKey;player.pose=pose;player.ready=ready},
  release:()=>{
   if(released)return;released=true;player.frame.onload=null;
   player.frame.contentWindow?.postMessage({type:'ram-original-pose',token:player.token,sequence:player.sequence,value:{...(player.pose as object),paused:true,sound:false}},'*');
   if(player.ready&&target.moveBefore&&player.frame.isConnected){
    const place=parkingPlace();try{place.moveBefore!(player.frame,null);parked.push(player);while(parked.length>limit)parked.shift()!.frame.remove();return}catch{/* Older WebViews fall back to persisted pixels and normal source loading. */}
   }
   player.frame.remove();
  },
 };
}

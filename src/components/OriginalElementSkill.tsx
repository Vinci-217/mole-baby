import {useEffect,useRef} from 'react';
import {TRANSFORMATION_TARGET_START} from '../magic-box';
import type {RamForm} from '../original-actions';
import {originalElementClip,elementEffectRect,elementDecodedBytes} from '../element-playback';

export {originalElementClip};
// A few decoded atlases fit old 32-bit machines; playing all eighteen skills
// must not permanently retain every full-size transparent texture.
const images=new Map<string,{pages:Promise<HTMLImageElement[]>;ready:Promise<void>}>();
function cached(id:string){
 const clip=originalElementClip(id);if(!clip)throw new Error('Unknown original transformation');
 let entry=images.get(id);
 if(!entry){
  const pages=Promise.all(clip.pages.map(page=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.src=`./assets/original/element-skills/${id}/${page}`;void image.decode().then(()=>resolve(image),()=>reject(new Error('原版变身素材加载失败')))})));
  entry={pages,ready:pages.then(()=>undefined)};
  const current=entry;void entry.ready.catch(()=>{if(images.get(id)===current)images.delete(id)});
 }
 images.delete(id);images.set(id,entry);
 while(images.size>1&&(images.size>3||[...images.keys()].reduce((n,key)=>n+elementDecodedBytes(key),0)>64*1024*1024))images.delete(images.keys().next().value!);
 return entry;
}
export const preloadElementSkill=(id:string)=>cached(id).ready;
export const prepareElementSkill=preloadElementSkill;
const load=(id:string)=>cached(id).pages;
/** Plays every source frame at its original 24 fps. The shared smoke only
 * covers the swap; the target timeline starts once the first smoke clears. */
export default function OriginalElementSkill({id,startedAt,form='super'}:{id:string;startedAt:number;form?:RamForm}){
 const ref=useRef<HTMLCanvasElement>(null),clip=originalElementClip(id);
 useEffect(()=>{
  let live=true,request=0,previous=-1;
  void load(id).then(pages=>{
   const canvas=ref.current,ctx=canvas?.getContext('2d');if(!live||!canvas||!ctx||!clip)return;
   const paint=(now:number)=>{
    if(!live)return;
    const frame=Math.min(clip.frames-1,Math.max(0,Math.floor((now-startedAt-TRANSFORMATION_TARGET_START)*clip.fps/1000))),index=clip.frameMap[frame];
    if(previous!==frame){
     previous=frame;
     const [page,x,y,width,height,dx,dy]=clip.rectangles[index];
     ctx.clearRect(0,0,clip.width,clip.height);
     ctx.drawImage(pages[page],x,y,width,height,dx,dy,width,height);
     canvas.dataset.sourceFrame=String(frame+1);
    }
    request=requestAnimationFrame(paint);
   };request=requestAnimationFrame(paint);
  }).catch(()=>{});
  return()=>{live=false;cancelAnimationFrame(request)};
 },[id,startedAt,clip]);
 const rect=elementEffectRect(id,form);
 return clip&&rect?<canvas ref={ref} className="magic-box-layer original-element-skill" style={{left:`${rect.x}%`,top:`${rect.y/108*100}%`,width:`${rect.width}%`,height:'auto',transform:'none'}} data-element-skill={id} data-scale={clip.registration.scale} width={clip.width} height={clip.height} aria-label={`原版${clip.name}变身`}/>:null;
}

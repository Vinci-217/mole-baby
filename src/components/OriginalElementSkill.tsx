import {useEffect,useRef} from 'react';
import clips from '../../public/assets/original/element-skills/clips.json';
import {TRANSFORMATION_TARGET_START} from '../magic-box';

export const originalElementClip=(id:string)=>clips[id as keyof typeof clips];
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
 while(images.size>3)images.delete(images.keys().next().value!);
 return entry;
}
export const preloadElementSkill=(id:string)=>cached(id).ready;
export const prepareElementSkill=preloadElementSkill;
const load=(id:string)=>cached(id).pages;
/** Plays every source frame at its original 24 fps. The shared smoke only
 * covers the swap; the target timeline starts once the first smoke clears. */
export default function OriginalElementSkill({id,startedAt}:{id:string;startedAt:number}){
 const ref=useRef<HTMLCanvasElement>(null),clip=originalElementClip(id);
 useEffect(()=>{
  let live=true,request=0,previous=-1;
  void load(id).then(pages=>{
   const canvas=ref.current,ctx=canvas?.getContext('2d');if(!live||!canvas||!ctx||!clip)return;
   const paint=(now:number)=>{
    if(!live)return;
    const frame=Math.min(clip.frames-1,Math.max(0,Math.floor((now-startedAt-TRANSFORMATION_TARGET_START)*clip.fps/1000))),index=clip.frameMap[frame];
    if(previous!==frame){previous=frame;const cell=index%clip.pageFrames;ctx.clearRect(0,0,clip.cell,clip.cell);ctx.drawImage(pages[Math.floor(index/clip.pageFrames)],cell%clip.columns*clip.cell,Math.floor(cell/clip.columns)*clip.cell,clip.cell,clip.cell,0,0,clip.cell,clip.cell);canvas.dataset.sourceFrame=String(frame+1)}
    request=requestAnimationFrame(paint);
   };request=requestAnimationFrame(paint);
  }).catch(()=>{});
  return()=>{live=false;cancelAnimationFrame(request)};
 },[id,startedAt,clip]);
 return clip?<canvas ref={ref} className="magic-box-layer original-element-skill" data-element-skill={id} width={clip.cell} height={clip.cell} aria-label={`原版${clip.name}变身`}/>:null;
}

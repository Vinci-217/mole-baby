import {useEffect,useRef} from 'react';
import type {RamForm} from '../original-actions';
import {originalElementClip,elementEffectRect} from '../element-playback';
import {useDrawingSurface} from '../original-viewport';
import {DecodedAssetCache} from '../decoded-asset-cache';
import {loadAnimationImage} from '../animation-image';
import {isPlaybackVisible,onPlaybackVisibilityChange} from '../playback-visibility';

const images=new DecodedAssetCache<{pages:HTMLImageElement[];bytes:number}>(
 ()=> (window.mobile?24:64)*1024**2,asset=>asset.bytes);
function load(id:string){
 return images.get(id,async()=>{
  const clip=originalElementClip(id);if(!clip)throw new Error('原版变身素材不存在');
  const pages=await Promise.all(clip.pages.map(async page=>{
   const image=await loadAnimationImage(`./assets/original/element-skills/${id}/${page}`);
   await image.decode?.().catch(()=>{});
   return image;
  }));
  return {pages,bytes:pages.reduce((sum,image)=>sum+image.naturalWidth*image.naturalHeight*4,0)};
 });
}
export const prepareElementSkill=load;
/** Plays every source frame at its original 24 fps. The shared smoke only
 * covers the swap; the target timeline starts once the first smoke clears. */
export default function OriginalElementSkill({id,form='super',prepared,onEnd}:{id:string;form?:RamForm;prepared?:ReturnType<typeof load>;onEnd?:(success:boolean)=>void}){
 const ref=useRef<HTMLCanvasElement>(null),clip=originalElementClip(id);
 const end=useRef(onEnd);end.current=onEnd;
 const firstPaintReady=useDrawingSurface(ref,`${id}:${form}`);
 useEffect(()=>{
  let live=true,request=0,position=0,previous=-1,previousPose=-1,remaining=0,last:number|undefined;
  let resume=()=>{};
  const stopWatching=onPlaybackVisibilityChange(()=>resume());
  void (prepared??load(id)).then(({pages})=>{
   const canvas=ref.current,ctx=canvas?.getContext('2d');if(!live||!canvas||!ctx||!clip)return;
   const frameMs=1000/clip.fps;
   const paint=(now:number)=>{
    if(!live||!isPlaybackVisible())return;
    if(previous<0&&!firstPaintReady.current()){request=requestAnimationFrame(paint);return;}
    if(last!==undefined)remaining+=Math.min(now-last,frameMs);
    last=now;
    if(remaining>=frameMs){position++;remaining-=frameMs;}
    if(position===clip.frames){resume=()=>{};end.current?.(true);return;}
    const frame=position,index=clip.frameMap[frame];
    if(previousPose!==index){
     const [page,x,y,width,height,dx,dy]=clip.rectangles[index];
     ctx.clearRect(0,0,clip.width,clip.height);
     ctx.drawImage(pages[page],x,y,width,height,dx,dy,width,height);
     previousPose=index;
    }
    if(previous!==frame){previous=frame;canvas.dataset.sourceFrame=String(frame+1)}
    request=requestAnimationFrame(paint);
   };
   resume=()=>{cancelAnimationFrame(request);last=undefined;if(isPlaybackVisible())request=requestAnimationFrame(paint)};
   resume();
  }).catch(()=>{if(live)end.current?.(false)});
  return()=>{live=false;cancelAnimationFrame(request);stopWatching()};
 },[id,clip,prepared,firstPaintReady]);
 const rect=elementEffectRect(id,form);
 return clip&&rect?<canvas ref={ref} className="magic-box-layer original-element-skill" style={{left:`${rect.x}%`,top:`${rect.y/108*100}%`,width:`${rect.width}%`,height:'auto',transform:'none'}} data-element-skill={id} data-scale={clip.registration.scale} width={clip.width} height={clip.height} aria-label={`原版${clip.name}变身`}/>:null;
}

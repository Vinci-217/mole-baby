import {useEffect,useRef,useState,type ReactNode} from 'react'
import type {PetColor} from '../game'
import type {RamForm} from '../original-actions'
import {petColorOffsets} from '../pet-color'
import {loadUploadedClip,uploadedEffectRect,type UploadedSpec,type UploadedClip} from '../uploaded-actions'
import {createPetSoundClock} from '../pet-audio'
import {itemSoundScore,socialSoundScore} from '../pet-sound-score'
import type {ItemMotion} from '../item-motion'

type Painted={clip:UploadedClip;pages:HTMLCanvasElement[];bytes:number}
const cache=new Map<string,{ready:Promise<Painted>;bytes:number}>()
function raster(spec:UploadedSpec,color:PetColor){
 const key=`${spec.assetRoot??'uploaded-actions'}/${spec.assetKey}:${color}`,found=cache.get(key)
 if(found){cache.delete(key);cache.set(key,found);return found.ready}
 const entry={bytes:0,ready:Promise.resolve(null as unknown as Painted)}
 entry.ready=loadUploadedClip(spec).then(async clip=>{
  const offsets=petColorOffsets(color),deltas=[255,204,153].map(base=>offsets.map(v=>Math.max(0,Math.min(255,base+v))-base))
  const pages:HTMLCanvasElement[]=[]
  for(const page of clip.pages){
   const read=async(name:string)=>{const im=new Image();im.src=`./assets/original/${spec.assetRoot??'uploaded-actions'}/${spec.assetKey}/${name}`;await im.decode();return im}
   const[neutral,mask]=await Promise.all([read(page.neutral),read(page.mask)]),canvas=document.createElement('canvas');canvas.width=page.width;canvas.height=page.height
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('无法打开原版动作图集。')
   ctx.drawImage(neutral,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height)
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(mask,0,0);const m=ctx.getImageData(0,0,canvas.width,canvas.height).data
   for(let i=0;i<pixels.data.length;i+=4){pixels.data[i+3]=m[i+3];if(!(m[i]||m[i+1]||m[i+2]))continue;for(let c=0;c<3;c++)pixels.data[i+c]=Math.max(0,Math.min(255,pixels.data[i+c]+deltas[0][c]*m[i]/255+deltas[1][c]*m[i+1]/255+deltas[2][c]*m[i+2]/255))}
   ctx.putImageData(pixels,0,0);neutral.src='';mask.src='';pages.push(canvas)
  }
  entry.bytes=clip.pages.reduce((n,p)=>n+p.width*p.height*4,0)
  while(cache.size>1&&(cache.size>3||[...cache.values()].reduce((n,e)=>n+e.bytes,0)>64*1024*1024))cache.delete(cache.keys().next().value!)
  return {clip,pages,bytes:entry.bytes}
 }).catch(error=>{if(cache.get(key)===entry)cache.delete(key);throw error})
 cache.set(key,entry);return entry.ready
}
/** Every pose comes from the supplied SWF frame table. No live deformation,
 * prop interpolation, leaf replacement or ActionScript playback is involved. */
export default function UploadedLamuFrames({spec,form,color,fromColor,itemMotion,sound,onEnd,loop=false,limit,action,fallback}:{spec:UploadedSpec;form:RamForm;color:PetColor;fromColor?:PetColor;itemMotion?:ItemMotion;sound:boolean;fallback?:ReactNode;loop?:boolean;limit?:number;action?:string;onEnd?:(completed?:boolean)=>void}){
 const[ready,setReady]=useState(false)
 const ref=useRef<HTMLCanvasElement>(null),end=useRef(onEnd),voice=useRef(sound);end.current=onEnd;voice.current=sound
 useEffect(()=>{
  let live=true,frame=0,finished=false,firstPaint=false,deadline:ReturnType<typeof setTimeout>|undefined,redraw:(()=>void)|undefined;setReady(false);const media=matchMedia('(prefers-reduced-motion: reduce)')
  const finish=()=>{if(!live||finished)return;finished=true;cancelAnimationFrame(frame);audio?.stop();end.current?.(true)}
  const visibility=()=>{cancelAnimationFrame(frame);if(document.hidden)audio?.stop();else redraw?.()}
  document.addEventListener('visibilitychange',visibility)
  const audio=itemMotion?createPetSoundClock(itemSoundScore({...itemMotion,duration:spec.durationMs}),()=>voice.current):action?createPetSoundClock(socialSoundScore(action),()=>voice.current):null
  const prepared=Promise.all([raster(spec,color),fromColor&&fromColor!==color?raster(spec,fromColor):null])
  void prepared.then(([current,old])=>{
   if(!live)return;const began=performance.now(),canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return
   let lastSource=-1,lastPalette:Painted|undefined
   const draw=(now:number)=>{
    if(!live||finished||document.hidden)return
    const elapsed=Math.max(0,now-began),source=media.matches?0:Math.min(spec.frames-1,Math.floor((loop?elapsed%spec.durationMs:elapsed)*current.clip.fps/1000)),pose=current.clip.poses[current.clip.frameMap[source]],painted=old&&elapsed<spec.durationMs*.6?old:current
    if(source!==lastSource||painted!==lastPalette){
     ctx.clearRect(0,0,spec.width,spec.height)
     for(const[tile,x,y]of pose){const[page,sx,sy,w,h]=current.clip.rectangles[tile];ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalCompositeOperation='copy';ctx.drawImage(painted.pages[page],sx,sy,w,h,x,y,w,h);ctx.restore()}
     lastSource=source;lastPalette=painted
    }
    if(!firstPaint){firstPaint=true;setReady(true)}
    canvas.dataset.loaded='true';canvas.dataset.sourceFrame=String(source+1);canvas.dataset.loadedColor=painted===old?fromColor:color;audio?.tick(elapsed)
    if(limit!==undefined?elapsed>=limit:!loop&&elapsed>=spec.durationMs){finish();return}
    if(!media.matches||!loop||limit!==undefined)frame=requestAnimationFrame(draw)
   };redraw=()=>{frame=requestAnimationFrame(draw)};redraw()
   if(limit!==undefined||!loop)deadline=setTimeout(finish,limit??spec.durationMs)
  }).catch(()=>{if(live){if(ref.current)ref.current.dataset.failed='true';end.current?.(false)}})
  return()=>{live=false;cancelAnimationFrame(frame);clearTimeout(deadline);document.removeEventListener('visibilitychange',visibility);audio?.stop()}
 },[spec,color,fromColor,itemMotion,loop,limit,action])
 const rect=uploadedEffectRect(spec,form)
 return <>{!ready&&fallback}<canvas ref={ref} width={spec.width} height={spec.height} className={spec.assetRoot==='daily-frames'?'ram-classic-frame ram-daily-frame':'ram-uploaded-frame'} style={{visibility:ready?'visible':'hidden',position:'absolute',left:`${rect.x}%`,top:`${rect.y/108*100}%`,width:`${rect.width}%`,height:'auto',pointerEvents:'none'}} data-sheet={spec.assetRoot==='daily-frames'?'daily':'uploaded'} data-form={form} data-uploaded-id={spec.id} data-color={color} data-source-frames={spec.frames} aria-hidden="true"/></>
}

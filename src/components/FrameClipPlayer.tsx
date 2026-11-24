import {useEffect,useRef,useState,type ReactNode} from 'react'
import type {PetColor} from '../game'
import type {RamForm} from '../original-actions'
import {frameClipFolder,frameClipRect,type FrameClipSpec} from '../frame-clip-spec'
import {loadFrameClip} from '../frame-clips'
import {prepareFrameAtlases} from '../frame-atlases'
import {createPetSoundClock} from '../pet-audio'
import {itemSoundScore,socialSoundScore} from '../pet-sound-score'
import type {ItemMotion} from '../item-motion'
import {OFFICIAL_LOAD_TIMEOUT} from '../official-clips'
import {useDrawingSurface} from '../original-viewport'
import {isPlaybackVisible,onPlaybackVisibilityChange} from '../playback-visibility'
/** Every pose comes from the supplied SWF frame table. No live deformation,
 * prop interpolation, leaf replacement or ActionScript playback is involved. */
export default function FrameClipPlayer({spec,form,color,fromColor,itemMotion,sound,onEnd,onFirstPaint,placement,loop=false,limit,action,paused=false,playInReducedMotion=false,fallback}:{spec:FrameClipSpec;form:RamForm;color:PetColor;fromColor?:PetColor;itemMotion?:ItemMotion;sound:boolean;fallback?:ReactNode;loop?:boolean;limit?:number;action?:string;paused?:boolean;playInReducedMotion?:boolean;onEnd?:(completed?:boolean)=>void;onFirstPaint?:()=>void;placement?:{left:number;top:number;width:number}}){
 const[ready,setReady]=useState(false)
 const ref=useRef<HTMLCanvasElement>(null),end=useRef(onEnd),voice=useRef(sound);end.current=onEnd;voice.current=sound
 const firstPaintReady=useDrawingSurface(ref,`${frameClipFolder(spec)}:${form}`)
 const paint=useRef(onFirstPaint);paint.current=onFirstPaint
 const playback=useRef({paused,refresh:()=>{}});playback.current.paused=paused
 useEffect(()=>playback.current.refresh(),[paused])
 useEffect(()=>{
  const canvas=ref.current,context=canvas?.getContext('2d')
  if(!canvas||!context){end.current?.(false);return}
  delete canvas.dataset.loaded;delete canvas.dataset.loadedColor;delete canvas.dataset.sourceFrame
  delete canvas.dataset.failed;delete canvas.dataset.failureReason;setReady(false)
  const media=matchMedia('(prefers-reduced-motion: reduce)')
  let live=true,frame=0,finished=false,deadline:ReturnType<typeof setTimeout>|undefined,redraw:(()=>void)|undefined
  const finish=(completed=true)=>{if(!live||finished)return;finished=true;cancelAnimationFrame(frame);clearTimeout(deadline);audio?.stop();end.current?.(completed)}
  let lastTick:number|undefined
  const visibility=()=>{
   cancelAnimationFrame(frame);lastTick=undefined
   const visible=isPlaybackVisible()
   if(!visible||playback.current.paused)audio?.pause()
   if(visible)redraw?.()
  }
  playback.current.refresh=visibility
  const stopWatching=onPlaybackVisibilityChange(visibility)
  media.addEventListener('change',visibility)
  const audio=itemMotion?createPetSoundClock(itemSoundScore({...itemMotion,duration:spec.durationMs}),()=>voice.current):action?createPetSoundClock(socialSoundScore(action),()=>voice.current):null
  // Loading has its own budget. A slow decode must not consume the entire
  // reading/action duration before the first original frame is ever visible.
  deadline=setTimeout(()=>finish(false),OFFICIAL_LOAD_TIMEOUT)
  // Keep all original poses on mobile with a smaller backing atlas.
  const rasterScale=window.mobile ? .5 : 1
  const cycles=limit===undefined ? (loop?Infinity:1) : Math.max(1,Math.ceil(limit/spec.durationMs))
  void loadFrameClip(spec).then(async clip=>{
   if(!live||finished)return
   const [current,old]=await Promise.all([prepareFrameAtlases(clip.pages,color,rasterScale),
    fromColor&&fromColor!==color?prepareFrameAtlases(clip.pages,fromColor,rasterScale):null])
   if(!live||finished)return
   clearTimeout(deadline)
   let position=0,remaining=0,lastSource=-1,lastPose=-1,lastPalette:typeof current|undefined
   const frameMs=1000/clip.fps,totalFrames=spec.frames*cycles
   const draw=(now:number)=>{
    if(!live||finished||!isPlaybackVisible())return
    const firstFrame=lastSource===-1
    const held=playback.current.paused
    if(held&&!firstFrame)return
    if(firstFrame&&!firstPaintReady.current()){frame=requestAnimationFrame(draw);return}
    const reduced=media.matches&&!playInReducedMotion&&cycles===Infinity
    // A slow or hidden renderer cannot spend the remaining frames in one
    // callback. Advance at most one source frame per paint and hold the tail.
    if(lastTick!==undefined&&!reduced)remaining+=Math.min(now-lastTick,frameMs)
    lastTick=now
    if(remaining>=frameMs){position++;remaining-=frameMs}
    if(position>=totalFrames){finish();return}
    const source=reduced?0:position%spec.frames,elapsed=position*frameMs+remaining
    const poseIndex=clip.frameMap[source],painted=old&&elapsed<spec.durationMs*.6?old:current
    if(poseIndex!==lastPose||painted!==lastPalette){
     context.clearRect(0,0,spec.width,spec.height)
     for(const [tile,x,y] of clip.poses[poseIndex]){
      const [page,sx,sy,w,h]=clip.rectangles[tile]
      context.save()
      context.beginPath();context.rect(x,y,w,h);context.clip()
      context.globalCompositeOperation='copy'
      context.drawImage(painted[page],sx*rasterScale,sy*rasterScale,w*rasterScale,h*rasterScale,x,y,w,h)
      context.restore()
     }
     lastPose=poseIndex;lastPalette=painted
     canvas.dataset.loadedColor=painted===old?fromColor:color
    }
    if(source!==lastSource){lastSource=source;canvas.dataset.sourceFrame=String(source+1)}
    if(firstFrame){
     canvas.dataset.loaded='true';setReady(true);paint.current?.()
    }
    if(!held){audio?.tick(elapsed);if(!reduced)frame=requestAnimationFrame(draw)}
   }
   redraw=()=>{frame=requestAnimationFrame(draw)};visibility()
  }).catch(error=>{
   if(!live||finished)return
   canvas.dataset.failed='true';canvas.dataset.failureReason=error instanceof Error?error.message:String(error)
   finish(false)
  })
  return()=>{live=false;playback.current.refresh=()=>{};cancelAnimationFrame(frame);clearTimeout(deadline);stopWatching();media.removeEventListener('change',visibility);audio?.stop()}
 },[spec,color,fromColor,itemMotion,loop,limit,action,playInReducedMotion,firstPaintReady])
 const rect=frameClipRect(spec,form)
 const layout=placement??{left:rect.x,top:rect.y/108*100,width:rect.width}
 return <>{!ready&&fallback}<canvas ref={ref} width={spec.width} height={spec.height} className={placement?'room-furniture-frame':spec.assetRoot==='daily-frames'?'ram-classic-frame ram-daily-frame':'ram-uploaded-frame'} style={{visibility:ready?'visible':'hidden',position:'absolute',left:`${layout.left}%`,top:`${layout.top}%`,width:`${layout.width}%`,height:'auto',pointerEvents:'none'}} data-sheet={spec.assetRoot==='daily-frames'?'daily':'uploaded'} data-form={form} data-source-form={spec.form} data-uploaded-id={spec.id} data-color={color} data-source-frames={spec.frames} aria-hidden="true"/></>
}

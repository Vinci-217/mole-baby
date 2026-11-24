import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import type {FrameClipSpec} from '../frame-clip-spec';
import type {OfficialClip} from '../official-clips';
import type {RamForm} from '../original-actions';
import type {PetColor} from '../pet-color';
import FrameClipPlayer from './FrameClipPlayer';
import OfficialRamClip from './OfficialRamClip';

interface StudyShot {
 id:string;
 clip:OfficialClip;
 form:RamForm;
 frames?:FrameClipSpec;
}

/** Keep the last original pose on screen until the next source can take over. */
export default function StudyPlayback({shot,bodyForm,color,paused,sound,gameSound,volume,fallback,onPainted,onEnd}:{
 shot:StudyShot;bodyForm:RamForm;color:PetColor;paused:boolean;sound:boolean;gameSound:boolean;volume:number;
 fallback:ReactNode;onPainted?:()=>void;onEnd?:(completed?:boolean)=>void;
}){
 const [shown,setShown]=useState<StudyShot>();
 const current=shown?.id===shot.id;
 const paint=useRef(onPainted);paint.current=onPainted;
 useLayoutEffect(()=>{
  if(current&&!paused)paint.current?.();
 },[current,paused,shot.id]);
 return <>
  {!shown&&fallback}
  {(shown&&!current?[shown,shot]:[shot]).map(layer=>{
   const incoming=layer.id===shot.id;
   const visible=layer.id===shown?.id;
   const playing=incoming&&visible&&!paused;
   const ready=incoming?()=>setShown(layer):undefined;
   const end=incoming?onEnd:undefined;
   return <span key={layer.id} className="ram-study-shot" data-study-shot={layer.id} data-study-visible={visible} data-source={layer.clip.path} aria-hidden={!visible}
    style={{opacity:visible?1:0}}>
    {layer.frames
     ?<FrameClipPlayer spec={layer.frames} form={layer.form} color={color} paused={!playing} sound={playing&&sound}
       playInReducedMotion onFirstPaint={ready} onEnd={end}/>
     :<OfficialRamClip clip={layer.clip} form={layer.form} bodyForm={bodyForm} color={color} finite paused={!playing}
       sound={playing&&gameSound} volume={volume} playInReducedMotion onReady={ready} onEnd={end} fallback={null}/>}
   </span>;
  })}
 </>;
}

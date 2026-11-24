import {useMemo,useState,type ReactNode} from 'react';
import type {OfficialClip} from '../official-clips';
import {OFFICIAL_DURATION} from '../official-clips';
import type {RamForm} from '../original-actions';
import type {PetColor} from '../pet-color';
import OfficialRamClip from './OfficialRamClip';
import SharedMagicBox from './SharedMagicBox';

/** Prepare the source once, hold its clock, then play between two smoke clouds. */
export default function OfficialTransformation({clip,form,bodyForm=form,color,startedAt,sound,volume,children,onEnd,onSubject}:{clip:OfficialClip;form:RamForm;bodyForm?:RamForm;color:PetColor;startedAt:number;sound:boolean;volume:number;children:ReactNode;onEnd?:(completed?:boolean)=>void;onSubject?:(subject:string)=>void}){
 const [playing,setPlaying]=useState(false);
 const [completed,setCompleted]=useState<boolean|null>(null);
 const load=useMemo(()=>{let resolve!:()=>void,reject!:(reason:Error)=>void;const ready=new Promise<void>((yes,no)=>{resolve=yes;reject=no});return {ready,resolve,reject}},[]);
 return <SharedMagicBox startedAt={startedAt} form={bodyForm} prepare={load.ready} targetDuration={OFFICIAL_DURATION} targetCompletion={completed}
  onSubject={onSubject} onTargetPlaying={setPlaying} onEnd={onEnd} label={`烟雾变身 · ${clip.name} · 恢复原形`}
  target={<OfficialRamClip clip={clip} form={form} bodyForm={bodyForm} color={color} finite playInReducedMotion paused={!playing} sound={playing&&sound} volume={volume}
    onEnd={result=>setCompleted(result!==false)}
    onReady={load.resolve} onError={()=>load.reject(new Error('原版变身素材加载失败'))} fallback={children}/>}
 >{children}</SharedMagicBox>;
}

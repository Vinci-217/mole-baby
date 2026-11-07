import {useCallback,useMemo,useState,type ReactNode} from 'react';
import type {OfficialClip} from '../official-clips';
import {OFFICIAL_DURATION} from '../official-clips';
import type {RamForm} from '../original-actions';
import type {PetColor} from '../pet-color';
import OfficialRamClip from './OfficialRamClip';
import SharedMagicBox from './SharedMagicBox';

/** Prepare the source once, hold its clock, then play between two smoke clouds. */
export default function OfficialTransformation({clip,form,color,startedAt,sound,volume,children,onEnd}:{clip:OfficialClip;form:RamForm;color:PetColor;startedAt:number;sound:boolean;volume:number;children:ReactNode;onEnd?:(completed?:boolean)=>void}){
 const [visible,setVisible]=useState(false);
 const load=useMemo(()=>{let resolve!:()=>void,reject!:(reason:Error)=>void;const ready=new Promise<void>((yes,no)=>{resolve=yes;reject=no});return {ready,resolve,reject}},[]);
 const subject=useCallback((value:string)=>setVisible(value==='box'),[]);
 return <SharedMagicBox startedAt={startedAt} prepare={load.ready} targetDuration={OFFICIAL_DURATION} onSubject={subject} onEnd={onEnd} label={`烟雾变身 · ${clip.name} · 恢复原形`} target={<OfficialRamClip clip={clip} form={form} color={color} paused={!visible} sound={visible&&sound} volume={volume} onReady={load.resolve} onError={()=>load.reject(new Error('原版变身素材加载失败'))} fallback={children}/>}>{children}</SharedMagicBox>;
}

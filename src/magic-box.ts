import runtime from '../public/assets/generated/magic-box/runtime.json';
import visibility from '../electron/edge-visibility.json';
import type {RamForm} from './original-actions';

export const MAGIC_BOX_DURATION=runtime.durationMs;
export const MAGIC_BOX_TIMELINE=runtime.timeline;
export function transformationTimeline(targetDuration:number){return [...MAGIC_BOX_TIMELINE.slice(0,17),{subject:'box',smoke:null,box:0,ms:targetDuration},...MAGIC_BOX_TIMELINE.slice(22)]}
export const TRANSFORMATION_TARGET_START=1520;
export function magicBoxFrame(elapsed:number,timeline=MAGIC_BOX_TIMELINE){
 let cursor=0;
 for(let index=0;index<timeline.length;index++){
  cursor+=timeline[index].ms;
  if(elapsed<cursor)return index;
 }
 return timeline.length-1;
}
export const magicBoxImage=(kind:'box'|'smoke',index:number)=>`./assets/generated/magic-box/${kind}/${String(index+1).padStart(2,'0')}.png`;

/** All four box frames share this alpha envelope in their 288px source.
 * Match the visible box to this pet's body, rather than applying 160% to every
 * growth form. Keep a fixed scale and floor throughout the transformation. */
export function magicBoxRect(form:RamForm){
 const body=visibility.forms[form].body,k=(body[2]-body[0])/145;
 return {x:(body[0]+body[2])/2-143.5*k,y:body[3]-226*k,width:288*k,height:288*k};
}

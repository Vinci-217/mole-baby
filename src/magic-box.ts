import runtime from '../public/assets/generated/magic-box/runtime.json';

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

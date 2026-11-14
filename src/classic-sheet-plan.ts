import {getRamActionDuration,sampleRamPose,sampleFlyingPose} from './components/ram-animation';
import {usesGroundedPose} from './grounded-motion';
import {isDragForm,type DragForm} from './drag-poses';
import type {RamForm} from './original-actions';

export type ClassicSheet='classic'|'care'|'item'|'grounded'|'slumber'|'yawn'|'affection'|'drag'|'gentle'|'football';
/** Load the sheets this performance can actually paint. Resting should never
 * wait for unrelated eating, washing, sleeping and dragging atlases. */
export function classicSheetPlan(form:RamForm,action:string,gentle=false):ClassicSheet[]{
 if(gentle)return ['gentle'];
 if(action==='drag'&&isDragForm(form))return ['drag'];
 const sheets=new Set<ClassicSheet>();
 const duration=getRamActionDuration(action,form)??8000;
 const sample=['senior','super','water','wood','fire'].includes(form)?sampleFlyingPose:sampleRamPose;
 for(const reduced of [false,true])for(let time=0;time<=duration+100;time+=100){
  const pose=sample(action,time,reduced,form);
  sheets.add(pose.sheet!=='slumber'&&pose.sheet!=='yawn'&&usesGroundedPose(form,action)?'grounded':pose.sheet??'classic');
 }
 if(action==='pet')sheets.add('affection');
 return [...sheets].sort();
}

export const canPreloadDrag=(form:RamForm):form is DragForm=>isDragForm(form);

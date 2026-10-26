import data from '../public/assets/original/drag/runtime.json'
export type DragForm='junior'|'middle'
export const isDragForm=(form:string):form is DragForm=>form==='junior'||form==='middle'
export function dragSpec(form:DragForm){return data.forms[form]}
/** Junior keeps its source cycle. Middle samples a signed spring deformation:
 * the body can squeeze on reversal and recoil after the cursor has stopped. */
export function sampleDragPose(form:DragForm,view:number,distance:number,reduced=false,strain=0){
 const direction=reduced?'down':view<-.66?'left':view<-.18?'leftdown':view>.66?'right':view>.18?'rightdown':'down'
 const spec=dragSpec(form),clip=spec.clips[direction]
 let phase=reduced||Math.abs(view)<.05?0:Math.floor(Math.max(0,distance)/4)%clip.frameCount
 if(form==='middle'){
  const shape=data.forms.middle.deformation,value=reduced||!Number.isFinite(strain)?0:strain
  phase=Math.max(0,Math.min(clip.frameCount-1,Math.round((value-shape.min)/shape.step)))
 }
 const index=clip.frameMap[phase]
 return {index,row:Math.floor(index/8),frame:index%8,direction,phase,...spec.poses[index]}
}

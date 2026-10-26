import data from '../public/assets/original/drag/runtime.json'
export type DragForm='junior'|'middle'
export const isDragForm=(form:string):form is DragForm=>form==='junior'||form==='middle'
export function dragSpec<F extends DragForm>(form:F):(typeof data.forms)[F]{return data.forms[form]}
/** The same original body phase for both forms; middle carries baked leaf bindings. */
export function sampleDragPose(form:DragForm,view:number,distance:number,reduced=false){
 const direction=reduced?'down':view<-.66?'left':view<-.18?'leftdown':view>.66?'right':view>.18?'rightdown':'down'
 const spec=dragSpec(form),clip=spec.clips[direction],phase=reduced||Math.abs(view)<.05?0:Math.floor(Math.max(0,distance)/4)%clip.frameCount
 const index=clip.frameMap[phase]
 return {index,row:Math.floor(index/8),frame:index%8,direction,phase,...spec.poses[index]}
}

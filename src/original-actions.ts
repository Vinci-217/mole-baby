import football from '../public/assets/original/football/runtime.json'
import slumber from '../public/assets/original/slumber/source.json'
import type {Evolution,Stage} from './game'

export type RamForm='seed'|'junior'|'middle'|'senior'|Evolution
export function ramForm(stage:Stage,evolution?:Evolution):RamForm {
  return stage===0?'seed':stage===1?'junior':stage===2?'middle':stage===3?'senior':evolution??'super'
}
export function footballSpec(form:string) {
  return Object.hasOwn(football.forms,form)?football.forms[form as keyof typeof football.forms]:undefined
}
export function footballDuration(form:string):number|undefined {
  const spec=footballSpec(form)
  return spec?spec.frameCount/football.fps*1000:undefined
}
/** Original source frames advance once at 24fps. The body and ball are already
 * in the SAME source image, so separate interpolation cannot break contact. */
export function footballPose(form:string,elapsed:number,reduced=false) {
  const spec=footballSpec(form)
  if(!spec)throw new Error('This growth stage has no original football clip')
  const index=reduced?spec.reducedFrame-1:Math.min(spec.frameCount-1,Math.max(0,Math.floor(elapsed*football.fps/1000)))
  return {frame:spec.frameMap[index],sourceFrame:index+1,nearBall:spec.nearBallFrames[index],finished:elapsed>=spec.frameCount/football.fps*1000}
}
export function footballContacts(form:string):number[] {
  return footballSpec(form)?.contacts.map(frame=>(frame-1)/football.fps*1000)??[]
}
/** A small original mouth shape opens, pauses, then closes during each breath. */
export function slumberFrame(elapsed:number,reduced=false):number {
  if(reduced)return 0
  const phase=Math.max(0,elapsed)%4800
  if(phase<650||phase>=2850)return 0
  if(phase<1550)return Math.min(6,Math.floor((phase-650)/150)+1)
  if(phase<1850)return 6
  return Math.max(0,6-Math.floor((phase-1850)/145))
}
export function slumberMouth(form:RamForm):readonly number[] {
  const point=slumber.forms[form].mouthPoint
  return form==='seed'?[26.56+point[0]*.5,17.31+point[1]*.476]:point
}

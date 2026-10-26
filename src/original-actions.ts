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
  const phase=Math.max(0,elapsed)%6400
  if(phase<1100||phase>=4400)return 0
  const breath=Math.sin((phase-1100)/3300*Math.PI)
  return Math.round(breath*breath*7)
}
/** One finite yawn at sleep entry, then a quiet mouth-only breathing cycle.
 * Sleeping does not repeatedly yawn or move its pot/body registration. */
export function sleepPose(elapsed:number,reduced=false):{sheet:'yawn'|'slumber';row:number;frame:number;finished:false} {
  if(reduced)return {sheet:'slumber',row:0,frame:0,finished:false}
  const t=Math.max(0,elapsed)
  if(t<2400){
    const open=t<350?0:t<1150?Math.sin((t-350)/800*Math.PI/2):t<1450?1:t<2250?Math.cos((t-1450)/800*Math.PI/2):0
    return {sheet:'yawn',row:0,frame:Math.round(open*open*7),finished:false}
  }
  return {sheet:'slumber',row:0,frame:slumberFrame(t-2400),finished:false}
}
export function slumberMouth(form:RamForm):readonly number[] {
  const point=slumber.forms[form].mouthPoint
  return form==='seed'?[26.56+point[0]*.5,17.31+point[1]*.476]:point
}

export function slumberEmitter(form:RamForm):readonly number[] {
  const point=slumber.forms[form].snorePoint
  return form==='seed'?[26.56+point[0]*.5,17.31+point[1]*.476]:point
}

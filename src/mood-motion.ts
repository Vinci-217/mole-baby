import {dozyDuration} from './original-actions'
import emotions from '../public/assets/original/emotions/runtime.json'
export type Emotion='joy'|'grumpy'
interface EmotionFramesSpec {rows:number;frameCount:number;frameMap:number[];sourceFrames:number[];reducedFrame:number;viewport?:number[]}
const forms:Record<string,Record<Emotion,EmotionFramesSpec>>=emotions.forms;
export function emotionSpec(form:string,emotion:Emotion) {
  return Object.hasOwn(forms,form)?forms[form][emotion]:undefined
}
export const emotionViewport=(form:string,emotion:Emotion)=>emotionSpec(form,emotion)?.viewport??[0,0,192,208];
export function isEmotionClip(action:string):action is 'mood-joy'|'mood-grumpy' {return action==='mood-joy'||action==='mood-grumpy'}
export function isMoodAction(action:string) {return isEmotionClip(action)||action==='mood-content'||action==='mood-dozy'}
export function emotionDuration(action:string,form:string):number|undefined {
  if(action==='mood-content')return 3600
  if(action==='mood-dozy')return dozyDuration(form)
  if(!isEmotionClip(action))return undefined
  if(form==='seed')return action==='mood-joy'?2200:2800
  const spec=emotionSpec(form,action==='mood-joy'?'joy':'grumpy')
  return spec?spec.frameCount/24*1000:undefined
}
export function emotionPose(form:string,action:string,elapsed:number,reduced=false) {
  const spec=emotionSpec(form,action==='mood-joy'?'joy':'grumpy')
  if(!spec)throw new Error('No original emotion clip for this stage')
  const index=Math.min(spec.frameCount-1,Math.max(0,Math.floor(elapsed/1000*24)))
  return {frame:reduced?spec.reducedFrame:spec.frameMap[index],sourceFrame:spec.sourceFrames[index],finished:elapsed>=spec.frameCount/24*1000}
}

import {dozyDuration} from './original-actions'
import emotions from '../public/assets/original/emotions/runtime.json'
export type Emotion='joy'|'grumpy'
export function emotionSpec(form:string,emotion:Emotion) {
  return Object.hasOwn(emotions.forms,form)?emotions.forms[form as keyof typeof emotions.forms][emotion]:undefined
}
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

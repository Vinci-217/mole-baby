import index from '../public/assets/original/uploaded-actions/index.json'
import visibility from '../electron/edge-visibility.json'
import {getItem} from './catalog'
import {getItemMotion} from './item-motion'
import {isOfficialAction,officialClip,supportsOfficial} from './official-clips'
import type {RamForm} from './original-actions'
import {playToolForm,playToolSource} from './original-play-tools'
import {originalCareClip} from './original-care'

export interface UploadedSpec{assetRoot?:string;form:string;id:string;assetKey:string;frames:number;durationMs:number;width:number;height:number;registration:{scale:number;cssPixelsPerAtlasPixel:number;displayScale?:number;centerX:number;baseY:number}}
export interface UploadedClip extends UploadedSpec{fps:number;frameMap:number[];poses:number[][][];rectangles:number[][];pages:{neutral:string;mask:string;width:number;height:number}[]}
const specs=index as unknown as Record<string,UploadedSpec>
const loaders={...import.meta.glob('../public/assets/original/uploaded-actions/*/clip.json',{import:'default'}),...import.meta.glob('../public/assets/original/daily-frames/*/clip.json',{import:'default'})}
export const UPLOADED_TOYS=[
 {id:'180004',name:'原版踢足球'},
 {id:'180011',name:'逗逗拉姆 · 一'},
 {id:'180012',name:'逗逗拉姆 · 二'},
 {id:'180013',name:'逗逗拉姆 · 三'},
 {id:'180023',name:'魔法弹簧'},
 {id:'180026',name:'乐刷刷'},
 {id:'tuya1',name:'彩色涂鸦 · 一'},
 {id:'tuya2',name:'彩色涂鸦 · 二'},
 {id:'tuya3',name:'彩色涂鸦 · 三'},
 {id:'tuya4',name:'彩色涂鸦 · 四'},
]as const
export const isUploadedAction=(action:string)=>action.startsWith('uploaded-')&&UPLOADED_TOYS.some(t=>action===`uploaded-${t.id}`)
export const uploadedSpec=(form:string,id:string)=>specs[`${form}-${id}`]
export function uploadedMotion(form:string,action:string,itemId?:string):UploadedSpec|undefined{
 const tool=playToolSource(action,itemId);
 if(tool)return form==='seed'?undefined:uploadedSpec(playToolForm(form as RamForm),tool);
 const care=originalCareClip(form as RamForm,action,itemId);
 if(care)return uploadedSpec(playToolForm(form as RamForm),care.path.split('/').at(-1)!.replace(/\.swf$/,''));
 // A menu/source ID and an uploaded ID must use the same complete local
 // frames. Do not boot a new SWF engine when this exact form is already rastered.
 const source=isOfficialAction(action)?officialClip(action.replace(/^(official-|ambient-)/,'')):undefined
 if(source?.kind==='care'){
  const id=source.path.split('/').at(-1)!.replace(/\.swf$/,'');
  if(supportsOfficial(source,form as RamForm))return uploadedSpec(form,id);
  // These later forms already select the classic original care source in the
  // menu. Play its complete export at the requested body's size instead of
  // booting a SWF engine for that same fallback. Growth data never changes.
  if(source.level===101&&['super','water','wood','fire'].includes(form))return uploadedSpec('classic',id);
 }
 if(action.startsWith('uploaded-'))return uploadedSpec(form,action.slice(9))
 if(action==='play-alone')return uploadedSpec(form,'180004')
 if(!itemId||!(['feed','eat','drink','wash','use','medical'].includes(action)||getItemMotion(itemId).action===action))return
 const item=getItem(itemId);return item?uploadedSpec(form,item.changesColor?'180005':item.id==='energy-drink'?'180014':item.animationIds?.includes(itemId)?itemId:item.sourceId):undefined
}
export function uploadedEffectRect(spec:UploadedSpec,form:RamForm){
 const sourceBody=visibility.forms[spec.form as RamForm]?.body,targetBody=visibility.forms[form].body;
 const ratio=sourceBody?(targetBody[2]-targetBody[0])/(sourceBody[2]-sourceBody[0]):1;
 const r=spec.registration,k=r.cssPixelsPerAtlasPixel*(r.displayScale??1)*ratio
 return {x:50-r.centerX*k,y:visibility.forms[form].body[3]-r.baseY*k,width:spec.width*k,height:spec.height*k}
}
export async function loadUploadedClip(spec:UploadedSpec):Promise<UploadedClip>{
 const loader=loaders[`../public/assets/original/${spec.assetRoot??'uploaded-actions'}/${spec.assetKey}/clip.json`]
 if(!loader)throw new Error('这段原版动作还没有准备好。')
 return {...await loader()as UploadedClip,assetKey:spec.assetKey}
}

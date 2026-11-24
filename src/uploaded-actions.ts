import index from '../public/assets/original/uploaded-actions/index.json'
import type {FrameClipSpec} from './frame-clip-spec'
import {getItem} from './catalog'
import {getItemMotion} from './item-motion'
import {isOfficialAction,officialClip,originalActionForms,supportsOfficial} from './official-clips'
import type {RamForm} from './original-actions'
import {playToolClip,playToolSource} from './original-play-tools'
import {originalCareClip} from './original-care'

const specs: Record<string,FrameClipSpec> = index
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
export function uploadedMotion(form:string,action:string,itemId?:string):FrameClipSpec|undefined{
 const tool=playToolSource(action,itemId);
 if(tool){
  const forms=originalActionForms[form as RamForm];
  const clip=forms&&playToolClip(form as RamForm,action,itemId);
  const target=clip&&forms.find(candidate=>supportsOfficial(clip,candidate));
  return target?uploadedSpec(target,tool):undefined;
 }
 const care=originalCareClip(form as RamForm,action,itemId);
 if(care){
  const sourceForm=originalActionForms[form as RamForm]?.find(candidate=>supportsOfficial(care,candidate));
  return sourceForm&&uploadedSpec(sourceForm,care.path.split('/').at(-1)!.replace(/\.swf$/,''));
 }
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

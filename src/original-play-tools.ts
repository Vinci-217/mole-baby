import {getItem} from './catalog';
import {isOfficialAction,officialClip,OFFICIAL_CLIPS,supportsOfficial} from './official-clips';
import type {RamForm} from './original-actions';

/** The archived page-game pet2/pet3/pet4/pet101 timelines, not costume cues. */
export const PLAY_TOOLS=[['180004','足球'],['180011','逗逗一'],['180012','逗逗二'],['180013','逗逗三'],['180023','弹簧'],['180026','乐刷刷'],['180097','泡泡糖'],['tuya1','涂鸦一'],['tuya2','涂鸦二'],['tuya3','涂鸦三'],['tuya4','涂鸦四']] as const;
const sources=new Set<string>(PLAY_TOOLS.map(([id])=>id));
export const playToolForm=(form:RamForm):RamForm=>['classic','super','water','wood','fire'].includes(form)?'classic':form;
export function playToolSource(action:string,itemId?:string):string|undefined{
 if(action==='play'||action==='play-alone')return '180004';
 const clip=isOfficialAction(action)?officialClip(action.replace(/^(official-|ambient-)/,'')):undefined;
 const source=clip?.kind==='care'?clip.path.split('/').at(-1)!.replace(/\.swf$/,''):action.startsWith('uploaded-')?action.slice(9):undefined;
 if(source&&sources.has(source))return source;
 if(itemId&&getItem(itemId)?.category==='toy'&&['use','play','feed'].includes(action)){
  const id=getItem(itemId)!.sourceId;return sources.has(id)?id:undefined;
 }
}
export function playToolClip(form:RamForm,action:string,itemId?:string){
 const source=playToolSource(action,itemId),target=playToolForm(form);
 if(!source||form==='seed')return;
 return OFFICIAL_CLIPS.find(clip=>clip.kind==='care'&&clip.path.endsWith('/'+source+'.swf')&&supportsOfficial(clip,target));
}

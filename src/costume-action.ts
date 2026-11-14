import type {RamForm} from './original-actions';
import {getItem} from './catalog';
import {getItemMotion,getItemMotionByAction,type ItemMotion} from './item-motion';
import {officialClip,isOfficialAction,type OfficialClip,OFFICIAL_DURATION} from './official-clips';
import {isSocialAction,SOCIAL_DURATIONS} from './social-motion';
import {getRamActionDuration} from './components/ram-animation';

export type CostumeActionKind='native'|'social'|'care'|'toy'|'emotion'|'natural'|'school'|'transform';
export interface CostumeAction {
 action:string;
 kind:CostumeActionKind;
 /** null denotes a persistent state, not a missing completion callback. */
 duration:number|null;
 motion?:ItemMotion;
 toy?:string;
 natural?:'rest'|'snack'|'write'|'music'|'clean'|'study'|'think';
 clip?:OfficialClip;
 elementId?:string;
}
const native=new Set(['idle','waiting','still','drag','peek','hide','walk-left','walk-right','running','running-left','running-right']);
const needs=new Set(['sick','hungry','thirsty','dirty','sad','tired']);
const careDefaults:Record<string,string>={feed:'biscuit',eat:'biscuit',drink:'juice',wash:'180003',use:'180005',medical:'180005'};
const toys:Record<string,number>={'180004':4200,'180011':4400,'180012':4400,'180013':4400,'180023':4800,'180026':5400,'180097':5500,tuya1:6000,tuya2:6000,tuya3:6000,tuya4:6000};
const naturals:Record<string,NonNullable<CostumeAction['natural']>>={'0':'rest','1':'think','2':'write','3':'music','4':'snack','5':'think','6':'clean','7':'rest','8':'think','9':'music','10':'write','11':'think','12':'study','13':'write','14':'study','15':'study','16':'write','17':'think','18':'think','19':'think','20':'study'};
/** Every costume uses the same adapter. No ordinary action changes its rig,
 * growth form or saved clothes. Only explicit magic replaces the appearance. */
export function costumeAction(action:string,form:RamForm,itemId?:string):CostumeAction {
 const base={action};
 if(native.has(action))return {...base,kind:'native',duration:null};
 if(needs.has(action))return {...base,kind:'emotion',duration:null};
 if(action==='sleep')return {...base,kind:'emotion',duration:null};
 if(action.startsWith('element-'))return {...base,kind:'transform',duration:getRamActionDuration(action,form),elementId:action.slice(8)};
 if(action==='spell'||action==='skill-magic')return {...base,kind:'transform',duration:getRamActionDuration(action,form)};
 const clip=isOfficialAction(action)?officialClip(action.replace(/^(official-|ambient-)/,'')):undefined;
 if(clip&&['magic','transform','skill'].includes(clip.kind))return {...base,kind:'transform',duration:OFFICIAL_DURATION,clip};
 const careRequest=clip?.kind==='care'||Object.hasOwn(careDefaults,action)||Boolean(getItemMotionByAction(action))||action.startsWith('original-use-')||action==='drink-custom-color';
 const activeItem=careRequest?itemId:undefined;
 const source=clip?.path.split('/').at(-1)?.replace(/\.swf$/,'')??(action.startsWith('uploaded-')?action.slice(9):undefined);
 const toy=source&&Object.hasOwn(toys,source)?source:activeItem&&getItem(activeItem)?.category==='toy'?getItem(activeItem)!.sourceId:undefined;
 if(toy)return toy==='180004'?{action:'play',kind:'social',duration:SOCIAL_DURATIONS.play}:{...base,kind:'toy',toy,duration:toys[toy]??4400};
 const id=activeItem??(clip?.kind==='care'?source:undefined)??careDefaults[action];
 const motion=id?getItem(id)?.category==='toy'?undefined:getItemMotion(id):getItemMotionByAction(action);
 if(motion?.itemId)return {...base,kind:'care',duration:motion.duration,motion};
 if(action==='play-alone')return {action:'play',kind:'social',duration:SOCIAL_DURATIONS.play};
 if(action==='read-alone')return {action:'focus',kind:'social',duration:18000};
 if(isSocialAction(action))return {...base,kind:'social',duration:action==='focus'?null:SOCIAL_DURATIONS[action]};
 if(action.startsWith('school-')||action==='restaurant'||action.startsWith('skill-'))return {...base,kind:'school',duration:getRamActionDuration(action,form)};
 if(clip?.kind==='school')return {...base,kind:'natural',duration:4800,natural:naturals[source??'']??'think'};
 if(['mood-joy','mood-grumpy','mood-content','mood-dozy','happy','waving','reward','catch','failed','review','wake'].includes(action))return {...base,kind:'emotion',duration:getRamActionDuration(action,form)??2400};
 // Unknown/legacy action IDs still produce a bounded, visible gesture. They
 // cannot strand the renderer or expose the pet's unrelated bare form.
 return {...base,kind:'natural',natural:'think',duration:getRamActionDuration(action,form)??3000};
}

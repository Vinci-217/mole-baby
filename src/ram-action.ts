import {isOfficialAction,officialClip} from './official-clips';

/** Resolve interruptions before choosing artwork, timers or clothing. */
export function normalizeRamAction(action:string,stage:number){
 const clip=isOfficialAction(action)?officialClip(action.replace(/^(official-|ambient-)/,'')):undefined;
 return clip?.kind==='care'&&clip.path.endsWith('/180004.swf')&&stage>0?'play':action.startsWith('ambient-element-')?action.slice(8):action;
}
export function effectiveRamAction({action='idle',stage,sleeping=false,shaking=false,dragging=false}:{action?:string;stage:number;sleeping?:boolean;shaking?:boolean;dragging?:boolean}){
 if(sleeping||action==='sleep')return 'sleep';
 if(shaking||action==='dizzy')return 'dizzy';
 if(dragging)return 'drag';
 return normalizeRamAction(action,stage);
}

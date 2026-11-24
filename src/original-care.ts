import {getItem} from './catalog';
import {getItemMotionByAction} from './item-motion';
import {OFFICIAL_CLIPS,isOfficialAction,officialClip,originalActionForms,supportsOfficial} from './official-clips';
import type {RamForm} from './original-actions';

const defaults:Record<string,string>={feed:'biscuit',eat:'biscuit',drink:'juice',wash:'180003',medical:'180005',use:'180005'};
// Some archive entries retain only an icon or omit the middle-form movie.
// Borrow the closest complete original timeline of the SAME form only when
// the exact food source is missing. Save and consumed item IDs stay intact.
const sharedFoodSources:Record<string,string>={'180067':'180020','180068':'180021','180071':'180070','180073':'180002'};
/** Resolve the consumed item independently of a costume's cosmetic form.
 * A stale item ID must never turn a drag, pet or idle pose into another meal. */
export function careItemId(action:string,itemId?:string):string|undefined{
 const source=isOfficialAction(action)?officialClip(action.replace(/^(official-|ambient-)/,'')):undefined;
 const motion=getItemMotionByAction(action);
 const requested=source?.kind==='care'?source.path.split('/').at(-1)!.replace(/\.swf$/,''):motion?.itemId??(action.startsWith('original-use-')?action.slice(13):defaults[action]);
 if(!requested)return;
 const id=itemId??requested,item=getItem(id);
 return item&&item.category!=='toy'&&!item.changesColor?id:undefined;
}
export function originalCareClip(form:RamForm,action:string,itemId?:string,variant=0){
 const id=careItemId(action,itemId),item=getItem(id);if(!item)return;
 const sources=id&&item.animationIds?.includes(id)?[id]:item.animationIds??[item.id==='energy-drink'?'180014':item.sourceId];
 const shared=sharedFoodSources[item.sourceId];
 for(const target of originalActionForms[form]??[]){
  const find=(source:string)=>OFFICIAL_CLIPS.find(clip=>clip.kind==='care'&&clip.path.endsWith('/'+source+'.swf')&&supportsOfficial(clip,target));
  const clips=sources.map(find).filter(clip=>clip!==undefined);
  if(clips.length)return clips[Math.abs(Math.floor(Number.isFinite(variant)?variant:0))%clips.length];
  if(shared){const clip=find(shared);if(clip)return clip;}
 }
}

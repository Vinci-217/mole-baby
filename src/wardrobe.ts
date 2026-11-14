import {getStage,type GameState,type CareResult} from './game'
import {MAGIC_WAND_ID,hasMagicDiploma} from './course-rewards'
import {OFFICIAL_CLIPS,ORIGINAL_OUTFITS,officialClip,officialOutfitForm} from './official-clips'
import {ramForm,type RamForm} from './original-actions'
import type {Stage,Evolution} from './game'
import {OUTFIT_PRICE} from './economy'
import {playToolSource} from './original-play-tools'
import {originalCareClip} from './original-care'

/** Original accessory graphics. Names and prices are this desktop adaptation. */
export const OUTFITS=[
  {id:'party-cap',name:'庆生小帽',sourceId:'1200008',price:80},
  {id:'gold-feather',name:'金色羽毛',sourceId:'1200018',price:80},
  {id:'wizard-cap',name:'紫色魔法帽',sourceId:'1200020',price:80},
  {id:'star-wand',name:'魔法法杖',sourceId:'1200021',price:80},
  {id:'magic-book',name:'魔法书',sourceId:'1200026',price:80},
  {id:'rabbit-hood',name:'粉兔帽',sourceId:'1200033',price:80},
  {id:'leaf-hood',name:'火焰羽翼',sourceId:'1200036',price:80},
  {id:'sport-goggles',name:'彩虹眼罩',sourceId:'1200047',price:80},
  {id:'warm-scarf',name:'皇冠猫耳',sourceId:'1200052',price:80},
  {id:'flower-crown',name:'鲜花花冠',sourceId:'1200006',price:80},
  {id:'knight-shield',name:'骑士盾牌',sourceId:'1200024',price:80},
  {id:'angel-wings',name:'天使羽翼',sourceId:'1200040',price:80},
] as const
export type OutfitId=typeof OUTFITS[number]['id']|`original-${string}`
export interface Outfit {id:OutfitId;name:string;sourceId:string;price:number;clipId?:string;iconPath?:string}
export const ALL_OUTFITS:readonly Outfit[]=[...OUTFITS,...ORIGINAL_OUTFITS.map(row=>({...row,id:row.id as OutfitId}))].map(outfit=>({...outfit,price:OUTFIT_PRICE}))
const outfitsById=new Map(ALL_OUTFITS.map(outfit=>[outfit.id as string,outfit]));
const clipsBySource=new Map(OFFICIAL_CLIPS.filter(clip=>clip.kind==='outfit').map(clip=>[clip.path.split('/').at(-1)?.replace(/\.swf$/,''),clip]));
export const getOutfit=(id?:string)=>id?outfitsById.get(id):undefined;
export function outfitAnimation(id?:string){
 const outfit=getOutfit(id);return outfit?.clipId?officialClip(outfit.clipId):outfit?clipsBySource.get(outfit.sourceId):undefined;
}
/** Missing source actions are adapted on the intact costume, never by
 * selecting another growth form. Explicit magic hides it only inside smoke. */
export const outfitSupportsAction=(action:string)=>action.length>0;
export type CostumeFamily='junior-accessory'|'junior-costume'|'form-costume'|'form-accessory';
/** Shared by the scene, desktop, inventory preview and movement. This resolves
 * an appearance only; it never changes the pet's growth or saved costume. */
export function costumePlayback(stage:Stage,evolution?:Evolution,id?:string,action='idle'){
 const actualForm=ramForm(stage,evolution),outfit=getOutfit(id),source=outfitAnimation(id);
 const dressedForm=stage>0&&source&&outfitSupportsAction(action)?officialOutfitForm(source,actualForm):undefined;
 const form=dressedForm??actualForm,clip=dressedForm?source:undefined;
 const appearance:{stage:Stage;evolution?:Evolution;form:RamForm}={form,stage:form==='seed'?0:form==='junior'?1:form==='middle'?2:form==='senior'?3:4,...(['classic','super','water','wood','fire'].includes(form)?{evolution:form as Evolution}:{})};
 const family:CostumeFamily=source?.clothingLayer===45?'junior-accessory':source?.clothingLayer===65?'junior-costume':source?.clothingLayer===75?'form-costume':'form-accessory';
 return {outfit,clip,appearance,actualForm,family};
}
export const costumeAppearance=(stage:Stage,evolution?:Evolution,id?:string)=>costumePlayback(stage,evolution,id).appearance;
export const petAppearance=(pet:Pick<GameState,'growth'|'evolution'|'wearing'>)=>costumeAppearance(getStage(pet.growth,pet.evolution),pet.evolution,pet.wearing);
export const petActionAppearance=(pet:Pick<GameState,'growth'|'evolution'|'wearing'>,action:string,itemId?:string)=>{
 const stage=getStage(pet.growth,pet.evolution),original=playToolSource(action,itemId)||originalCareClip(ramForm(stage,pet.evolution),action,itemId);
 return costumePlayback(stage,pet.evolution,original?undefined:pet.wearing,action).appearance;
};
export function normalizeWardrobe(owned:unknown,wearing:unknown):{wardrobe?:OutfitId[];wearing?:OutfitId} {
  const wardrobe=Array.isArray(owned)?ALL_OUTFITS.filter(outfit=>owned.includes(outfit.id)).map(outfit=>outfit.id):[]
  const current=getOutfit(typeof wearing==='string'?wearing:undefined)
  return {...(wardrobe.length?{wardrobe}:{}),...(current&&wardrobe.includes(current.id)?{wearing:current.id}:{})}
}
export function buyOutfit(pet:GameState,id:string):CareResult {
  const outfit=getOutfit(id)
  if(!outfit)return {state:pet,ok:false,message:'这件装扮暂时找不到。'}
  if(outfit.id===MAGIC_WAND_ID)return {state:pet,ok:false,message:'魔法法杖是魔法课结业奖励，不能购买。'}
  if(pet.wardrobe?.includes(outfit.id))return {state:pet,ok:false,message:'衣橱里已经有这一件啦。'}
  if(pet.coins<outfit.price)return {state:pet,ok:false,message:'摩尔豆还不够，再一起攒一点吧。'}
  return {state:{...pet,coins:pet.coins-outfit.price,wardrobe:[...(pet.wardrobe??[]),outfit.id]},ok:true,message:`${outfit.name}收进衣橱啦，试试看吧。`}
}
export function wearOutfit(pet:GameState,id?:string):CareResult {
  if(id&&getStage(pet.growth,pet.evolution)===0)return {state:pet,ok:false,message:'种子期还不能穿戴装扮，长成初级拉姆后再来试试吧。'}
  if(id===MAGIC_WAND_ID&&!hasMagicDiploma(pet))return {state:pet,ok:false,message:'完成魔法课后才能领取和佩戴魔法法杖。'}
  const outfit=getOutfit(id)
  if(id&&(!outfit||!pet.wardrobe?.includes(outfit.id)))return {state:pet,ok:false,message:'先把这件装扮收进衣橱吧。'}
  const clip=outfitAnimation(id)
  if(clip&&!officialOutfitForm(clip,ramForm(getStage(pet.growth,pet.evolution),pet.evolution)))return {state:pet,ok:false,message:'这件装扮暂时没有可用的原版角色动作。'}
  if(id===pet.wearing)return {state:pet,ok:false,message:'现在就是这个样子啦。'}
  const state={...pet};if(outfit)state.wearing=outfit.id;else delete state.wearing
  return {state,ok:true,message:outfit?`戴好${outfit.name}啦！`:'装扮收好啦，还是熟悉的小拉姆。'}
}

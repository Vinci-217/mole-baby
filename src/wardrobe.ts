import type {GameState,CareResult} from './game'
import {MAGIC_WAND_ID,hasMagicDiploma} from './course-rewards'

/** Original accessory graphics. Names and prices are this desktop adaptation. */
export const OUTFITS=[
  {id:'party-cap',name:'庆生小帽',sourceId:'1200008',price:30,width:.52,x:-.12,y:0},
  {id:'gold-feather',name:'金色羽毛',sourceId:'1200018',price:45,width:.44,x:.32,y:0},
  {id:'wizard-cap',name:'紫色魔法帽',sourceId:'1200020',price:60,coversCrown:true,width:.82,x:.12,y:0},
  {id:'star-wand',name:'魔法法杖',sourceId:'1200021',price:0,width:.6,x:0,y:0},
  {id:'magic-book',name:'魔法书',sourceId:'1200026',price:60,width:.6,x:0,y:0},
  {id:'rabbit-hood',name:'粉兔帽',sourceId:'1200033',price:55,coversCrown:true,width:.6,x:0,y:0},
  {id:'leaf-hood',name:'火焰羽翼',sourceId:'1200036',price:55,coversCrown:true,width:.6,x:0,y:0},
  {id:'sport-goggles',name:'彩虹眼罩',sourceId:'1200047',price:45,width:.6,x:0,y:0},
  {id:'warm-scarf',name:'皇冠猫耳',sourceId:'1200052',price:50,coversCrown:true,width:.6,x:0,y:0},
] as const
export type OutfitId=typeof OUTFITS[number]['id']
export function outfitCoversCrown(id?:string){const outfit=getOutfit(id);return Boolean(outfit&&'coversCrown'in outfit&&outfit.coversCrown)}
export const getOutfit=(id?:string)=>OUTFITS.find(outfit=>outfit.id===id)
export function normalizeWardrobe(owned:unknown,wearing:unknown):{wardrobe?:OutfitId[];wearing?:OutfitId} {
  const wardrobe=Array.isArray(owned)?OUTFITS.filter(outfit=>owned.includes(outfit.id)).map(outfit=>outfit.id):[]
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
  if(id===MAGIC_WAND_ID&&!hasMagicDiploma(pet))return {state:pet,ok:false,message:'完成魔法课后才能领取和佩戴魔法法杖。'}
  const outfit=getOutfit(id)
  if(id&&(!outfit||!pet.wardrobe?.includes(outfit.id)))return {state:pet,ok:false,message:'先把这件装扮收进衣橱吧。'}
  if(id===pet.wearing)return {state:pet,ok:false,message:'现在就是这个样子啦。'}
  const state={...pet};if(outfit)state.wearing=outfit.id;else delete state.wearing
  return {state,ok:true,message:outfit?`戴好${outfit.name}啦！`:'装扮收好啦，还是熟悉的小拉姆。'}
}

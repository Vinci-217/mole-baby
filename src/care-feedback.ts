import {petColorName} from './pet-color';
import { getItem, type GameState } from './game'
export interface CareGain { key:string; label:string; amount?:number; image:string }
export interface CareFeedbackData { id:number; petId:number; gains:CareGain[] }
const NEEDS = [
  ['hunger','饱食','icon-food'],['thirst','水分','icon-water'],['cleanliness','清洁','icon-clean'],['happiness','心情','icon-happy'],['health','健康','status-health'],['energy','精力','icon-clock'],
] as const
/** Only the item's actual, capped change. Natural growth is never an item XP reward. */
export function careGains(before:GameState,after:GameState,itemId:string):CareGain[] {
  const item=getItem(itemId)
  if(!item||before.createdAt!==after.createdAt)return []
  if(item.changesColor)return before.color===after.color?[]:[{key:'color',label:`变为${petColorName(after.color)}`,image:item.image}]
  return NEEDS.flatMap(([key,label,icon])=>{
    const amount=Math.round(after.stats[key])-Math.round(before.stats[key])
    return (item[key]??0)>0&&amount>0?[{key,label,amount,image:`./assets/original/ui/${icon}.png`}]:[]
  })
}

/** A completed game's receipt follows the real capped save changes. */
export function gameGains(before:GameState,after:GameState):CareGain[] {
 if(before.createdAt!==after.createdAt)return []
 const coins=after.coins-before.coins,happiness=Math.round((after.stats.happiness-before.stats.happiness)*10)/10
 return [...(coins>0?[{key:'coins',label:'摩尔豆',amount:coins,image:'./assets/original/ui/icon-medal.png'}]:[]),...(happiness>0?[{key:'happiness',label:'心情',amount:happiness,image:'./assets/original/ui/icon-happy.png'}]:[])]
}

/** Rapid single clicks commit inventory immediately. If the current care clip
 * is replaced, collect its receipt into the next completion, once per pet. */
export function mergeCareFeedback(previous:CareFeedbackData|null,next:CareFeedbackData):CareFeedbackData {
 if(!previous||previous.petId!==next.petId)return next
 const gains=previous.gains.map(g=>({...g}))
 for(const gain of next.gains){const existing=gains.find(g=>g.key===gain.key);if(existing&&existing.amount!==undefined&&gain.amount!==undefined)existing.amount+=gain.amount;else if(existing)Object.assign(existing,gain);else gains.push({...gain})}
 return {...next,gains}
}

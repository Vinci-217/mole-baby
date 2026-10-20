import { COLORS, getItem, type GameState } from './game'
export interface CareGain { key:string; label:string; amount?:number; image:string }
export interface CareFeedbackData { id:number; petId:number; gains:CareGain[] }
const NEEDS = [
  ['hunger','饱食','icon-food'],['thirst','水分','icon-water'],['cleanliness','清洁','icon-clean'],['happiness','心情','icon-happy'],['health','健康','status-health'],
] as const
/** Only the item's actual, capped change. Natural growth is never an item XP reward. */
export function careGains(before:GameState,after:GameState,itemId:string):CareGain[] {
  const item=getItem(itemId)
  if(!item||before.createdAt!==after.createdAt)return []
  if(item.changesColor)return before.color===after.color?[]:[{key:'color',label:`变为${COLORS.find(c=>c.id===after.color)!.name}`,image:item.image}]
  return NEEDS.flatMap(([key,label,icon])=>{
    const amount=Math.round(after.stats[key])-Math.round(before.stats[key])
    return item[key]>0&&amount>0?[{key,label,amount,image:`./assets/original/ui/${icon}.png`}]:[]
  })
}

import type {PetStats} from './game';

export const STATUS_FIELDS: readonly [keyof PetStats,string][] = [
 ['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],
 ['happiness','心情'],['health','健康'],['energy','精力'],
];
// The simulation and help text share these values so rules cannot drift.
export const NEED_RATES = {
 awake: {hunger:2.5,thirst:3,happiness:1.5,cleanliness:1.75,energy:2},
 asleep: {hunger:1.5,thirst:1.5,happiness:.5,cleanliness:.75,energy:-600},
} as const;
export const HEALTH_RECOVERY_PER_HOUR = 2;
export const HEALTH_LOSS_PER_HOUR = 6;

export interface NeedRequirement {key:keyof PetStats;minimum:number;exclusive?:boolean}
export const ACTIVITY_REQUIREMENTS:readonly NeedRequirement[]=[
 {key:'health',minimum:35},{key:'energy',minimum:30},
 {key:'hunger',minimum:25},{key:'thirst',minimum:25},
];
export const RESTAURANT_ENERGY_COST=2;
// 23 covers the two-point start cost and two minutes of natural decay
// without crossing the automatic sleep threshold before the shift ends.
export const RESTAURANT_REQUIREMENTS:readonly NeedRequirement[]=ACTIVITY_REQUIREMENTS.map(rule=>rule.key==='energy'?{...rule,minimum:23}:rule);
export const PLAY_REQUIREMENTS:readonly NeedRequirement[]=[
 {key:'health',minimum:35,exclusive:true},{key:'energy',minimum:30},
 {key:'hunger',minimum:30},{key:'thirst',minimum:30},{key:'cleanliness',minimum:30},
];
export function unmetNeedReason(stats:PetStats,requirements:readonly NeedRequirement[]):string|null{
 for(const {key,minimum,exclusive} of requirements){
  if(exclusive?stats[key]>minimum:stats[key]>=minimum)continue;
  const label=STATUS_FIELDS.find(([field])=>field===key)![1];
  const remedy=key==='energy'?'睡一会儿恢复':key==='hunger'?'先喂食':key==='thirst'?'先喝水':key==='cleanliness'?'先清洁':'先照料身体';
  return `${label}${exclusive?'需要大于':'至少需要'} ${minimum} 点（当前 ${Math.floor(stats[key]*10)/10} 点），${remedy}后再来。`;
 }
 return null;
}

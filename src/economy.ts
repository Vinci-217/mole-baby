/** Desktop companion balance. Source-client prices remain in originalPrice. */
export const INITIAL_BEANS=1000;
export const OUTFIT_PRICE=80,FURNITURE_PRICE=80,CROSS_PRICE=400;
export const FIRST_GAME_BEANS=500;
export const JOB_BEANS_PER_SECOND=1;
export interface RewardRound {id:string;activeMs:number}
export interface GamePrize {kind:'item'|'outfit'|'furniture';id:string;name:string;image:string;amount:1}
export interface GameRewards {firstDay?:string;rounds:string[]}
export function carePrice(item:{id:string;category:string;changesColor?:unknown;hunger:number;thirst:number;cleanliness:number;happiness:number;health:number;energy?:number}):number{
 if(item.category==='toy')return 0;
 if(item.id==='180006')return CROSS_PRICE;
 if(item.changesColor)return 80;
 const restored=item.hunger+item.thirst+item.cleanliness+item.happiness+item.health+(item.energy??0);
 return Math.max(10,Math.min(80,Math.ceil(restored/10)*5));
}
/** A solved short round has a ten-second minimum, long rounds cap at a minute. */
export function gameBeans(score:number,activeMs=30_000):number{
 if(!Number.isFinite(score)||score<=0||!Number.isFinite(activeMs)||activeMs<0)return 0;
 const points=Math.min(10,Math.floor(score)),seconds=Math.max(10,Math.min(60,activeMs/1000));
 return Math.floor((100+50*points)*seconds/30);
}
export function normalizeGameRewards(value:unknown,today:string):GameRewards|undefined{
 if(!value||typeof value!=='object')return;
 const raw=value as Partial<GameRewards>;
 const firstDay=typeof raw.firstDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.firstDay)&&raw.firstDay<=today?raw.firstDay:undefined;
 const rounds=Array.isArray(raw.rounds)?[...new Set(raw.rounds.filter((id):id is string=>typeof id==='string'&&id.length>0&&id.length<=120))].slice(-80):[];
 return {rounds,...(firstDay?{firstDay}:{})};
}

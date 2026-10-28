import {getStage,STAGES,GROWTH_STAGE_HOURS,GROWTH_MAX,type GameState} from './game';

/** Remaining time means healthy, awake time; needs and sleep can
 * extend the wall-clock date. Keep the estimate consistent with simulation. */
export function growthProgress(pet:GameState){
 const stage=getStage(pet.growth,pet.evolution),complete=pet.growth>=GROWTH_MAX;
 const next=complete?null:STAGES[stage+1];
 const fraction=next?Math.max(0,Math.min(1,(pet.growth-STAGES[stage].threshold)/(next.threshold-STAGES[stage].threshold))):1;
 const remainingHours=complete?0:(1-fraction)*GROWTH_STAGE_HOURS[stage as 0|1|2|3];
 let paused:string|null=null;
 if(pet.growthLocked)paused='固定形态中，成长已暂停；切换自动成长可继续。';
 else if(pet.sleeping)paused='正在睡觉，醒来后继续成长。';
 else if(pet.stats.hunger<=35||pet.stats.thirst<=35||pet.stats.happiness<=35||pet.stats.cleanliness<=30||pet.stats.energy<=25)paused='状态不足，照料好后继续成长。';
 return {stage,next,complete,percent:fraction*100,remainingHours,paused};
}
export function growthTimeLabel(hours:number){
 const minutes=Math.max(0,Math.ceil(hours*60-1e-7)),days=Math.floor(minutes/1440),rest=minutes%1440,h=Math.floor(rest/60),m=rest%60;
 return [days?`${days}天`:'',h?`${h}小时`:'',m?`${m}分钟`:''].filter(Boolean).join(' ')||'0分钟';
}

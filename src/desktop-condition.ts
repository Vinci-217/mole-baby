import type {GameState} from './game';
import {activityName} from './pet-school';

/** Concrete needs take precedence over the companion's emotional description. */
export function desktopCondition(pet:GameState,moodLabel:string){
 if(pet.sleeping)return{id:'sleeping',label:'睡梦中 · 叫醒',attention:false};
 if(pet.activity)return{id:'activity',label:pet.activity.kind==='course'?`${activityName(pet.activity)} · 学习中`:'餐厅打工中',attention:false};
 if(pet.outing)return{id:'outing',label:'外出中 · 等我回来',attention:false};
 // Match the existing need/mood thresholds. Rank simultaneous needs by their
 // deficit so an almost-low cleanliness value cannot hide genuine exhaustion.
 const needs=[
  {id:'hungry',value:pet.stats.hunger,minimum:30,label:'肚子饿了'},
  {id:'thirsty',value:pet.stats.thirst,minimum:30,label:'口渴了'},
  {id:'dirty',value:pet.stats.cleanliness,minimum:30,label:'需要清洁'},
  {id:'sad',value:pet.stats.happiness,minimum:40,label:pet.stats.happiness<30?'有点难过':'心情有点低落'},
  {id:'tired',value:pet.stats.energy,minimum:45,label:'精神不足'},
 ].filter(need=>need.value<need.minimum).sort((a,b)=>a.value/a.minimum-b.value/b.minimum);
 if(pet.stats.health<=35)needs.unshift({id:'sick',value:pet.stats.health,minimum:35,label:'生病了'});
 if(needs.length)return{id:needs[0].id,label:needs.map(need=>need.label).join(' · '),attention:true};
 return{id:'healthy',label:moodLabel,attention:false};
}

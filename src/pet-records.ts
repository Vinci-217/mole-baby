import type {GameState,PetStats} from './game';
export interface PetNote {id:string;text:string;done:boolean;createdAt:number}
export interface StatChange {at:number;reason:string;delta:Partial<PetStats>}
const fields=['hunger','thirst','cleanliness','happiness','health','energy'] as const;
export function normalizeNotes(value:unknown):PetNote[]{
 if(!Array.isArray(value))return [];
 const ids=new Set<string>();
 return value.slice(0,40).flatMap(note=>{
  if(!note||typeof note.id!=='string'||note.id.length>80||ids.has(note.id)||typeof note.text!=='string'||!note.text.trim()||!Number.isSafeInteger(note.createdAt)||note.createdAt<0)return [];
  ids.add(note.id);return [{id:note.id,text:note.text.slice(0,240),done:note.done===true,createdAt:note.createdAt}];
 });
}
export function normalizeStatHistory(value:unknown):StatChange[]{
 if(!Array.isArray(value))return [];
 return value.slice(-40).flatMap(row=>{
  if(!row||!Number.isSafeInteger(row.at)||row.at<0||typeof row.reason!=='string'||!row.delta||typeof row.delta!=='object')return [];
  const delta:Partial<PetStats>={};
  for(const key of fields)if(typeof row.delta[key]==='number'&&Number.isFinite(row.delta[key])&&Math.abs(row.delta[key])<=100&&row.delta[key]!==0)delta[key]=row.delta[key];
  return Object.keys(delta).length?[{at:row.at,reason:row.reason.slice(0,100),delta}]:[];
 });
}
/** Bound history in the existing save. Coalesce periodic ticks so interaction
 * records remain readable and the v1 save stays below its validation limit. */
export function recordStatChange(before:GameState,after:GameState,reason:string,at=Date.now()):GameState{
 if(before.createdAt!==after.createdAt)return after;
 if(reason==='自然消耗与休息'&&before.activity&&!after.activity&&after.lastTick>=before.activity.endsAt)reason=before.activity.kind==='restaurant'?'餐厅工作完成与日常消耗':'课程完成与日常消耗';
 const delta:Partial<PetStats>={};
 for(const key of fields){const d=Math.round((after.stats[key]-before.stats[key])*1000)/1000;if(d)delta[key]=d;}
 if(!Object.keys(delta).length)return after;
 const history=[...(after.statHistory??before.statHistory??[])],last=history.at(-1);
 if(reason==='自然消耗与休息'&&last?.reason===reason&&at-last.at<15*60000){
  const combined:Partial<PetStats>={};for(const key of fields){const d=Math.round(((last.delta[key]??0)+(delta[key]??0))*1000)/1000;if(d)combined[key]=d;}
  history[history.length-1]={at,reason,delta:combined};
 }else history.push({at,reason:reason.slice(0,100),delta});
 return {...after,statHistory:history.slice(-40)};
}

import type {TimerDirection} from './use-rest-reminder';
export const MOBILE_FOCUS_KEY='ramu-android-focus-v1';
export interface MobileFocus {petId:number;startedAt:number;deadline:number;direction:TimerDirection;plannedMinutes:number}
export const focusReminderId=(session:Pick<MobileFocus,'petId'|'startedAt'>)=>`focus:${session.petId}:${session.startedAt}`;
export function parseMobileFocus(raw:string|null,petId:number|undefined,minutes:number,direction:TimerDirection,now=Date.now()):MobileFocus|null{
  if(!raw||petId===undefined)return null;
  try{const value=JSON.parse(raw) as MobileFocus;
    if(value.petId!==petId||value.direction!==direction||value.plannedMinutes!==minutes||!Number.isInteger(minutes)||minutes<1||minutes>240||!Number.isSafeInteger(value.startedAt)||value.startedAt>now||!Number.isSafeInteger(value.deadline)||value.deadline!==value.startedAt+minutes*60000||now-value.deadline>86400000)return null;
    return value;
  }catch{return null;}
}

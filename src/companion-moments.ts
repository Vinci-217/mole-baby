import type {CompanionMemory} from './companion-memory'
export function timerMemoryDetail(minutes:number):string {
 const duration=Number.isInteger(minutes)&&minutes>=1&&minutes<=240?minutes:40
 return `我们约好的${duration}分钟计时结束了。`
}
/** Count surviving, completed timer events on the user's local day only. */
export function todaysTimers(memory:CompanionMemory,now=Date.now()):{count:number;minutes:number} {
 const date=new Date(now),seen=new Set<string>();let count=0,minutes=0
 for(const event of memory.events){
  if(event.kind!=='reminder'||event.at>now||seen.has(event.id)||new Date(event.at).toDateString()!==date.toDateString())continue
  const match=/^我们约好的(\d{1,3})分钟计时结束了。$/.exec(event.detail),duration=match?Number(match[1]):0
  if(duration<1||duration>240)continue
  seen.add(event.id);count++;minutes+=duration
 }
 return {count,minutes}
}

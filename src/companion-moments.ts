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
export function timerMemoryReply(memory:CompanionMemory,now=Date.now()):string {
 const today=todaysTimers(memory,now)
 return today.count?`今天我们一起等完了${today.count}段计时，约好的${today.minutes}分钟都走完啦。接下来想歇一会儿，还是和我聊两句？`:'今天还没有一起等完的计时。想开始时点一下小钟就好，我会安静陪着你。'
}

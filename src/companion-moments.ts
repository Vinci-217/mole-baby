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

/** Read surviving completed-game records; never turn a menu visit or an
 * abandoned round into a shared adventure. Forgetting needs no extra cache. */
export function gameMemoryReply(memory:CompanionMemory,query:string,now=Date.now()):string|null {
 if(!/(?:玩过什么|玩了什么|玩过哪些|刚才.*(?:玩|游戏|寻宝)|(?:记得|上次|最近).*(?:玩|游戏|寻宝)|(?:寻宝|游戏|玩耍).*(?:记得|哪里|在哪|回忆)|(?:我们|一起).*(?:玩过|玩了|玩的是))/.test(query))return null
 const kind=['寻宝','翻翻乐','拍拍乐','采果','拼拼乐','接果子'].find(name=>query.includes(name))
 const event=memory.events.filter(e=>e.kind==='game'&&e.at<=now&&(!kind||e.detail.includes(kind))).sort((a,b)=>b.at-a.at)[0]
 return event?`记得呀，${event.detail}和你一起找找看、玩一会儿，就是值得收好的小事。`:'还没有记下这次一起玩的经历。下次进小屋时，我们一起挑个喜欢的游戏吧。'
}

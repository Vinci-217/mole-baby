import {describe,it,expect,vi,afterEach} from 'vitest'
import {createPet} from './game'
import {createMemory,recordEvent,forgetEvent,localReply,buildMessages} from './companion-memory'
import {timerMemoryDetail,todaysTimers,timerMemoryReply} from './companion-moments'
import {presenceCandidates} from './companion-presence'
const now=new Date(2026,9,21,14,0).getTime(),pet=createPet('小芽','red',now-86400000)
afterEach(()=>vi.useRealTimers())
describe('real shared timer moments',()=>{
 it('counts completed timers today, ignoring cancelled, old, future, duplicate and malformed records',()=>{let m=createMemory(pet);for(const [kind,detail,at] of [['reminder',timerMemoryDetail(25),now-60000],['reminder',timerMemoryDetail(10),now-120000],['cancel',timerMemoryDetail(40),now],['reminder',timerMemoryDetail(30),now-86400000],['reminder',timerMemoryDetail(20),now+1000],['reminder','我们约好的999分钟计时结束了。',now]] as const)m=recordEvent(m,{kind,detail,at});m.events.push(m.events[0]);expect(todaysTimers(m,now)).toEqual({count:2,minutes:35});expect(timerMemoryReply(m,now)).toContain('2段计时');expect(presenceCandidates(pet,m,now).find(l=>l.id==='memory-timer-today')?.text).toContain('35分钟')})
 it('forgets a removed event immediately and never fabricates a first shared session',()=>{const empty=createMemory(pet);expect(timerMemoryReply(empty,now)).toContain('还没有');const m=recordEvent(empty,{kind:'reminder',detail:timerMemoryDetail(1),at:now});expect(todaysTimers(forgetEvent(m,m.events[0].id),now)).toEqual({count:0,minutes:0});expect(presenceCandidates(pet,empty,now).some(l=>l.id==='memory-timer-today')).toBe(false)})
 it('supplies the same actual day summary to offline chat and DeepSeek',()=>{vi.useFakeTimers();vi.setSystemTime(now);const m=recordEvent(createMemory(pet),{kind:'reminder',detail:timerMemoryDetail(25),at:now-1000});expect(localReply(pet,m,'今天我们一起计时多久了？')).toContain('25分钟');const system=buildMessages(pet,m,'今天陪我多久了',now)[0].content;expect(system).toContain('"completedTimersToday":{"count":1,"minutes":25}');expect(system).toContain('不代表观察到用户工作')})
})

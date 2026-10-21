import {describe,it,expect,vi,afterEach} from 'vitest'
import {createPet} from './game'
import {createMemory,recordEvent,forgetEvent,localReply,buildMessages,parseMemory} from './companion-memory'
import {timerMemoryDetail,todaysTimers,timerMemoryReply,gameMemoryReply} from './companion-moments'
import {presenceCandidates} from './companion-presence'
const now=new Date(2026,9,21,14,0).getTime(),pet=createPet('小芽','red',now-86400000)
afterEach(()=>vi.useRealTimers())
describe('real shared timer moments',()=>{
 it('counts completed timers today, ignoring cancelled, old, future, duplicate and malformed records',()=>{let m=createMemory(pet);for(const [kind,detail,at] of [['reminder',timerMemoryDetail(25),now-60000],['reminder',timerMemoryDetail(10),now-120000],['cancel',timerMemoryDetail(40),now],['reminder',timerMemoryDetail(30),now-86400000],['reminder',timerMemoryDetail(20),now+1000],['reminder','我们约好的999分钟计时结束了。',now]] as const)m=recordEvent(m,{kind,detail,at});m.events.push(m.events[0]);expect(todaysTimers(m,now)).toEqual({count:2,minutes:35});expect(timerMemoryReply(m,now)).toContain('2段计时');expect(presenceCandidates(pet,m,now).find(l=>l.id==='memory-timer-today')?.text).toContain('35分钟')})
 it('forgets a removed event immediately and never fabricates a first shared session',()=>{const empty=createMemory(pet);expect(timerMemoryReply(empty,now)).toContain('还没有');const m=recordEvent(empty,{kind:'reminder',detail:timerMemoryDetail(1),at:now});expect(todaysTimers(forgetEvent(m,m.events[0].id),now)).toEqual({count:0,minutes:0});expect(presenceCandidates(pet,empty,now).some(l=>l.id==='memory-timer-today')).toBe(false)})
 it('supplies the same actual day summary to offline chat and DeepSeek',()=>{vi.useFakeTimers();vi.setSystemTime(now);const m=recordEvent(createMemory(pet),{kind:'reminder',detail:timerMemoryDetail(25),at:now-1000});expect(localReply(pet,m,'今天我们一起计时多久了？')).toContain('25分钟');const system=buildMessages(pet,m,'今天陪我多久了',now)[0].content;expect(system).toContain('"completedTimersToday":{"count":1,"minutes":25}');expect(system).toContain('不代表观察到用户工作')})
})

describe('real shared game memories',()=>{
 it('recalls the completed game and place after restoring, with the same evidence in offline chat and model context',()=>{
  vi.useFakeTimers();vi.setSystemTime(now);
  const detail='我们一起在浆果野餐地完成了《小屋寻宝》，得到8分，收获20摩尔豆。';
  const memory=parseMemory(recordEvent(createMemory(pet),{kind:'game',detail,at:now-1000}),pet);
  expect(localReply(pet,memory,'上次寻宝在哪里？')).toContain(detail);
  expect(buildMessages(pet,memory,'记得我们上次寻宝吗',now)[0].content).toContain(detail);
 });
 it('chooses the requested actual game and ignores menu visits, abandoned rounds and future claims',()=>{
  let memory=recordEvent(createMemory(pet),{kind:'game',detail:'在树洞房完成了小屋寻宝。',at:now-2000});
  memory=recordEvent(memory,{kind:'game',detail:'在海边小屋完成了口袋翻翻乐。',at:now-1000});
  for(const [kind,detail,at] of [['visit','只打开了小屋寻宝',now],['cancel','离开了小屋寻宝',now],['game','明天完成的小屋寻宝',now+1000]] as const)memory=recordEvent(memory,{kind,detail,at});
  expect(gameMemoryReply(memory,'记得我们玩过的寻宝吗',now)).toContain('树洞房');
  expect(gameMemoryReply(memory,'我们刚才玩了什么？',now)).toContain('口袋翻翻乐');
  expect(gameMemoryReply(memory,'我不喜欢玩游戏',now)).toBeNull();
 });
 it('immediately forgets the adventure without leaving a hidden summary',()=>{
  const memory=recordEvent(createMemory(pet),{kind:'game',detail:'在星光温室完成了小屋寻宝。',at:now-1000});
  const forgotten=forgetEvent(memory,memory.events[0].id);
  expect(gameMemoryReply(forgotten,'上次寻宝在哪里？',now)).toContain('还没有');
  expect(buildMessages(pet,forgotten,'还记得寻宝吗',now)[0].content).not.toContain('在星光温室完成');
 });
})

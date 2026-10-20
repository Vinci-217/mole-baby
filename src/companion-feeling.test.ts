import {describe,it,expect} from 'vitest'
import {companionFeeling} from './companion-feeling'
import {createPet} from './game'
import {createMemory,rememberChat,getCompanionMood,localReply,recordCare,forgetEvent,buildMessages} from './companion-memory'
import {presenceCandidates,welcomeLine} from './companion-presence'

const NOW=Date.now(),pet=createPet('小芽','pink',NOW-86400000)
describe('grounded emotional companionship',()=>{
 it('does not invert common negations or celebrate an unfinished task',()=>{
  for(const text of ['我不累，也没有压力','我一点也不难过','压力不大','我没那么累','我今天没完成任务','我没有不开心','我不是不开心','还不算成功'])expect(companionFeeling(text)).toBeNull()
  for(const text of ['我今天不开心','最近压力有点大','我好累','我不太开心','我开心不起来'])expect(companionFeeling(text)).toBe('low')
  expect(companionFeeling('我终于完成了，真开心')).toBe('bright')
 })
 it('uses the same emotional reading for status, local chat and spontaneous care',()=>{
  for(const text of ['我不累，也没有压力','我今天不开心','我今天没完成任务']){
   const memory=rememberChat(createMemory(pet),text,NOW)
   const low=companionFeeling(text)==='low'
   expect(getCompanionMood(memory,pet,NOW).id==='concerned').toBe(low)
   expect(presenceCandidates(pet,memory,NOW).some(c=>c.id==='feeling-tired')).toBe(low)
   if(low)expect(localReply(pet,memory,text)).toContain('想再说一点')
   else expect(localReply(pet,memory,text)).not.toMatch(/不好受|跟着开心/)
  }
 })
 it('recalls only a real recent food event and forgets it without a hidden preference',()=>{
  let memory=recordCare(createMemory(pet),'feed','你用熊熊饼干照料了我。',NOW-60000)
  expect(presenceCandidates(pet,memory,NOW).find(c=>c.id==='memory-food')?.text).toContain('熊熊饼干')
  memory=forgetEvent(memory,memory.events[0].id)
  expect(presenceCandidates(pet,memory,NOW).some(c=>c.id==='memory-food')).toBe(false)
  expect(memory.facts).toEqual([])
 })
 it('retains an actual no-lecture preference and describes the current original morphology to DeepSeek',()=>{
  const memory=rememberChat(createMemory(pet),'不要讲鸡汤。',NOW)
  expect(memory.facts[0].kind).toBe('boundary')
  expect(presenceCandidates(pet,memory,NOW).some(c=>c.topic==='culture'||c.topic==='progress')).toBe(false)
  expect(buildMessages(pet,memory,'你会飞吗？',NOW)[0].content).toContain('种子住在花盆里')
  expect(welcomeLine({...pet,sleeping:true},memory,NOW)).toContain('打盹')
  expect(welcomeLine(pet,memory,NOW)).not.toContain('好久不见')
 })
})

import {describe,it,expect} from 'vitest'
import {createPet,care,parseSave,tick} from './game'
import {COURSES,beginActivity,cancelActivity,learned,settleActivity,petSpeech,JOB_MS,JOB_PAY,type CourseId} from './pet-school'
const now=1_700_000_000_000
const pet=()=>({...createPet('豆豆','red',now),growth:60})
function graduate(id:CourseId,state=pet()){
 const course=COURSES.find(c=>c.id===id)!
 for(let i=0;i<course.lessons;i++){
  const result=beginActivity({...state,stats:{...state.stats,energy:85}},'course',id,state.lastTick+i+1)
  expect(result.ok).toBe(true);state=settleActivity(result.state,result.state.activity!.endsAt)
 }
 return state
}
describe('persistent school and restaurant activities',()=>{
 it('speaks bibo before language class and Chinese only after graduation',()=>{
  const p=pet();expect(petSpeech(p,'你好')).toContain('bibo');expect(petSpeech(graduate('language'),'你好')).toBe('你好')
 })
 it('requires three complete lessons and does not award early certificates',()=>{
  let p=pet()
  for(let i=0;i<3;i++){const start=beginActivity(p,'course','language',now+i+1);expect(start.ok).toBe(true);p=settleActivity(start.state,start.state.activity!.endsAt);expect(learned(p,'language')).toBe(i===2)}
 })
 it('enforces language and magic prerequisites',()=>{
  expect(beginActivity(pet(),'course','english').ok).toBe(false);expect(beginActivity(pet(),'course','fire').ok).toBe(false)
  const p=graduate('language');expect(beginActivity(p,'course','english',now+20).ok).toBe(true);expect(beginActivity(p,'course','wind',now+20).ok).toBe(false)
  expect(beginActivity(graduate('magic',p),'course','wind',now+30).ok).toBe(true)
 })
 it('does not settle or pay before the deadline, and pays exactly once',()=>{
  const p=pet(),r=beginActivity(p,'restaurant',undefined,now+1),end=r.state.activity!.endsAt
  expect(end-(now+1)).toBe(JOB_MS);expect(settleActivity(r.state,end-1).coins).toBe(p.coins)
  const done=settleActivity(r.state,end);expect(done.coins).toBe(p.coins+JOB_PAY);expect(settleActivity(done,end+5000).coins).toBe(done.coins)
 })
 it('continues and settles a saved job after reopening without repeated rewards',()=>{
  const started=beginActivity(pet(),'restaurant',undefined,now+1).state,done=parseSave(JSON.stringify(started),now+JOB_MS+2)!
  expect(done.coins).toBe(pet().coins+JOB_PAY);expect(done.activity).toBeUndefined();expect(parseSave(JSON.stringify(done),now+JOB_MS+3)!.coins).toBe(done.coins)
 })
 it('keeps lesson progress and certificates through save parsing',()=>{
  const p=graduate('language'),saved=parseSave(JSON.stringify(p),now+1_000_000)!
  expect(saved.education).toEqual(p.education);expect(learned(saved,'language')).toBe(true)
 })
 it('rejects overlapping work and study',()=>{
  const p=beginActivity(pet(),'course','language',now+1).state;expect(beginActivity(p,'restaurant',undefined,now+2).ok).toBe(false)
 })
 it('cancelling a shift gives no pay or course credit',()=>{
  const p=beginActivity(pet(),'restaurant',undefined,now+1).state,cancelled=cancelActivity(p)
  expect(settleActivity(cancelled,now+JOB_MS*2).coins).toBe(p.coins);expect(cancelled.education).toBeUndefined()
 })
 it('manual sleep interrupts work and can be manually woken',()=>{
  const p=beginActivity(pet(),'restaurant',undefined,now+1).state,slept=care(p,'sleep',undefined,now+100)
  expect(slept.state.sleeping).toBe(true);expect(slept.state.activity).toBeUndefined();expect(tick(slept.state,now+15000).sleeping).toBe(true)
  expect(care(slept.state,'sleep',undefined,now+16000).state.sleeping).toBe(false)
 })
 it('stops tired or seed pets from beginning a shift',()=>{
  expect(beginActivity({...pet(),growth:0},'restaurant').ok).toBe(false);expect(beginActivity({...pet(),stats:{...pet().stats,energy:10}},'restaurant').ok).toBe(false)
 })
 it('drops malformed imported sessions and unearned certificates',()=>{
  const p=pet(),saved=parseSave(JSON.stringify({...p,education:{lessons:{fire:3},graduated:{fire:now}},activity:{id:'bad',kind:'restaurant',startedAt:now,endsAt:now+JOB_MS}}),now+1)!
  expect(learned(saved,'fire')).toBe(false);expect(saved.activity).toBeUndefined()
 })
})

import {describe,it,expect} from 'vitest'
import {createPet,care,parseSave,tick} from './game'
import {COURSES,activityBlockReason,beginActivity,cancelActivity,learned,settleActivity,petSpeech,JOB_MS,JOB_PAY,type CourseId} from './pet-school'
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
 it('graduates after one complete lesson, never before its deadline or twice',()=>{
  const start=beginActivity(pet(),'course','language',now+1),end=start.state.activity!.endsAt
  expect(learned(settleActivity(start.state,end-1),'language')).toBe(false)
  const done=settleActivity(start.state,end)
  expect(learned(done,'language')).toBe(true);expect(done.education?.lessons.language).toBe(1)
  expect(beginActivity(done,'course','language',end+1).ok).toBe(false)
  expect(settleActivity(done,end+1000).education).toEqual(done.education)
 })
 it('migrates valid old partial and complete progress to one course and preserves certificates',()=>{
  for(const count of [1,2,3]){
   const saved=parseSave(JSON.stringify({...pet(),education:{lessons:{language:count,english:count},graduated:{language:now-1}}}),now+1000)!
   expect(learned(saved,'language')).toBe(true);expect(learned(saved,'english')).toBe(true)
   expect(saved.education?.lessons).toEqual({language:1,english:1})
   expect(saved.education?.graduated.language).toBe(now-1)
   expect(parseSave(JSON.stringify(saved),now+2000)!.education).toEqual(saved.education)
  }
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
 it('requires enough energy to finish a shift without an immediate automatic nap',()=>{
  const tired={...pet(),stats:{...pet().stats,energy:30.1}};
  const refused=beginActivity(tired,'restaurant',undefined,now);
  expect(refused.ok).toBe(false);expect(refused.state).toBe(tired);expect(refused.message).toContain('31');
  const ready={...tired,stats:{...tired.stats,energy:31}};
  const started=beginActivity(ready,'restaurant',undefined,now);
  expect(started.ok).toBe(true);
  const done=tick(started.state,now+JOB_MS);
  expect(done.coins).toBe(tired.coins+JOB_PAY);expect(done.sleeping).toBe(false);
  expect(done.activity).toBeUndefined();expect(done.stats.energy).toBeGreaterThan(20);
 })
 it('settles before a later nap and integrates rewards identically across long and short ticks',()=>{
  const initial={...pet(),stats:{...pet().stats,energy:50,happiness:34.95}}
  const started=beginActivity(initial,'restaurant',undefined,now).state
  const once=tick(started,now+6*3_600_000)
  let many=started
  for(let minute=1;minute<=360;minute++)many=tick(many,now+minute*60_000)
  expect(once.coins).toBe(initial.coins+JOB_PAY);expect(many.coins).toBe(once.coins)
  expect(once.activity).toBeUndefined();expect(many.activity).toBeUndefined()
  expect(many.sleeping).toBe(once.sleeping);expect(many.growth).toBeCloseTo(once.growth,3)
  // Each tick rounds needs to six decimals; accumulated minute ticks may
  // differ below one thousandth, far below a displayed percentage point.
  for(const key of Object.keys(once.stats) as (keyof typeof once.stats)[])expect(Math.abs(many.stats[key]-once.stats[key])).toBeLessThan(.001)
 })
 it('settles a due saved activity even when the stored tick is already at its deadline',()=>{
  const started=beginActivity(pet(),'restaurant',undefined,now).state,end=started.activity!.endsAt
  const saved={...started,lastTick:end},restored=parseSave(JSON.stringify(saved),end)!
  expect(restored.coins).toBe(saved.coins+JOB_PAY);expect(restored.activity).toBeUndefined()
  expect(parseSave(JSON.stringify(restored),end)!.coins).toBe(restored.coins)
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

it('explains every language class blocker and accepts healthy junior students',()=>{
 const p=pet();expect(activityBlockReason(p,'course','language')).toBeNull();
 expect(beginActivity(p,'course','language',now+1).ok).toBe(true);
 expect(activityBlockReason({...p,growth:0},'course','language')).toContain('初级');
 expect(activityBlockReason({...p,sleeping:true},'course','language')).toContain('叫醒');
 for(const [key,label] of [['energy','精力'],['hunger','喂食'],['thirst','喝水'],['health','健康']] as const){
  expect(activityBlockReason({...p,stats:{...p.stats,[key]:10}},'course','language')).toContain(label);
 }
});

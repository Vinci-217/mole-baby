import {describe,it,expect} from 'vitest'
import {createPet,parseSave} from './game'
import {beginActivity,settleActivity,cancelActivity,COURSES,COURSE_MS,normalizeActivity} from './pet-school'
import {buyOutfit,wearOutfit} from './wardrobe'
import {reconcileCourseRewards,MAGIC_WAND_ID} from './course-rewards'
const now=1_700_000_000_000
const student=()=>({...createPet('小叶','blue',now),growth:840,evolution:'super' as const})
describe('three minute learning and earned wand',()=>{
 it('gives every course the same three-minute deadline, keeping restaurant shifts separate',()=>{
  expect(COURSES.every(c=>c.minutes===3&&c.lessons===1)).toBe(true)
  const pet={...student(),education:{lessons:{language:1,magic:1},graduated:{language:now,magic:now}}}
  for(const course of COURSES.filter(c=>!['language','magic'].includes(c.id))){
   const result=beginActivity(pet,'course',course.id,now+1)
   expect(result.ok).toBe(true);expect(result.state.activity!.endsAt-result.state.activity!.startedAt).toBe(COURSE_MS)
  }
 })
 it('awards a wand only after the complete magic lesson and persists it once',()=>{
  const start=beginActivity(student(),'course','magic',now+1).state,end=start.activity!.endsAt
  expect(settleActivity(start,end-1).wardrobe).toBeUndefined()
  expect(settleActivity(cancelActivity(start),end).wardrobe).toBeUndefined()
  const done=settleActivity(start,end)
  expect(done.wardrobe).toEqual([MAGIC_WAND_ID]);expect(done.coins).toBe(start.coins)
  const loaded=parseSave(JSON.stringify(done),end+1000)!
  expect(reconcileCourseRewards(loaded)).toBe(loaded);expect(loaded.wardrobe).toEqual([MAGIC_WAND_ID])
  expect(wearOutfit(loaded,MAGIC_WAND_ID).ok).toBe(true)
 })
 it('cannot buy or wear a wand without its course, and repairs old saves without duplicate refunds',()=>{
  const p=student();expect(buyOutfit({...p,coins:10000},MAGIC_WAND_ID).ok).toBe(false)
  expect(wearOutfit({...p,wardrobe:[MAGIC_WAND_ID]},MAGIC_WAND_ID).ok).toBe(false)
  const loaded=parseSave(JSON.stringify({...p,coins:35,wardrobe:[MAGIC_WAND_ID],wearing:MAGIC_WAND_ID}),now)!
  expect(loaded.coins).toBe(100);expect(loaded.wardrobe??[]).not.toContain(MAGIC_WAND_ID);expect(loaded.wearing).toBeUndefined()
  expect(parseSave(JSON.stringify(loaded),now)!.coins).toBe(100)
  const graduate=parseSave(JSON.stringify({...p,education:{lessons:{magic:1},graduated:{magic:now}}}),now)!
  expect(graduate.wardrobe).toEqual([MAGIC_WAND_ID]);expect(graduate.coins).toBe(p.coins)
 })
 it('keeps elapsed time in old lessons and honors already-completed deadlines',()=>{
  const p=student(),id=`${p.createdAt}:${now}`
  expect(normalizeActivity({id,kind:'course',course:'language',startedAt:now,endsAt:now+120000},p,now+60000)!.endsAt).toBe(now+180000)
  expect(normalizeActivity({id,kind:'course',course:'language',startedAt:now,endsAt:now+120000},p,now+150000)!.endsAt).toBe(now+120000)
  expect(normalizeActivity({id,kind:'course',course:'language',startedAt:now,endsAt:now+80000},p,now+60000)).toBeUndefined()
  expect(normalizeActivity({id,kind:'course',course:'language',startedAt:now,endsAt:String(now+180000)},p,now+60000)).toBeUndefined()
 })
})

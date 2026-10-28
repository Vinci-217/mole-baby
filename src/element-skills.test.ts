import {describe,it,expect} from 'vitest';
import {createPet,changePetStage,parseSave,type GameState} from './game';
import {beginActivity,settleActivity,cancelActivity,learned,normalizeEducation,type CourseId} from './pet-school';
import {ELEMENT_SKILLS,elementSkillsForCourse,learnedElementSkill} from './element-skills';
const now=1_700_000_000_000;
const basic=()=>changePetStage(createPet('豆豆','blue',now),1,undefined,now).state;
function complete(pet:GameState,course:CourseId){const start=beginActivity({...pet,stats:{...pet.stats,energy:95}},'course',course,pet.lastTick+1);expect(start.ok).toBe(true);return settleActivity(start.state,start.state.activity!.endsAt)}
describe('original element lessons and save migration',()=>{
 it('unlocks the reusable magic box after one completed introductory lesson',()=>{
  const p=basic(),started=beginActivity(p,'course','magic',now+1).state;
  expect(learned(started,'magic')).toBe(false);
  const done=settleActivity(started,started.activity!.endsAt);
  expect(learned(done,'magic')).toBe(true);expect(done.education?.lessons.magic).toBe(1);
  expect(learned(settleActivity(cancelActivity(started),now+1_000_000),'magic')).toBe(false);
 });
 it('keeps old one, two and three lesson magic progress and dependent certificates',()=>{
  for(const count of [1,2,3]){
   const education=normalizeEducation({lessons:{magic:count,fire:3},graduated:{fire:now-1}},now)!;
   expect(education.lessons.magic).toBe(1);expect(learned({education},'magic')).toBe(true);
   expect(education.graduated.fire).toBe(now-1);
  }
 });
 it('requires both magic and an actual fifth-stage form before element study',()=>{
  const first=complete(basic(),'magic');
  expect(beginActivity(first,'course','element-fire',now+10).ok).toBe(false);
  const fifth=changePetStage(basic(),4,'super',now).state;
  expect(beginActivity(fifth,'course','element-fire',now+10).ok).toBe(false);
  expect(beginActivity(changePetStage(first,4,'water',now).state,'course','element-fire',now+10).ok).toBe(true);
 });
 it('awards exactly one new transformation per completed lesson in each school',()=>{
  for(const type of ['fire','water','wood']){
   let p=changePetStage(complete(basic(),'magic'),4,'super',now).state;
   const course=`element-${type}` as CourseId,skills=elementSkillsForCourse(course);
   for(let lesson=1;lesson<=6;lesson++){
    p=complete(p,course);const repeated=settleActivity(p,now+10_000_000);
    expect(repeated.education?.lessons[course]).toBe(lesson);
    for(const skill of skills)expect(learnedElementSkill(p,skill.id)).toBe(skill.level<=lesson);
    expect(learned(p,course)).toBe(lesson===6);
    const restored=parseSave(JSON.stringify(p),now+10_000_000)!;
    expect(restored.education).toEqual(p.education);
   }
  }
 });
 it('keeps learned progress while a lower-stage appearance cannot perform it',()=>{
  const p=complete(changePetStage(complete(basic(),'magic'),4,'fire',now).state,'element-fire');
  expect(learnedElementSkill(p,'fire-1')).toBe(true);
  const lower=changePetStage(p,2,undefined,now).state;
  expect(lower.education).toEqual(p.education);expect(learnedElementSkill(lower,'fire-1')).toBe(false);
 });
 it('maps all eighteen abilities to the original client type/level formula',()=>{
  expect(new Set(ELEMENT_SKILLS.map(s=>s.sourceId)).size).toBe(18);
  for(const [index,type] of ['fire','water','wood'].entries())for(let level=1;level<=6;level++)expect(ELEMENT_SKILLS.find(s=>s.id===`${type}-${level}`)?.sourceId).toBe(1208000+index+(level-1)*3);
 });
});

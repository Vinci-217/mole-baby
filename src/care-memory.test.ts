import {describe,it,expect} from 'vitest';
import {createPet} from './game';
import {createMemory,parseMemory,recordCare,getDiary,getCompanionMood} from './companion-memory';
const pet=createPet('团团','blue',1790000000000);
describe('local care memories after conversation removal',()=>{
 it('purges old transcripts and private conversation facts while preserving quiet preferences and actual care',()=>{
  const base=recordCare(createMemory(pet),'feed','你用熊熊饼干照料了我。');
  const old={...base,messages:[{id:'chat',role:'user',content:'private transcript',at:Date.now()}],facts:[{kind:'story',value:'private story',at:Date.now()},{kind:'boundary',value:'请安静陪我',at:Date.now()}]};
  const migrated=parseMemory(JSON.stringify(old),pet);expect(migrated.messages).toEqual([]);expect(migrated.facts.map(f=>f.kind)).toEqual(['boundary']);expect(migrated.events).toEqual(base.events);expect(getDiary(migrated)[0].moments).toContain('你用熊熊饼干照料了我。');
 });
 it('still derives moods from real care and current needs without conversation',()=>{
  const m=recordCare(createMemory(pet),'pet');expect(getCompanionMood(m,{...pet,stats:{...pet.stats,happiness:90}}).id).toBe('cheerful');expect(getCompanionMood(m,{...pet,stats:{...pet.stats,happiness:10}}).id).toBe('downcast');
 });
 it('keeps imported memories tied to the actual pet',()=>expect(parseMemory({...createMemory(pet),petId:'other'},pet)).toEqual(createMemory(pet)));
});

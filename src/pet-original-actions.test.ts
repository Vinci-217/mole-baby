import {describe,it,expect} from 'vitest';
import {createPet,care,buyItem,changePetStage,configureGrowth,parseSave,STAGES,GROWTH_MAX,type GameState} from './game';
import {restorePetBackup} from './pet-backup';
import {createMemory,recordEvent} from './companion-memory';
import {ITEMS} from './catalog';
import {OFFICIAL_CLIPS,supportsOfficial} from './official-clips';
import {FORM_NAMES,naturalOriginalActions,originalMagicActions,originalItemClip,originalPlayTools,playbackForm,autonomousOriginalActions,chooseAutonomousOriginal} from './pet-original-actions';
import type {RamForm} from './original-actions';

const now=1_700_000_000_000;
const pet=()=>({...createPet('小紫','blue',now),color:'#9c5fd4' as const,growth:60,stats:{hunger:90,thirst:90,cleanliness:90,happiness:90,health:100,energy:90}});
describe('curated original interactions',()=>{
 it('uses each ordinary stage’s native classroom actors, excluding interfaces and duplicate content',()=>{
  const all=new Set<string>();
  for(const form of ['junior','middle','senior','classic'] as RamForm[]){
   const rows=naturalOriginalActions(form);expect(rows.length).toBeGreaterThan(8);
   expect(new Set(rows.map(row=>row.clip.sha256)).size).toBe(rows.length);
   for(const row of rows){expect(supportsOfficial(row.clip,form)).toBe(true);expect(row.clip.path).toMatch(/\/lahmMovie\/pet\d+Movie\//);all.add(row.id);}
   const spells=originalMagicActions(form);expect(new Set(spells.map(row=>row.name)).size).toBe(spells.length);expect(spells.length).toBeLessThanOrEqual(7);
  }
  expect(all.size).toBeGreaterThan(30);
  for(const form of ['super','water','wood','fire'] as RamForm[])expect(naturalOriginalActions(form)).toEqual([]);
 });
 it('plays toys without buying, changing coins, consuming old stock or changing needs',()=>{
  for(const item of ITEMS.filter(item=>item.category==='toy')){
   const before={...pet(),inventory:{...pet().inventory,[item.id]:0}};
   const played=care(before,'use',item.id,now);expect(played.ok).toBe(true);expect(played.state).toEqual(before);
   expect(buyItem(before,item.id)).toMatchObject({ok:false,state:before});
  }
  for(const form of ['junior','middle','senior','classic','super','water','wood','fire'] as RamForm[]){
   expect(originalPlayTools(form)).toHaveLength(11);expect(originalMagicActions(form)).toHaveLength(7);
   for(const row of [...originalPlayTools(form),...originalMagicActions(form)])expect(playbackForm(row.clip,form)).toBeDefined();
  }
  expect(originalPlayTools('seed')).toEqual([]);
 });
 it('selects exact forms for free toys and care, without replacing a missing form with junior',()=>{
  const toys=ITEMS.filter(item=>item.category==='toy');expect(toys.length).toBe(6);
  for(const item of toys){expect(item.price).toBe(0);expect(item.reusable).toBe(true);expect(originalItemClip(item.id,'junior')).toBeDefined();}
  for(const form of Object.keys(FORM_NAMES) as RamForm[])for(const item of ITEMS){const clip=originalItemClip(item.id,form);if(clip)expect(supportsOfficial(clip,form)).toBe(true);}
  expect(originalItemClip('180004','super')).toBeUndefined();
  const drawing=Array.from({length:4},(_,i)=>originalItemClip('drawing-kit','junior',i)?.id);
  expect(new Set(drawing).size).toBe(4);
 });
 it('adds free toys and learned magic, pauses when occupied, and avoids immediate repeats',()=>{
  const plain=pet(),before=autonomousOriginalActions(plain),football=originalItemClip('180004','junior')!;
  expect(before).toContain('ambient-'+football.id);
  const owned={...plain,inventory:{...plain.inventory,'180004':1},education:{lessons:{magic:1},graduated:{magic:now}}};
  const choices=autonomousOriginalActions(owned);expect(choices).toContain('ambient-'+football.id);
  expect(choices.length).toBeGreaterThan(before.length);
  const first=chooseAutonomousOriginal(owned,undefined,()=>0);expect(chooseAutonomousOriginal(owned,first,()=>0)).not.toBe(first);
  for(const row of [{...owned,sleeping:true},{...owned,growth:0},{...owned,stats:{...owned.stats,energy:5}}])expect(autonomousOriginalActions(row)).toEqual([]);
  for(const id of choices.filter(id=>!id.startsWith('ambient-element-')))expect(OFFICIAL_CLIPS.some(clip=>id==='ambient-'+clip.id)).toBe(true);
 });
});
describe('free stage selection without losing natural progress',()=>{
 it('can switch from seed through every form, then reopen and resume actual growth',()=>{
  const initial={...pet(),growth:0};let current:GameState=initial;
  for(const evolution of ['classic','super','water','wood','fire'] as const){
   current=changePetStage(current,4,evolution,now).state;
   expect(current).toMatchObject({growth:GROWTH_MAX,naturalGrowth:0,highestGrowth:0,evolution,color:initial.color,inventory:initial.inventory});
   current=parseSave(JSON.stringify(current),now)!;
   expect(current.naturalGrowth).toBe(0);expect(current.highestGrowth).toBe(0);
  }
  const resumed=configureGrowth(current,{mode:'auto',stage:4,evolution:'fire'},now).state;
  expect(resumed.growth).toBe(0);expect(resumed.evolution).toBeUndefined();expect(resumed.growthLocked).toBe(false);
 });
 it('does not turn a new manual stage-choice memory into earned progress when importing a backup',()=>{
  const chosen=changePetStage(pet(),4,'water',now).state;
  const memory=recordEvent(createMemory(chosen),{kind:'stage-choice',detail:'已固定为水系拉姆',at:now});
  const values=new Map<string,string>();
  const restored=restorePetBackup(JSON.stringify({...chosen,companionMemory:memory}),{getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value)},removeItem:key=>{values.delete(key)}},now);
  expect(restored.pet.highestGrowth).toBe(60);expect(restored.pet.naturalGrowth).toBe(60);
  expect(configureGrowth(restored.pet,{mode:'auto',stage:4},now).state.growth).toBe(60);
  expect(restored.memory.events[0].kind).toBe('stage-choice');
  const legacy={...pet(),growth:STAGES[3].threshold};expect(parseSave(JSON.stringify(legacy),now)!.highestGrowth).toBe(STAGES[3].threshold);
 });
});

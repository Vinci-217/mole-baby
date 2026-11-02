import {describe,it,expect} from 'vitest';
import {care,configureGrowth,createPet,legacyUnlockedGrowth,parseSave,STAGES,tick,unlockedStage} from './game';
import {beginActivity} from './pet-school';
import {normalizeNotes,recordStatChange} from './pet-records';
const NOW=1_800_000_000_000;
describe('earned forms and existing companion saves',()=>{
 it('rejects every unearned stage, including through direct care configuration',()=>{
  const pet=createPet('一直是我','blue',NOW),before=JSON.stringify(pet);
  for(const stage of [1,2,3,4] as const)for(const mode of ['fixed','auto'] as const){const result=configureGrowth(pet,{mode,stage},NOW);expect(result.ok).toBe(false);expect(result.state).toBe(pet);}
  expect(JSON.stringify(pet)).toBe(before);
 });
 it('keeps earned progress and unlocks through lower fixed forms, reload and automatic growth',()=>{
  const old={...createPet('老朋友','pink',NOW),growth:516.25,coins:520,notes:[{id:'one',text:'陪拉姆上学',done:false,createdAt:NOW}]};
  const fixed=configureGrowth(old,{mode:'fixed',stage:1},NOW).state;
  expect(fixed.highestGrowth).toBe(516.25);expect(fixed.growth).toBe(STAGES[1].threshold);expect(unlockedStage(fixed)).toBe(3);
  const saved=parseSave(JSON.stringify(fixed),NOW+60000)!;
  expect(saved.notes).toEqual(old.notes);expect(saved.createdAt).toBe(old.createdAt);expect(saved.coins).toBe(520);
  const auto=configureGrowth(saved,{mode:'auto',stage:1},saved.lastTick).state;
  expect(auto.growth).toBe(516.25);expect(tick(auto,auto.lastTick+60000).growth).toBeGreaterThan(516.25);
 });
 it('recovers already visited legacy forms from confirmed memory events only',()=>{expect(legacyUnlockedGrowth([{kind:'stage-choice',detail:'你把我切换为高级拉姆。'},{kind:'hello',detail:'神力拉姆'}])).toBe(420);expect(legacyUnlockedGrowth([{kind:'stage-choice',detail:'你选择了神奇水系拉姆。'}])).toBe(840);});
 it('loads an old v1 save without new fields and preserves its complete identity and inventory',()=>{
  const pet=createPet('原来的拉姆','red',NOW);pet.inventory.biscuit=12;
  const {highestGrowth,notes,statHistory,...old}=pet;
  const migrated=parseSave(JSON.stringify({...old,growth:240}),NOW)!;
  expect(migrated).toMatchObject({...old,growth:240,highestGrowth:240});expect(unlockedStage(migrated)).toBe(2);
 });
});
describe('recovery items and status receipts',()=>{
 it('energy drink restores energy independently of thirst, wakes a resting pet and consumes exactly once',()=>{
  const p=createPet('小叶','blue',NOW);p.stats={...p.stats,energy:7,thirst:100};p.inventory['energy-drink']=1;p.sleeping=true;
  const result=care(p,'drink','energy-drink',NOW);
  expect(result.ok).toBe(true);expect(result.state.stats.energy).toBe(100);expect(result.state.stats.thirst).toBe(100);expect(result.state.sleeping).toBe(false);expect(result.state.inventory['energy-drink']).toBe(0);
  expect(care(result.state,'drink','energy-drink',NOW).ok).toBe(false);expect(p.inventory['energy-drink']).toBe(1);
 });
 it('the existing cross ID restores all six needs to 100 and survives backup validation',()=>{
  const p=createPet('小叶','yellow',NOW);for(const key of Object.keys(p.stats) as (keyof typeof p.stats)[])p.stats[key]=1;p.inventory['180006']=2;
  const result=care(p,'use','180006',NOW);expect(result.ok).toBe(true);expect(Object.values(result.state.stats)).toEqual([100,100,100,100,100,100]);expect(result.state.inventory['180006']).toBe(1);
  expect(care(result.state,'use','180006',NOW).ok).toBe(false);expect(parseSave(JSON.stringify(result.state),NOW)?.inventory['180006']).toBe(1);
 });
 it('records actual capped deltas, keeps interaction reasons and bounds periodic history',()=>{
  let p=createPet('小叶','red',NOW);p.inventory.biscuit=1;const eaten=care(p,'feed','biscuit',NOW).state;
  p=recordStatChange(p,eaten,'吃熊熊饼干',NOW);expect(p.statHistory?.[0].delta.hunger).toBe(18);
  for(let i=1;i<=120;i++){const next=tick(p,NOW+i*15000);p=recordStatChange(p,next,'自然消耗与休息',NOW+i*15000);}
  expect(p.statHistory?.length).toBe(2);expect(p.statHistory?.[1].delta.hunger).toBeLessThan(0);
  const restored=parseSave(JSON.stringify(p),p.lastTick)!;expect(restored.statHistory).toEqual(p.statHistory);
 });
 it('separates earned work rewards from natural decay in status reasons',()=>{
  const pet={...createPet('小叶','blue',NOW),growth:60},working=beginActivity(pet,'restaurant',undefined,NOW).state;
  const done=tick(working,working.activity!.endsAt),recorded=recordStatChange(working,done,'自然消耗与休息',done.lastTick);
  expect(recorded.statHistory?.at(-1)?.reason).toContain('餐厅工作完成');expect(recorded.statHistory?.at(-1)?.delta.happiness).toBeGreaterThan(0);
 });
 it('bounds memo text and ignores malformed optional records without rejecting the pet',()=>{
  expect(normalizeNotes([{id:'ok',text:'x'.repeat(500),createdAt:NOW},{id:'ok',text:'duplicate',createdAt:NOW},null])).toHaveLength(1);
  const restored=parseSave(JSON.stringify({...createPet('小叶','red',NOW),notes:[null],statHistory:[{bad:true}],highestGrowth:'broken'}),NOW);
  expect(restored?.name).toBe('小叶');expect(restored?.notes).toEqual([]);expect(restored?.statHistory).toEqual([]);
 });
});

import {describe,it,expect} from 'vitest';
import {createPet,configureGrowth,tick,parseSave,STAGES} from './game';
import {growthProgress,growthTimeLabel} from './growth-progress';
import {beginActivity} from './pet-school';
import type {GrowthSelection} from './game';

const NOW=1_800_000_000_000,HOUR=3_600_000;
const pet=()=>({...createPet('小叶','blue',NOW),growth:240});
describe('confirmed growth configuration',()=>{
 it('settles the old mode, preserves partial progress and never credits fixed time',()=>{
  const start=pet(),atPause=tick(start,NOW+HOUR);
  const fixed=configureGrowth(start,{mode:'fixed',stage:2},NOW+HOUR).state;
  expect(fixed.growth).toBe(atPause.growth);expect(fixed.stats).toEqual(atPause.stats);
  const asleep=tick(fixed,NOW+3*HOUR);expect(asleep.growth).toBe(fixed.growth);
  const auto=configureGrowth(asleep,{mode:'auto',stage:2},NOW+3*HOUR).state;
  expect(auto.growth).toBe(fixed.growth);expect(auto.growthLocked).toBe(false);
  expect(tick(auto,NOW+4*HOUR).growth).toBeCloseTo(auto.growth+240/168,5);
 });
 it('starts a different stage at its threshold while retaining identity and possessions',()=>{
  const start={...pet(),coins:651,inventory:{...pet().inventory,biscuit:7}};
  const changed=configureGrowth(start,{mode:'auto',stage:1},NOW);
  expect(changed.ok).toBe(true);expect(changed.state).toMatchObject({growth:60,growthLocked:false,name:start.name,color:start.color,coins:651,inventory:start.inventory});
  expect(tick(changed.state,NOW+HOUR).growth).toBeCloseTo(60+120/72,5);expect(start.growth).toBe(240);
 });
 it('round-trips auto mode despite old manual-stage history over repeated restarts',()=>{
  let state=configureGrowth({...pet(),growthLocked:true},{mode:'auto',stage:2},NOW).state;
  for(let n=1;n<=3;n++){
   const before=state.growth;state=parseSave(JSON.stringify(state),NOW+n*HOUR,true)!;
   expect(state.growthLocked).toBe(false);expect(state.growth).toBeGreaterThan(before);
  }
 });
 it('preserves a partially completed stage and certificates across both modes',()=>{
  const start={...pet(),education:{lessons:{language:1},graduated:{language:NOW}}};
  for(const mode of ['fixed','auto','fixed','auto'] as const){
   const next=configureGrowth(start,{mode,stage:2},NOW).state;
   expect(next.growth).toBe(start.growth);expect(next.education).toEqual(start.education);
   expect(parseSave(JSON.stringify(next),NOW,true)?.growthLocked).toBe(mode==='fixed');
  }
 });
 it('mode-only changes do not cancel an ongoing activity',()=>{
  const working=beginActivity(pet(),'restaurant',undefined,NOW).state;
  const next=configureGrowth(working,{mode:'fixed',stage:2},NOW).state;
  expect(next.activity).toEqual(working.activity);
 });
 it('does not lose a newly reached stage at the confirmation-time boundary',()=>{
  const start={...pet(),growth:419.9999};
  const next=configureGrowth(start,{mode:'fixed',stage:2},NOW+1000).state;
  expect(next.growth).toBeGreaterThanOrEqual(420);expect(next.growthLocked).toBe(true);
 });
 it.each(['auto','fixed'] as const)('supports every stage in %s mode without consuming items',mode=>{
  for(const [stage,definition] of STAGES.entries()){
   const next=configureGrowth(pet(),{mode,stage:stage as 0,evolution:stage===4?'water':undefined},NOW).state;
   expect(next.growth).toBe(stage===2?240:definition.threshold);expect(next.growthLocked).toBe(mode==='fixed');
   expect(next.evolution).toBe(stage===4?'water':undefined);expect(next.inventory).toEqual(pet().inventory);
  }
 });
 it('rejects invalid choices and times without mutating the save',()=>{
  const start=pet(),before=JSON.stringify(start);
  for(const selection of [{mode:'banana',stage:2},{mode:'auto',stage:8},{mode:'fixed',stage:4,evolution:'unknown'},{mode:'auto',stage:2,evolution:'unknown'}])expect(configureGrowth(start,selection as GrowthSelection,NOW).ok).toBe(false);
  expect(configureGrowth(start,{mode:'auto',stage:1},NaN).ok).toBe(false);expect(JSON.stringify(start)).toBe(before);
 });
});
describe('progress and truthful remaining healthy time',()=>{
 it.each([[30,12],[120,36],[300,84],[630,84]])('computes half-stage growth at %s', (growth,hours)=>{
  const p=growthProgress({...pet(),growth});expect(p.percent).toBe(50);expect(p.remainingHours).toBe(hours);expect(p.paused).toBeNull();
 });
 it('shows completion for the final milestone without inventing another duration',()=>{
  for(const evolution of [undefined,'super'] as const){const p=growthProgress({...pet(),growth:840,evolution});expect(p.complete).toBe(true);expect(p.next).toBeNull();expect(p.remainingHours).toBe(0);expect(p.percent).toBe(100)}
 });
 it('explains paused growth with the same needs and sleep boundaries as the simulation',()=>{
  expect(growthProgress({...pet(),growthLocked:true}).paused).toContain('固定');
  expect(growthProgress({...pet(),sleeping:true}).paused).toContain('睡觉');
  for(const [key,value]of Object.entries({hunger:35,thirst:35,happiness:35,cleanliness:30,energy:25}))expect(growthProgress({...pet(),stats:{...pet().stats,[key]:value}}).paused).toContain('状态不足');
 });
 it('formats remaining duration without dropping fractional minutes or days',()=>{
  expect(growthTimeLabel(0)).toBe('0分钟');expect(growthTimeLabel(.001)).toBe('1分钟');expect(growthTimeLabel(36.5)).toBe('1天 12小时 30分钟');
 });
});

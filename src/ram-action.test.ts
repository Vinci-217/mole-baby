import {describe,it,expect} from 'vitest';
import {effectiveRamAction,normalizeRamAction} from './ram-action';
import {costumeAction} from './costume-action';

describe('one animation interruption policy',()=>{
 it('prioritizes sleep and dizziness before dragging and a pending performance',()=>{
  for(const action of ['idle','pet','play','uploaded-180004','official-9e6191f95c9ab5ea','element-fire-1','eat-bear-biscuit']){
   expect(effectiveRamAction({action,stage:4,sleeping:true,shaking:true,dragging:true})).toBe('sleep');
   expect(effectiveRamAction({action,stage:4,shaking:true,dragging:true})).toBe('dizzy');
   expect(effectiveRamAction({action,stage:4,dragging:true})).toBe('drag');
  }
  expect(effectiveRamAction({action:'dizzy',stage:4,dragging:true})).toBe('dizzy');
 expect(effectiveRamAction({action:'sleep',stage:4,dragging:true})).toBe('sleep');
  for(const item of ['biscuit','180004','180023']){
   expect(costumeAction('dizzy','junior',item).kind).toBe('social');
   expect(costumeAction('sleep','junior',item).kind).toBe('emotion');
   expect(costumeAction('drag','junior',item).kind).toBe('native');
  }
 });
 it('shares the football and elemental aliases across every entry point',()=>{
  expect(normalizeRamAction('official-9e6191f95c9ab5ea',4)).toBe('play');
  expect(normalizeRamAction('official-9e6191f95c9ab5ea',0)).not.toBe('play');
  expect(normalizeRamAction('ambient-element-water-1',4)).toBe('element-water-1');
 });
});

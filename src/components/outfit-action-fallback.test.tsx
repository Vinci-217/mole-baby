import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Ram from './Ram';
import {ALL_OUTFITS,petAppearance,petActionAppearance} from '../wardrobe';
import {createPet} from '../game';
import {autonomousOriginalActions} from '../pet-original-actions';
import {getRamActionDuration} from './ram-animation';
import type {Stage,Evolution} from '../game';

const forms:[Stage,Evolution?,string?][]=[[1,undefined,'junior'],[2,undefined,'middle'],[3,undefined,'senior'],[4,'classic','classic'],[4,'super','super'],[4,'water','water'],[4,'wood','wood'],[4,'fire','fire']];
describe('missing clothed actions retain the original unclothed animation',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 for(const [stage,evolution,form] of forms)it(`keeps the ${form} football sequence for every outfit`,()=>{
  vi.stubGlobal('window',{});
  const bare=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" action="play"/>);
  expect(bare).toContain('ram-football-frame');expect(bare).toContain(`data-form="${form}"`);
  for(const outfit of ALL_OUTFITS){
   const dressed=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume={outfit.id} action="play"/>);
   expect(dressed,outfit.id).toBe(bare);
  }
 });
 it('preserves daily, emotion, care, classroom and drag animations instead of a costume idle pose',()=>{
  vi.stubGlobal('window',{});
  for(const [stage,evolution] of forms)for(const action of ['pet','sleep','wake','dizzy','watch-butterfly','look-around','mood-joy','mood-grumpy','eat-bear-biscuit','school-language','drag']){
   const props={stage,evolution,color:'blue' as const,action,dragging:action==='drag'};
   expect(renderToStaticMarkup(<Ram {...props} costume="warm-scarf"/>),`${stage}:${evolution}:${action}`).toBe(renderToStaticMarkup(<Ram {...props}/>));
  }
 });
 it('keeps action selection, timing and temporary appearances consistent without changing the save',()=>{
  const pet={...createPet('保留旧记忆','blue',Date.UTC(2026,10,8)),growth:420,naturalGrowth:180,highestGrowth:420,growthLocked:true,wearing:'warm-scarf' as const,wardrobe:['warm-scarf' as const],color:'#9c5fd4' as const};
  const snapshot=JSON.stringify(pet);
  expect(petAppearance(pet).form).toBe('junior');
  for(const action of ['play','play-alone','pet','sleep','uploaded-180004','mood-joy']){
   expect(petActionAppearance(pet,action).form).toBe('senior');
   expect(getRamActionDuration(action,petActionAppearance(pet,action).form)).toBe(getRamActionDuration(action,'senior'));
  }
  expect(autonomousOriginalActions(pet)).toEqual(autonomousOriginalActions({...pet,wearing:undefined}));
  expect(petActionAppearance(pet,'idle').form).toBe('junior');
  expect(petActionAppearance(pet,'walk-left').form).toBe('junior');
  expect(JSON.stringify(pet)).toBe(snapshot);
 });
});

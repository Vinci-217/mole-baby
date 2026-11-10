import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Ram from './Ram';
import {ALL_OUTFITS,petAppearance,petActionAppearance,outfitAnimation} from '../wardrobe';
import {officialOutfitForm} from '../official-clips';
import {createPet} from '../game';
import {autonomousOriginalActions} from '../pet-original-actions';
import {getRamActionDuration} from './ram-animation';
import type {Stage,Evolution} from '../game';
import type {RamForm} from '../original-actions';

const forms:[Stage,Evolution|undefined,RamForm][]=[[1,undefined,'junior'],[2,undefined,'middle'],[3,undefined,'senior'],[4,'classic','classic'],[4,'super','super'],[4,'water','water'],[4,'wood','wood'],[4,'fire','fire']];
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
  for(const [stage,evolution] of forms)for(const action of ['sleep','wake','dizzy','watch-butterfly','look-around','mood-joy','mood-grumpy','eat-bear-biscuit','school-language']){
   const props={stage,evolution,color:'blue' as const,action,dragging:action==='drag'};
   expect(renderToStaticMarkup(<Ram {...props} costume="warm-scarf"/>),`${stage}:${evolution}:${action}`).toBe(renderToStaticMarkup(<Ram {...props}/>));
  }
 });
 for(const [stage,evolution,form] of forms)it(`carries every intact costume during dragging on ${form}`,()=>{
  vi.stubGlobal('window',{});
  for(const outfit of ALL_OUTFITS){
   const clip=outfitAnimation(outfit.id)!;
   const html=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume={outfit.id} dragging/>);
   expect(html,outfit.id).toContain(`data-source="${clip.path}"`);
   expect(html,outfit.id).toContain(`data-form="${officialOutfitForm(clip,form)}"`);
   expect(html,outfit.id).toContain('data-drag-adaptation="project"');
   expect(html,outfit.id).toContain(`data-growth-stage="${stage}"`);
  }
 });
 it('uses the same form-specific football from both toy and quick-action entry points',()=>{
  vi.stubGlobal('window',{});
  for(const [stage,evolution,form] of forms){
   const fromMenu=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume="warm-scarf" action="official-9e6191f95c9ab5ea"/>);
   const quick=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume="warm-scarf" action="play"/>);
   expect(fromMenu).toBe(quick);expect(fromMenu).toContain(`data-form="${form}"`);
  }
 });
 it('keeps action selection, timing and temporary appearances consistent without changing the save',()=>{
  const pet={...createPet('保留旧记忆','blue',Date.UTC(2026,10,8)),growth:420,naturalGrowth:180,highestGrowth:420,growthLocked:true,wearing:'warm-scarf' as const,wardrobe:['warm-scarf' as const],color:'#9c5fd4' as const};
  const snapshot=JSON.stringify(pet);
  expect(petAppearance(pet).form).toBe('junior');
  for(const action of ['play','play-alone','sleep','uploaded-180004','mood-joy']){
   expect(petActionAppearance(pet,action).form).toBe('senior');
   expect(getRamActionDuration(action,petActionAppearance(pet,action).form)).toBe(getRamActionDuration(action,'senior'));
  }
  expect(autonomousOriginalActions(pet)).toEqual(autonomousOriginalActions({...pet,wearing:undefined}));
  expect(petActionAppearance(pet,'idle').form).toBe('junior');
  expect(petActionAppearance(pet,'walk-left').form).toBe('junior');
  expect(petActionAppearance(pet,'pet').form).toBe('junior');
  expect(JSON.stringify(pet)).toBe(snapshot);
 });
 for(const [stage,evolution,form] of forms)it(`adapts petting for every outfit while retaining its native appearance on ${form}`,()=>{
  vi.stubGlobal('window',{});
  for(const outfit of ALL_OUTFITS){
   const clip=outfitAnimation(outfit.id)!;
   const html=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume={outfit.id} action="pet"/>);
   expect(html,outfit.id).toContain(`data-source="${clip.path}"`);
   expect(html,outfit.id).toContain(`data-form="${officialOutfitForm(clip,form)}"`);
   expect(html,outfit.id).toContain('data-petting-adaptation="project"');
   expect(html,outfit.id).not.toContain('ram-daily');
  }
 });
});

import assert from 'node:assert/strict';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Ram from './Ram';
import {ALL_OUTFITS,petAppearance,petActionAppearance,outfitAnimation,costumePlayback} from '../wardrobe';
import {officialOutfitForm,OFFICIAL_CLIPS} from '../official-clips';
import {createPet} from '../game';
import {autonomousOriginalActions} from '../pet-original-actions';
import {RAM_ACTIONS} from './ram-animation';
import {ITEMS} from '../catalog';
import {costumeAction} from '../costume-action';
import {sampleCostumeMotion} from '../costume-motion';
import type {Stage,Evolution} from '../game';
import type {RamForm} from '../original-actions';
import {playToolClip,playToolSource} from '../original-play-tools';
import {originalCareClip} from '../original-care';

const forms:[Stage,Evolution|undefined,RamForm][]=[[1,undefined,'junior'],[2,undefined,'middle'],[3,undefined,'senior'],[4,'classic','classic'],[4,'super','super'],[4,'water','water'],[4,'wood','wood'],[4,'fire','fire']];
describe('every costume retains its rig throughout ordinary interactions',()=>{
 afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
 for(const [stage,evolution,form] of forms)it(`keeps all outfits through basic actions and temporarily plays original tools on ${form}`,()=>{
  vi.stubGlobal('window',{});
  for(const outfit of ALL_OUTFITS){
   const clip=outfitAnimation(outfit.id)!;
   for(const action of ['idle','walk-left','walk-right','pet','drag','dizzy','play','sleep','focus','mood-joy','eat-bear-biscuit']){
    const html=renderToStaticMarkup(<Ram stage={stage} evolution={evolution} color="blue" costume={outfit.id} action={action} dragging={action==='drag'}/>);
    expect(html,`${outfit.id}:${action}`).toContain(`data-source="${clip.path}"`);
    expect(html).toContain(`data-form="${officialOutfitForm(clip,form)}"`);
    expect(html).toContain(`data-growth-stage="${stage}"`);
    expect(html).not.toContain('ram-outfit-action');
    expect(html).not.toContain('ram-football-frame');
    if(action==='pet')expect(html).toContain('data-petting-adaptation="project"');
    if(action==='drag')expect(html).toContain('data-drag-adaptation="project"');
    if(action==='dizzy')expect(html).toContain('social-dizzy-stars');
    if(action==='play'){
     expect(html).not.toContain('social-ball');expect(html).toContain('data-animation-mode="original-tool"');
     expect(html).toContain(`data-tool-source="${playToolClip(form,'play')!.path}"`);
     expect(html).toContain('class="ram-original-tool"');expect(html).toContain('data-uploaded-id="180004"');
    }
    if(action==='focus')expect(html).toContain('social-book');
   }
  }
 },20000);
 it('has a clothing appearance for the entire action vocabulary, every source and every care item',()=>{
  const actions=[...RAM_ACTIONS,'sad',...OFFICIAL_CLIPS.filter(c=>!['outfit','body'].includes(c.kind)).map(c=>'official-'+c.id)];
  for(const [stage,evolution,form] of forms)for(const outfit of ALL_OUTFITS){
   const clip=outfitAnimation(outfit.id)!;
   const expectedForm=officialOutfitForm(clip,form);
   for(const action of actions){const plan=costumePlayback(stage,evolution,outfit.id,action);assert.equal(plan.clip?.id,clip.id,`${outfit.id}:${form}:${action}`);assert.equal(plan.appearance.form,expectedForm);}
  }
  for(const [, ,form] of forms){
   for(const action of actions){const plan=costumeAction(action,form);assert(plan.kind);assert(plan.duration===null||Number.isFinite(plan.duration)&&plan.duration>0);}
   for(const item of ITEMS){const plan=costumeAction('use',form,item.id);assert.equal(plan.kind,item.category==='toy'?item.sourceId==='180004'?'social':'toy':'care',item.id);}
  }
 },30000);
 it('keeps growth, colour, possessions and earned memories independent of adapted gestures',()=>{
  const pet={...createPet('保留旧记忆','blue',Date.UTC(2026,10,8)),growth:840,evolution:'super' as const,naturalGrowth:180,highestGrowth:420,growthLocked:true,wearing:'warm-scarf' as const,wardrobe:['warm-scarf' as const],color:'#9c5fd4' as const};
  const snapshot=JSON.stringify(pet);
  for(const action of RAM_ACTIONS)expect(petActionAppearance(pet,action).form).toBe(playToolSource(action)||originalCareClip('super',action)?'super':'junior');
  expect(petAppearance(pet).form).toBe('junior');expect(autonomousOriginalActions(pet).length).toBeGreaterThan(0);
  expect(JSON.stringify(pet)).toBe(snapshot);
  const undressed={...pet,wearing:undefined};expect(petActionAppearance(undressed,'idle').form).toBe('super');
  for(const action of RAM_ACTIONS)expect(costumePlayback(0,undefined,'warm-scarf',action).clip).toBeUndefined();
 });
 it('uses the same stage-matched original football from both toy and quick-action entry points',()=>{
  vi.stubGlobal('window',{});
  vi.spyOn(Math,'random').mockReturnValue(.123456);
  for(const [stage,evolution] of forms){
   const props={stage,evolution,color:'blue' as const,costume:'warm-scarf'};
   expect(renderToStaticMarkup(<Ram {...props} action="official-9e6191f95c9ab5ea"/>)).toBe(renderToStaticMarkup(<Ram {...props} action="play"/>));
  }
 });
});

describe('project choreography stays bounded, registered and finite',()=>{
 const bodies=[{x:17,y:36,width:65,height:45},{x:26,y:65,width:44,height:32},{x:10,y:20,width:80,height:70},{x:36,y:55,width:28,height:22}];
 it('samples all ordinary actions and all original clips without empty or invalid poses',()=>{
  const actions=[...RAM_ACTIONS,...OFFICIAL_CLIPS.filter(c=>!['outfit','body'].includes(c.kind)).map(c=>'official-'+c.id)];
  for(const [stage,evolution,form] of forms)for(const action of actions)for(const body of bodies){
   const spec=costumeAction(action,form);
   for(const time of [0,100,1000,(spec.duration??4000)/2,spec.duration??8000]){
    const p=sampleCostumeMotion(spec,body,time,stage,evolution);
    for(const [key,value] of Object.entries(p))if(typeof value==='number')assert(Number.isFinite(value),`${form}:${action}:${key}`);
    assert(p.scaleX>=.95&&p.scaleX<=1.06);assert(p.scaleY>=.94&&p.scaleY<=1.06);
    assert.equal(p.finished,spec.duration!==null&&time>=spec.duration);
    const calm=sampleCostumeMotion(spec,body,time,stage,evolution,true);assert.equal(calm.angle,0);assert.equal(calm.x,0);assert.equal(calm.y,0);assert.equal(calm.scaleX,1);assert.equal(calm.scaleY,1);
   }
  }
 },30000);
});

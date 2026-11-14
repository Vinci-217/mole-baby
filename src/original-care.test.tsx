import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {careItemId,originalCareClip} from './original-care';
import {ITEMS} from './catalog';
import {getItemMotion} from './item-motion';
import {uploadedMotion,uploadedSpec} from './uploaded-actions';
import {ALL_OUTFITS,petActionAppearance} from './wardrobe';
import {createPet} from './game';
import Ram from './components/Ram';

describe('original food and care follow earned growth, independently of clothes',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 const forms=['junior','middle','senior','classic','super','water','wood','fire'] as const;
 it('resolves aliases, direct buttons and stale source IDs to the same stage-specific source',()=>{
  for(const form of forms){
   const target=['junior','middle','senior'].includes(form)?form:'classic';
   for(const item of ITEMS.filter(item=>item.category!=='toy'&&!item.changesColor)){
    const clip=originalCareClip(form,'use',item.id);if(!clip)continue;
    expect(clip.path).toContain(`/pet${{junior:2,middle:3,senior:4,classic:101}[target as 'classic']}/`);
    expect(originalCareClip(form,getItemMotion(item.id).action,item.id)).toBe(clip);
    const stale=originalCareClip('junior','use',item.id);
    if(stale)expect(originalCareClip(form,'official-'+stale.id)?.path).toBe(clip.path);
    const source=clip.path.split('/').at(-1)!.replace('.swf','');
    const frames=uploadedSpec(target,source);
    if(frames)expect(uploadedMotion(form,getItemMotion(item.id).action,item.id)).toBe(frames);
   }
   expect(originalCareClip(form,'feed','biscuit')?.path).toContain('/180017.swf');
   expect(originalCareClip(form,'drink','energy-drink')?.path).toContain('/180014.swf');
   expect(originalCareClip(form,'feed','180071')?.path).toContain('/180070.swf');
   expect(originalCareClip(form,'drink','180073')?.path).toContain('/180002.swf');
  }
 });
 it('provides an original eating/drinking source for every edible item at its allowed stage',()=>{
  const missing:string[]=[];
  for(const form of forms){
   const stage=form==='junior'?1:form==='middle'?2:form==='senior'?3:4;
   for(const item of ITEMS.filter(item=>['food','drink'].includes(item.category)&&!item.changesColor&&item.minStage<=stage))
    if(!originalCareClip(form,'use',item.id))missing.push(form+':'+item.id);
  }
  expect(missing).toEqual([]);
 });
 it('never mistakes lingering consumed items for a drag, pet, idle or colour change',()=>{
  for(const action of ['idle','still','walk-left','drag','dizzy','pet','focus','play']){
   expect(careItemId(action,'biscuit')).toBeUndefined();expect(originalCareClip('super',action,'biscuit')).toBeUndefined();
  }
  expect(originalCareClip('super','use','mix-9955cc')).toBeUndefined();
  expect(originalCareClip('seed','feed','biscuit')).toBeUndefined();
 });
 it('keeps every outfit engine mounted but hidden while the true form eats, then restores its appearance',()=>{
  vi.stubGlobal('window',{});
  for(const form of forms){
   const stage=form==='junior'?1:form==='middle'?2:form==='senior'?3:4,evolution=stage===4?form as 'super':undefined;
   for(const outfit of ALL_OUTFITS){
    const props={color:'blue' as const,stage:stage as 1,evolution,costume:outfit.id,itemId:'biscuit'};
    const html=renderToStaticMarkup(<Ram {...props} action="eat-bear-biscuit"/>);
    expect(html).toContain('data-animation-mode="original-care"');
    expect(html).toContain(`data-care-source="${originalCareClip(form,'feed','biscuit')!.path}"`);
    expect(html).toContain('ram-outfit-source');expect(html).toContain('visibility:hidden');
    expect(html).toContain(`data-source-form="${stage===4?'classic':form}"`);
    expect(html).not.toContain('ram-item-cue');
    const idle=renderToStaticMarkup(<Ram {...props} action="idle"/>);
    expect(idle).toContain('ram-outfit-source');expect(idle).not.toContain('ram-original-care');
   }
  }
 },30000);
 it('never mutates growth, clothes, colour or save identity while resolving care',()=>{
  const pet={...createPet('保留记忆','blue'),growth:840,evolution:'super' as const,wearing:'warm-scarf' as const};
  const before=JSON.stringify(pet);
  expect(petActionAppearance(pet,'feed','biscuit').form).toBe('super');
  expect(petActionAppearance(pet,'eat-bear-biscuit').form).toBe('super');
  expect(petActionAppearance(pet,'drag','biscuit').form).toBe('junior');
  expect(JSON.stringify(pet)).toBe(before);
 });
});

import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAY_TOOLS,playToolClip,playToolForm,playToolSource} from './original-play-tools';
import {uploadedMotion} from './uploaded-actions';
import {originalPlayTools} from './pet-original-actions';
import type {RamForm} from './original-actions';

const forms:RamForm[]=['junior','middle','senior','classic','super','water','wood','fire'];
describe('stage-matched original play timelines',()=>{
 it('uses exact ordinary stages and pet101 for every special form, including stale menu IDs',()=>{
  for(const form of forms){
   const target=playToolForm(form),level={junior:2,middle:3,senior:4,classic:101}[target as 'classic'];
   const rows=originalPlayTools(form);expect(rows).toHaveLength(11);
   for(const[source]of PLAY_TOOLS){
    const native=playToolClip(form,'uploaded-'+source)!;expect(native.level).toBe(level);
    expect(rows.find(row=>row.clip.path.endsWith('/'+source+'.swf'))?.id).toBe(native.id);
    const stale=playToolClip('junior','uploaded-'+source)!;
    for(const action of ['uploaded-'+source,'official-'+stale.id,'ambient-'+stale.id]){
     expect(playToolClip(form,action)?.id).toBe(native.id);
     const frames=uploadedMotion(form,action);if(frames)expect(frames.form).toBe(target);
    }
   }
  }
  expect(originalPlayTools('seed')).toEqual([]);expect(playToolClip('seed','play')).toBeUndefined();
  for(const action of ['idle','pet','drag','dizzy','walk-left','focus','spell','element-fire-1','eat-bear-biscuit'])expect(playToolSource(action)).toBeUndefined();
 });
 it('verifies original bytes and exported full timelines for all 44 stage/tool combinations',()=>{
  let exported=0,swfs=0;
  for(const form of ['junior','middle','senior','classic'] as const)for(const[source]of PLAY_TOOLS){
   const clip=playToolClip(form,'uploaded-'+source)!;
   const bytes=fs.readFileSync('public/assets/original/official/files/'+clip.path);
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(clip.sha256);swfs++;
   const spec=uploadedMotion(form,'uploaded-'+source);
   if(!spec){expect(source).toBe('180097');continue;}
   const table=JSON.parse(fs.readFileSync('public/assets/original/uploaded-actions/'+spec.assetKey+'/clip.json','utf8'));
   expect(table.sourceSha256).toBe(clip.sha256);expect(table.frames).toBe(spec.frames);expect(table.frameMap).toHaveLength(spec.frames);
   expect(table.fps).toBe(24);expect(table.frames).toBeGreaterThan(50);exported++;
  }
  expect(swfs).toBe(44);expect(exported).toBe(40);
 });
});

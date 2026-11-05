import {describe,it,expect} from 'vitest'
import {outfitFrame,hasAuthoredOutfit,footballOutfitRig} from './outfit-motion'
import {OUTFITS,outfitCoversCrown} from './wardrobe'
import {emotionSpec} from './mood-motion'
import {bodyWearAnchor} from './wear-anchor'
import flight from '../public/assets/original/flight/runtime.json'

describe('original wardrobe source registration',()=>{
 it('mounts original Super clothing on every classic three-leaf flight pose',()=>{
  for(const id of OUTFITS.slice(1).map(o=>o.id))for(const clip of Object.values(flight.forms.classic.clips))for(const p of clip.frames){
   const pose=outfitFrame(id,'classic','flight',p.index%8,Math.floor(p.index/8),8,p.sourceFrame)!
   expect(pose).not.toBeNull()
   expect(pose.borrowedForm).toBe('super')
   const box=pose.sheet.rects[pose.index]
   expect(box[2]-box[0]).toBeGreaterThan(1)
   expect(box[3]-box[1]).toBeGreaterThan(1)
  }
 })
 it('holds the previous original drawing at old Super Ram empty costume control cells',()=>{
  for(const id of ['wizard-cap','warm-scarf','rabbit-hood']){
   const before=outfitFrame(id,'super','classic',6,0,8)!,control=outfitFrame(id,'super','classic',7,0,8)!
   expect(control.index).toBe(before.index)
   expect(control.heldSourceIndex).toBe(6)
   const box=control.sheet.rects[control.index]
   expect(box[2]-box[0]).toBeGreaterThan(10)
   expect(box[3]-box[1]).toBeGreaterThan(10)
  }
 })
 it('keeps every authored outfit registered on the matching body during the new sleep-entry yawn',()=>{
  for(const form of ['seed','junior','middle','senior','super','water','wood','fire'])for(const outfit of OUTFITS.slice(1))for(const frame of [0,3,7]){
   expect(outfitFrame(outfit.id,form,'yawn',frame,0,8)).toEqual(outfitFrame(outfit.id,form,form==='seed'?'seed':'slumber',0,0,8))
  }
 })
 it('offers twelve real original items without losing the three saved identifiers',()=>{
  expect(OUTFITS).toHaveLength(12);expect(OUTFITS.slice(0,3).map(i=>i.id)).toEqual(['party-cap','gold-feather','wizard-cap'])
  for(const outfit of OUTFITS.slice(1))expect(hasAuthoredOutfit(outfit.id)).toBe(true)
  expect(outfitCoversCrown('wizard-cap')).toBe(true);expect(outfitCoversCrown('magic-book')).toBe(false)
 })
 it('selects the original costume cell from the same body pose in every form',()=>{
  for(const form of ['seed','junior','middle','senior','super','water','wood','fire'])for(const outfit of OUTFITS.slice(1)){
   const pose=outfitFrame(outfit.id,form,form==='seed'?'seed':form==='junior'||form==='middle'?'grounded':'classic',0,0,form==='seed'?8:form==='junior'||form==='middle'?5:8)!
   expect(pose,`${outfit.id}:${form}`).not.toBeNull();expect(pose.index).toBeLessThan(pose.sheet.rows*pose.sheet.columns)
   const box=pose.sheet.rects[pose.index];expect(box[0]).toBeGreaterThanOrEqual(0);expect(box[1]).toBeGreaterThanOrEqual(0);expect(box[2]).toBeLessThanOrEqual(pose.sheet.cell[0]);expect(box[3]).toBeLessThanOrEqual(pose.sheet.cell[1])
  }
 })
 it('uses original football source-frame numbers rather than deduplicated body cells',()=>{
  const first=outfitFrame('wizard-cap','junior','football',0,0,8,1)!,later=outfitFrame('wizard-cap','junior','football',0,0,8,112)!
  expect(first.sheet.lookup['1']).toBeDefined();expect(later.sheet.lookup['112']).toBeDefined();expect(later.index).not.toBe(first.index)
  expect(outfitFrame('wizard-cap','junior','football',0,0,8,9999)).toBeNull()
 })
 it('keeps the new original costumes on the complete flight loops, including the separate senior body',()=>{
  for(const id of ['flower-crown','knight-shield','angel-wings'])for(const [form,count] of [['senior',31],['super',60]] as const)for(let cell=0;cell<count;cell++){
   const pose=outfitFrame(id,form,'flight',cell%8,Math.floor(cell/8),8)
   expect(pose,`${id}:${form}:${cell}`).not.toBeNull()
   expect(pose!.sheet.rects[pose!.index][2]).toBeGreaterThan(1)
  }
 })
 it('keeps older clothes on original full-size direction artwork throughout both flight loops',()=>{
  for(const id of OUTFITS.slice(1,9).map(o=>o.id))for(const form of ['senior','super'] as const)for(const direction of ['down','left','right'] as const){
   const poses=flight.forms[form].clips[direction].frames.map(p=>outfitFrame(id,form,'flight',p.index%8,Math.floor(p.index/8),8,p.sourceFrame));
   for(const pose of poses){expect(pose,`${id}:${form}:${direction}`).not.toBeNull();expect(pose!.sampledFlight).toBe(true);expect(pose!.sheet.file).toBe(`${id}-${form}-classic.png`)}
   expect(new Set(poses.map(p=>p!.index)).size).toBeGreaterThan(1)
  }
 })
 it('keeps mild frowns out of the stretched-eye section of the original performance',()=>{
  expect(Math.max(...emotionSpec('junior','grumpy')!.sourceFrames)).toBe(8)
  for(const form of ['middle','senior','super','water','wood','fire'])expect(Math.max(...emotionSpec(form,'grumpy')!.sourceFrames)).toBe(12)
 })
 it('does not infer head rotation from a white ball or tooth',()=>{
  const mask=new Uint8ClampedArray(80*60*4),neutral=new Uint8ClampedArray(mask.length)
  for(let y=20;y<50;y++)for(let x=10;x<50;x++){const i=(y*80+x)*4;mask[i]=255;mask[i+3]=255}
  for(let y=0;y<20;y++)for(let x=55;x<79;x++){const i=(y*80+x)*4;neutral.set([255,255,255,255],i)}
  const anchor=bodyWearAnchor(mask,neutral,80,0,0,80,60)!;expect(anchor.angle).toBe(0);expect(anchor.y).toBeLessThan(20)
 })
})

it('uses original anatomical axes while the football body turns, with finite anchors for every source frame',()=>{
 for(const form of ['junior','middle','senior','super','water','wood','fire'])for(let frame=1;;frame++){const pose=footballOutfitRig(form,frame);if(!pose)break;expect([pose.x,pose.y,pose.scale,pose.angle].every(Number.isFinite)).toBe(true);expect(pose.scale).toBeGreaterThan(.1);expect(pose.scale).toBeLessThan(1);expect(Math.abs(pose.angle)).toBeLessThanOrEqual(180)}
 expect(footballOutfitRig('junior',200)!.angle).toBeLessThan(-70);expect(footballOutfitRig('junior',1)!.angle).toBeCloseTo(0,0);expect(footballOutfitRig('seed',1)).toBeNull()
})

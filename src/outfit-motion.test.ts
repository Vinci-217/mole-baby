import {describe,it,expect} from 'vitest'
import {outfitFrame,hasAuthoredOutfit,footballOutfitRig} from './outfit-motion'
import {OUTFITS,outfitCoversCrown} from './wardrobe'
import {emotionSpec} from './mood-motion'
import {bodyWearAnchor} from './wear-anchor'

describe('original wardrobe source registration',()=>{
 it('keeps every authored outfit registered on the matching body during the new sleep-entry yawn',()=>{
  for(const form of ['seed','junior','middle','senior','super','water','wood','fire'])for(const outfit of OUTFITS.slice(1))for(const frame of [0,3,7]){
   expect(outfitFrame(outfit.id,form,'yawn',frame,0,8)).toEqual(outfitFrame(outfit.id,form,form==='seed'?'seed':'slumber',0,0,8))
  }
 })
 it('offers nine real original items without losing the three saved identifiers',()=>{
  expect(OUTFITS).toHaveLength(9);expect(OUTFITS.slice(0,3).map(i=>i.id)).toEqual(['party-cap','gold-feather','wizard-cap'])
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

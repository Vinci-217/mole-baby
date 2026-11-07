import {describe,it,expect} from 'vitest'
import {OFFICIAL_CLIPS,ORIGINAL_OUTFITS,officialClip,supportsOfficial,officialOutfitForm} from './official-clips'
import {ALL_OUTFITS,OUTFITS,buyOutfit,wearOutfit,normalizeWardrobe,petAppearance,outfitAnimation} from './wardrobe'
import {createPet,parseSave} from './game'
const now=Date.UTC(2026,10,7,6)
describe('bundled original animation integration',()=>{
 it('keeps every original source distinct, local and verifiable',()=>{
  expect(new Set(OFFICIAL_CLIPS.map(row=>row.id)).size).toBe(OFFICIAL_CLIPS.length)
  for(const clip of OFFICIAL_CLIPS){expect(clip.path).not.toContain('..');expect(clip.path).toMatch(/^(resource|module)\/.+\.swf$/);expect(clip.sha256).toMatch(/^[a-f0-9]{64}$/);expect(clip.bytes).toBeGreaterThan(0)}
 })
 it('uses original body rigs for separated clothing layers and never offers them on unsupported forms',()=>{
  const cap=ORIGINAL_OUTFITS.find(row=>row.sourceId==='1200001')!,clip=officialClip(cap.clipId)!
  expect(clip.base).toBe(true);expect(supportsOfficial(clip,'junior')).toBe(true);expect(supportsOfficial(clip,'seed')).toBe(false);expect(supportsOfficial(clip,'super')).toBe(false)
 })
 it('preserves old ownership and adds purchasable original outfits without resetting identity or colour',()=>{
  const pet={...createPet('保留记忆','blue',now),color:'#784fb8' as const,growth:60,coins:1000,wardrobe:['wizard-cap' as const],wearing:'wizard-cap' as const}
  const outfit=ORIGINAL_OUTFITS.find(row=>row.sourceId==='1200001')!
  const bought=buyOutfit(pet,outfit.id);expect(bought.ok).toBe(true);expect(bought.state.coins).toBe(920)
  expect(buyOutfit(bought.state,outfit.id).ok).toBe(false)
  const worn=wearOutfit(bought.state,outfit.id);expect(worn.ok).toBe(true)
  const restored=parseSave(JSON.stringify(worn.state),now)!
  expect(restored.color).toBe(pet.color);expect(restored.createdAt).toBe(pet.createdAt);expect(restored.name).toBe(pet.name);expect(restored.wearing).toBe(outfit.id);expect(restored.wardrobe).toEqual(['wizard-cap',outfit.id]);expect(restored.inventory).toEqual(pet.inventory)
  const superPet={...restored,growth:840,evolution:'super' as const},dressed=wearOutfit({...superPet,wearing:undefined},outfit.id)
  expect(dressed.ok).toBe(true);expect(dressed.state.growth).toBe(840);expect(dressed.state.evolution).toBe('super');expect(petAppearance(dressed.state).form).toBe('junior')
 })
 it('uses the junior body for junior-only clothes and preserves real intermediate/advanced variants',()=>{
  const cap=officialClip(ORIGINAL_OUTFITS.find(row=>row.sourceId==='1200001')!.clipId)!
  const juniorOnly={...cap,forms:['level2']}
  for(const form of ['junior','middle','senior','classic','super','water','wood','fire'] as const)expect(officialOutfitForm(juniorOnly,form)).toBe('junior')
  for(const form of ['junior','middle','senior'] as const)expect(officialOutfitForm(cap,form)).toBe(form)
  expect(officialOutfitForm(juniorOnly,'seed')).toBeUndefined()
  const singleBody={...cap,base:false,forms:[],level:0}
  expect(officialOutfitForm(singleBody,'senior')).toBe('junior');expect(supportsOfficial(singleBody,'senior')).toBe(false)
  const care=OFFICIAL_CLIPS.find(clip=>clip.kind==='care'&&clip.level===2)!
  expect(officialOutfitForm(care,'super')).toBeUndefined();expect(supportsOfficial(care,'super')).toBe(false)
 })
 it('restores the actual form on removing clothing and keeps growth, identity and colour through reload',()=>{
  const cap=ORIGINAL_OUTFITS.find(row=>row.sourceId==='1200001')!
  const actual={...createPet('小紫','blue',now),color:'#9c5fd4' as const,growth:840,naturalGrowth:213,highestGrowth:213,growthLocked:true,evolution:'super' as const,wardrobe:[cap.id as `original-${string}`]}
  const dressed=wearOutfit(actual,cap.id).state
  expect(petAppearance(dressed)).toEqual({stage:1,form:'junior'})
  const restored=parseSave(JSON.stringify(dressed),now)!
  for(const key of ['growth','naturalGrowth','highestGrowth','evolution','name','color','inventory','createdAt'] as const)expect(restored[key]).toEqual(actual[key])
  const removed=wearOutfit(restored).state;expect(petAppearance(removed)).toEqual({stage:4,form:'super',evolution:'super'})
  expect(petAppearance({...actual,wearing:'party-cap'}).form).toBe('junior')
  expect(petAppearance({...actual,wearing:'magic-book'}).form).toBe('super')
  for(const [growth,form] of [[180,'middle'],[420,'senior']] as const)expect(petAppearance({...dressed,growth,evolution:undefined}).form).toBe(form)
 })
 it('uses native SWF for all legacy and new clothes; switching to seed unequips but retains collection',()=>{
  expect(ALL_OUTFITS).toHaveLength(122);
  for(const outfit of ALL_OUTFITS){const clip=outfitAnimation(outfit.id);expect(clip?.kind).toBe('outfit');expect(clip?.path).toContain(outfit.sourceId+'.swf');}
 });
 it('keeps seed restrictions, existing IDs and legacy save normalization',()=>{
  expect(ALL_OUTFITS.length).toBe(OUTFITS.length+ORIGINAL_OUTFITS.length)
  const seed=createPet('种子','blue',now)
  for(const row of ORIGINAL_OUTFITS)expect(wearOutfit({...seed,wardrobe:[row.id as `original-${string}`]},row.id).ok).toBe(false)
  expect(normalizeWardrobe(['wizard-cap','wizard-cap','unknown'],'wizard-cap')).toEqual({wardrobe:['wizard-cap'],wearing:'wizard-cap'})
 })
})

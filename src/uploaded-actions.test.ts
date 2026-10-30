import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import index from '../public/assets/original/uploaded-actions/index.json'
import daily from '../public/assets/original/daily-frames/index.json'
import sources from '../research/references/uploaded-lamu-actions/sources.json'
import {ITEMS,getItem} from './catalog'
import {UPLOADED_TOYS,uploadedMotion,uploadedEffectRect,uploadedSpec} from './uploaded-actions'
import {getItemMotion} from './item-motion'
import {DAILY_FRAME_ACTIONS} from './daily-frames'
import calibration from '../research/tuya-size-calibration.json'
import visibility from '../electron/edge-visibility.json'

describe('complete supplied motion library',()=>{
 it('registers graffiti to the first body pose instead of its shrinking ending',()=>{
  expect(calibration.records).toHaveLength(16)
  for(const record of calibration.records){
   const spec=uploadedSpec(...record.key.split('-')as [string,string])!;
   const rect=uploadedEffectRect(spec,spec.form as 'middle');
   const width=record.bodyAtlasWidth/spec.width*rect.width;
   const body=visibility.forms[spec.form as 'middle'].body;
   expect(width).toBeCloseTo(body[2]-body[0],5);
   expect(JSON.parse(fs.readFileSync(`public/assets/original/uploaded-actions/${spec.assetKey}/clip.json`,'utf8')).registration).toEqual(spec.registration)
  }
  expect(uploadedSpec('junior','tuya1')!.registration.displayScale).toBeLessThan(.6)
 })
 it('routes all 247 supplied files to a consumable or a play entry without losing alias identity',()=>{
  expect(Object.keys(index)).toHaveLength(247)
  expect(new Set(Object.values(index).map(s=>s.assetKey)).size).toBe(238)
  for(const file of sources.files){
   const spec=uploadedSpec(file.form,file.id)!
   expect(spec,`${file.form}/${file.id}`).toBeDefined();expect(spec.id).toBe(file.id)
   expect(getItem(file.id)||UPLOADED_TOYS.find(t=>t.id===file.id)).toBeDefined()
   if(getItem(file.id))expect(uploadedMotion(file.form,getItemMotion(file.id).action,file.id)).toBe(spec)
   else expect(uploadedMotion(file.form,`uploaded-${file.id}`)).toBe(spec)
   const rect=uploadedEffectRect(spec,file.form as 'middle')
   expect(Object.values(rect).every(Number.isFinite)).toBe(true)
   expect(fs.existsSync(`public/assets/original/uploaded-actions/${spec.assetKey}/poster.png`)).toBe(true)
  }
  expect(ITEMS.filter(i=>i.sourceId==='180060')).toHaveLength(1)
 })
 it('does not silently replace a seed or elemental form with a different original body',()=>{
  for(const form of ['seed','super','water','wood','fire']){
   expect(uploadedMotion(form,'uploaded-180004')).toBeUndefined()
   expect(uploadedMotion(form,'feed','biscuit')).toBeUndefined()
  }
  for(const color of ['#125789','#000000','#ffffff'])expect(uploadedMotion('middle','use',`mix-${color.slice(1)}`)?.id).toBe('180005')
 })
 it('provides real frame tables for every new daily action in all nine forms',()=>{
  expect(Object.keys(daily)).toHaveLength(9*DAILY_FRAME_ACTIONS.length)
  for(const spec of Object.values(daily)){
   const clip=JSON.parse(fs.readFileSync(`public/assets/original/daily-frames/${spec.assetKey}/clip.json`,'utf8'))
   expect(clip.frameMap).toHaveLength(spec.frames);expect(clip.fps).toBe(24)
   expect(new Set(clip.frameMap).size).toBeGreaterThan(8)
   expect(clip.checks.tintedPixels).toBeGreaterThan(0);expect(clip.checks.eyeWhitePixelsPreserved).toBeGreaterThan(0)
   for(const page of clip.pages)expect(Math.max(page.width,page.height)).toBeLessThanOrEqual(2048)
  }
 })
})

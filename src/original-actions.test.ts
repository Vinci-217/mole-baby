import {describe,it,expect} from 'vitest'
import {footballSpec,footballPose,footballDuration,footballContacts,slumberFrame,ramForm} from './original-actions'
import {getRamActionDuration,sampleRamPose,sampleFlyingPose} from './components/ram-animation'
import {socialSoundScore} from './pet-sound-score'
import source from '../public/assets/original/football/manifest.json'
import slumber from '../public/assets/original/slumber/source.json'

describe('complete original performances in the desktop viewport',()=>{
 it('uses each stage’s complete 24fps source timeline and its own finite duration',()=>{
  expect([0,1,2,3,4].map(s=>ramForm(s as 0|1|2|3|4))).toEqual(['seed','junior','middle','senior','super'])
  for(const [form,clip] of Object.entries(source.forms)){
   const spec=footballSpec(form)!,duration=footballDuration(form)!
   expect(clip.sourceAction).toBe('football');expect(spec.frameCount).toBeGreaterThan(100);expect(new Set(spec.frameMap).size).toBeGreaterThan(40)
   expect(getRamActionDuration('play',form)).toBe(duration)
   for(const t of [0,20,42,750,2100,duration-1]){
    const p=footballPose(form,t);expect(p.sourceFrame).toBe(Math.floor(t/1000*24)+1);expect(p.frame).toBeLessThan(spec.rows*8);expect(p.finished).toBe(false)
   }
   expect(footballPose(form,duration).finished).toBe(true)
  }
  expect(footballSpec('seed')).toBeUndefined();expect(getRamActionDuration('play','seed')).toBe(4200)
 })
 it('keeps every source body inside the compact camera and real contact beats visible',()=>{
  for(const clip of Object.values(source.forms)){
   for(const p of clip.poses){expect(p.body[0]).toBeGreaterThanOrEqual(0);expect(p.body[1]).toBeGreaterThanOrEqual(0);expect(p.body[2]).toBeLessThanOrEqual(160);expect(p.body[3]).toBeLessThanOrEqual(192)}
   for(const frame of clip.contacts){const p=clip.poses[frame-1];expect(p.ball).not.toBeNull();const b=p.ball!;expect(b[2]).toBeGreaterThan(0);expect(b[0]).toBeLessThan(160);expect(b[3]).toBeGreaterThan(0);expect(b[1]).toBeLessThan(192)}
  }
 })
 it('uses the same reviewed source contact frames for sound and visible choreography',()=>{
  for(const [form,spec] of Object.entries(source.forms)){
   expect(socialSoundScore('play',form).cues.map(c=>c.at)).toEqual(footballContacts(form))
   for(let i=0;i<spec.contacts.length;i++)expect(footballPose(form,footballContacts(form)[i]+.01).sourceFrame).toBe(spec.contacts[i])
  }
 })
 it('holds a recognizable body/ball pose for reduced motion and still completes',()=>{
  for(const form of Object.keys(source.forms)){
   expect(footballPose(form,0,true)).toEqual(footballPose(form,2000,true));expect(footballPose(form,0,true).nearBall).toBe(true)
   expect(footballPose(form,footballDuration(form)!,true).finished).toBe(true)
  }
 })
 it('breathes through an original sleepy-eye mouth cycle and keeps affection on the normal face',()=>{
  expect(slumber.eyes).toEqual({seed:35,other:1726});expect(slumber.mouth).toBe(743)
  expect([0,1550,2850,4800,6350].map(t=>slumberFrame(t))).toEqual([0,6,0,0,6])
  for(const t of [0,900,1600,4700,1e9]){expect(slumberFrame(t,true)).toBe(0);expect(sampleRamPose('sleep',t).sheet).toBe('slumber')}
  for(const form of ['senior','super','water','wood','fire'])for(const t of [500,1000,1700])expect(sampleFlyingPose('pet',t,false,form).sheet).toBeUndefined()
 })
})

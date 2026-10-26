import {describe,it,expect} from 'vitest'
import {SCHOOL_CLIPS} from './components/RamSchool'
import {getRamActionDuration,sampleRamPose,sampleFlyingPose} from './components/ram-animation'
describe('school performances and ongoing activities have distinct lifetimes',()=>{
 it('matches the finite prop timeline and keeps studying/working until the saved activity ends',()=>{
  for(const [name,clip]of Object.entries(SCHOOL_CLIPS))expect(getRamActionDuration(name)).toBe(clip.loop?null:clip.frames/clip.fps*1000)
 })
 it('finishes skills at their end in every usable form, including reduced motion',()=>{
  for(const form of ['junior','middle','senior','super','water','wood','fire'])for(const [name,clip]of Object.entries(SCHOOL_CLIPS))for(const reduced of [false,true]){
   const sample=(t:number)=>['junior','middle'].includes(form)?sampleRamPose(name,t,reduced,form):sampleFlyingPose(name,t,reduced,form)
   if(clip.loop){expect(sample(60_000).finished).toBe(false);continue}
   const duration=clip.frames/clip.fps*1000;expect(sample(duration-1).finished).toBe(false);expect(sample(duration).finished).toBe(true)
  }
 })
 it('uses both original walking directions during a serving cycle',()=>{
  for(const form of ['junior','middle']){
   const rows=new Set(Array.from({length:30},(_,i)=>sampleRamPose('restaurant',i*100,false,form).row))
   expect(rows.has(1)).toBe(true);expect(rows.has(2)).toBe(true)
  }
 })
})

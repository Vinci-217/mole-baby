import { describe, expect, it } from 'vitest'
import {sleepPose,dozyPose} from '../original-actions'
import { getRamActionDuration, sampleRamPose, sampleSeedPose, sampleEvolvedPose, sampleFlyingPose } from './ram-animation'

describe('original Ram care animation contract', () => {
  it.each([
    ['feed', 0, 1200], ['eat', 0, 1200], ['drink', 1, 1200],
    ['wash', 2, 1500], ['use', 3, 900], ['medical', 3, 900],
  ] as const)('%s plays its own source row once, then finishes', (action, row, duration) => {
    expect(getRamActionDuration(action)).toBe(duration)
    expect(sampleRamPose(action, 0)).toEqual({ sheet: 'care', row, frame: 0, finished: false })
    expect(sampleRamPose(action, duration - 1)).toEqual({ sheet: 'care', row, frame: 15, finished: false })
    expect(sampleRamPose(action, duration)).toEqual({ row: 0, frame: 0, finished: true })
    expect(sampleRamPose(action, 10000).finished).toBe(true)
    expect(sampleRamPose(action, duration, true).finished).toBe(true)
  })
  it('holds genuine closed-eye source frames in every motion preference', () => {
    for (const reduced of [false, true]) for (const time of [0, 400, 9000, 1e9]) {
      expect(sampleRamPose('sleep', time, reduced)).toEqual(sleepPose(time,reduced))
      expect(sampleSeedPose('sleep', time, reduced)).toEqual(sleepPose(time,reduced))
    }
  })
  it.each(['hungry', 'thirsty', 'sick', 'tired', 'dirty', 'sad'])('%s retains a condition pose after its initial reaction', action => {
    expect(getRamActionDuration(action)).toBeNull()
    const held = sampleRamPose(action, 7000)
    expect(held.finished).toBe(false)
    expect(held.row).toBeGreaterThan(0)
    expect(sampleRamPose(action, 16000).finished).toBe(false)
  })
  it('keeps seed interaction frames bounded and finite without animating the pot', () => {
    for (const action of ['feed', 'drink', 'wash', 'use', 'pet', 'wake', 'reward']) {
      const duration = getRamActionDuration(action)!
      for (let t = 0; t < duration; t += 20) {
        const pose = sampleSeedPose(action, t)
        expect(pose.frame).toBeGreaterThanOrEqual(0)
        if(action==='pet'||action==='wake')expect([0,61]).toContain(pose.frame)
        else expect(pose.frame).toBeLessThanOrEqual(24)
      }
      expect(sampleSeedPose(action, duration)).toEqual({ frame: 0, finished: true })
    }
  })
  it('keeps seed drowsy rendering on the same short timeline as its completion signal',()=>{
    for(const reduced of [false,true])for(const time of [0,200,700,1600,2200,2300,2399,2400,5000]){
      expect(sampleSeedPose('mood-dozy',time,reduced)).toEqual(dozyPose(time,reduced,'seed'))
      expect(sampleRamPose('mood-dozy',time,reduced,'seed')).toEqual(dozyPose(time,reduced,'seed'))
    }
  })
  it('uses separate static drag and catch reactions without jumping rows', () => {
    expect(sampleRamPose('drag', 1000)).toEqual({ row: 0, frame: 0, finished: false })
    for (const time of [0, 80, 160, 240]) expect(sampleRamPose('catch', time).row).toBe(0)
    expect(sampleRamPose('catch', 249).finished).toBe(true)
  })
  it('keeps god-power care in its own nine-row atlas and ends every finite gesture', () => {
    for (const action of ['feed', 'drink', 'wash', 'medical', 'brush-teeth', 'bubble-bath']) {
      const duration = getRamActionDuration(action)!
      for (let t = 0; t < duration; t += 40) {
        const pose = sampleEvolvedPose(action, t)
        expect(pose.sheet).toBeUndefined()
        expect(pose.row).toBe(0)
        expect(pose.frame).toBeLessThan(6)
      }
      expect(sampleEvolvedPose(action, duration).finished).toBe(true)
    }
    expect(sampleSeedPose('drag', 3000)).toEqual({ frame: 0, finished: false })
  })
})


describe('continuous original airborne posture',()=>{
 it('faces movement using all eight original side poses across every airborne form',()=>{
  for(const form of ['senior','super','water','wood','fire'])for(const [action,row] of [['walk-left',2],['walk-right',1],['running-left',2],['running-right',1]] as const){
   const frames=new Set<number>();
   for(let t=0;t<1000;t+=10){const pose=sampleFlyingPose(action,0,false,form,t);expect(pose.row).toBe(row);expect(pose.sheet).toBeUndefined();expect(pose.finished).toBe(false);frames.add(pose.frame);}
   expect([...frames].sort()).toEqual([0,1,2,3,4,5,6,7]);
  }
 });
 it('retains original 24fps side holds and shared phase when reversing or stopping',()=>{
  const step=1000/24;
  for(const form of ['senior','super','water','wood','fire']){
   const starts=form==='super'?[1,4,6,9,11,14,16,19]:form==='senior'?[1,2,3,4,5,6,7,8]:[1,2,3,4,6,7,8,9];
   const count=form==='super'?21:11;
   for(let source=1;source<=count;source++){
    const t=(source-1)*step+.1,frame=starts.filter(s=>s<=source).length-1;
    expect(sampleFlyingPose('walk-left',0,false,form,t)).toEqual({row:2,frame,finished:false});
    expect(sampleFlyingPose('walk-right',0,false,form,t)).toEqual({row:1,frame,finished:false});
    const front=form==='super'?[1,5,8,12,15,19]:form==='senior'?[1,3,4,6,7,8]:[1,3,4,6,7,9];
    expect(sampleFlyingPose('idle',0,false,form,t)).toEqual({row:0,frame:front.filter(s=>s<=source).length-1,finished:false});
   }
   expect(sampleFlyingPose('walk-left',0,false,form,count*step+.1).frame).toBe(0);
  }
 });
 it('keeps reduced-motion facing while preserving sleep and drag poses',()=>{
  for(const form of ['senior','super','water','wood','fire']){
   expect(sampleFlyingPose('walk-left',800,true,form)).toEqual({row:2,frame:0,finished:false});
   expect(sampleFlyingPose('walk-right',800,true,form)).toEqual({row:1,frame:0,finished:false});
   for(const action of ['still'])expect(sampleFlyingPose(action,800,false,form)).toEqual({row:0,frame:0,finished:false});
   expect(sampleFlyingPose('drag',800,true,form)).toEqual({row:0,frame:0,finished:false});expect(sampleFlyingPose('drag',800,false,form)).toEqual(sampleFlyingPose('idle',800,false,form));
   expect(sampleFlyingPose('sleep',800,true,form)).toEqual({sheet:'slumber',row:0,frame:0,finished:false});
  }
 });
 it('ends both new curiosity gestures in every stage and never changes an airborne source registration',()=>{
  for(const action of ['look-around','watch-butterfly']){
   const duration=getRamActionDuration(action)!;expect(duration).toBeGreaterThan(0);
   expect(sampleRamPose(action,duration).finished).toBe(true);expect(sampleSeedPose(action,duration).finished).toBe(true);
   for(const form of ['senior','super','water','wood','fire'])for(const t of [0,800,1800,duration]){
    const pose=sampleFlyingPose(action,t,false,form,t);expect(pose.row).toBe(0);expect(pose.sheet).toBeUndefined();expect(pose.finished).toBe(t===duration);
   }
  }
 });
 it('cycles the source down row throughout idle and affection without switching registration',()=>{
  for(const form of ['senior','super','water','wood','fire']){
   const frames=new Set<number>();for(let t=0;t<2000;t+=20){const pose=sampleFlyingPose('idle',t,false,form);expect(pose.row).toBe(0);expect(pose.sheet).toBeUndefined();frames.add(pose.frame);expect(sampleFlyingPose('pet',t%2000,false,form,t).frame).toBe(pose.frame);}
   expect(frames.size).toBe(6);
   expect(sampleFlyingPose('pet',0,false,form,350).frame).toBe(sampleFlyingPose('idle',350,false,form,350).frame);
   expect(sampleFlyingPose('idle',1000,true,form).frame).toBe(0);expect(sampleFlyingPose('sleep',1000,false,form).sheet).toBe('slumber');
  }
 });
 it('keeps the original large eyes on hand contact without restarting the flight frame',()=>{
  for(const form of ['senior','super','water','wood','fire'])for(const time of [500,800,1200,1700]){
   const pet=sampleFlyingPose('pet',time,false,form,1370+time);
   expect(pet.sheet).toBeUndefined();expect(pet.row).toBe(0);
   expect(pet.frame).toBe(sampleFlyingPose('idle',0,false,form,1370+time).frame);
  }
  expect(sampleSeedPose('pet',800).frame).toBe(0);
  expect(sampleSeedPose('play',3800).frame).toBe(0);
  expect(sampleSeedPose('wake',0).frame).toBe(0);
  expect(sampleSeedPose('wake',600).frame).toBe(0);
  expect(getRamActionDuration('wake')).toBe(1800);
 });
});

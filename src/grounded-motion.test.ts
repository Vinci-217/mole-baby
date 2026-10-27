import {describe,it,expect} from 'vitest'
import {groundedMotion,usesGroundedPose} from './grounded-motion'
describe('calm original junior and middle layers',()=>{
 it('returns from a brief doze to the same shadow-free resting body',()=>{
  for(const form of ['junior','middle'])expect(usesGroundedPose(form,'mood-dozy')).toBe(true)
 })
 it('leaves sleep and football to their original action sheets and keeps affection eyes open',()=>{for(const form of ['junior','middle']){expect(usesGroundedPose(form,'sleep')).toBe(false);expect(usesGroundedPose(form,'play')).toBe(false);expect([0,300,600].map(t=>groundedMotion(form,'wake',t,t).frame)).toEqual([0,0,0]);expect(groundedMotion(form,'pet',800,800,true).frame).toBe(0)}})
 it('retains a stable body for social actions without affecting care or flying forms',()=>{for(const f of ['junior','middle'])for(const a of ['idle','pet','focus','watch-butterfly','look-around','drag'])expect(usesGroundedPose(f,a)).toBe(true);for(const f of ['seed','senior','super','water','wood','fire'])expect(usesGroundedPose(f,'idle')).toBe(false);expect(usesGroundedPose('middle','eat-bear-biscuit')).toBe(false)})
 it('blinks through half, closed and open eyes without changing the body registration',()=>{expect([5200,5270,5320,5390,5420].map(t=>groundedMotion('junior','idle',t,t).frame)).toEqual([0,1,2,1,0]);expect(groundedMotion('middle','idle',0,4020).frame).toBe(2)})
 it('keeps the calm response in normal eyes with two short blinks',()=>{for(const form of ['junior','middle']){const frames=Array.from({length:36},(_,i)=>groundedMotion(form,'mood-content',i*100,i*100).frame);expect(frames).not.toContain(2);expect(frames.filter(f=>f===0).length).toBeGreaterThan(30)}})
 it('looks up at hand contact with normal eyes and reads downward',()=>{expect(groundedMotion('junior','pet',800,800).frame).toBe(0);expect(groundedMotion('middle','focus',500,500).eyeY).toBe(1.45)})
 it('keeps continuous small gaze/leaf movement and stays still for reduced motion or dragging',()=>{for(const f of ['junior','middle']){let prev=groundedMotion(f,'idle',0,0);for(let t=16;t<18000;t+=16){const p=groundedMotion(f,'idle',t,t);expect(Math.abs(p.eyeX-prev.eyeX)).toBeLessThan(.02);expect(Math.abs(p.leafAngle-prev.leafAngle)).toBeLessThan(.02);prev=p}for(const a of ['still'])expect(groundedMotion(f,a,1500,1500)).toEqual({frame:0,eyeX:0,eyeY:0,leafAngle:0});expect(Math.abs(groundedMotion(f,'drag',1500,1500).eyeX)).toBeLessThan(2.4);expect(groundedMotion(f,'focus',1500,1500,true)).toEqual({frame:0,eyeX:0,eyeY:0,leafAngle:0})}})
})

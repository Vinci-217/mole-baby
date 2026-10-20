import { describe,it,expect } from 'vitest';
import { sampleSocialMotion, SOCIAL_DURATIONS } from './social-motion';
import type { Stage } from './game';
describe('stage-specific prop and body choreography',()=>{
  it('keeps butterfly curiosity gentle, bounded and still with reduced motion',()=>{
    for(const stage of [0,1,2,3,4] as Stage[])for(let t=0;t<6500;t+=80){
      const p=sampleSocialMotion(stage,'watch-butterfly',t);expect(p.butterflyX).toBeGreaterThanOrEqual(34);expect(p.butterflyX).toBeLessThanOrEqual(84);expect(p.butterflyY).toBeGreaterThanOrEqual(16);expect(Math.abs(p.bodyAngle)).toBeLessThanOrEqual(stage>=3?.7:2.5);if(stage===0)expect(p.bodyY).toBe(0);
    }
    expect(sampleSocialMotion(4,'watch-butterfly',0,true)).toEqual(sampleSocialMotion(4,'watch-butterfly',1000,true));
  });
  it('orbits three stars horizontally above each head with depth instead of spinning a flat triangle',()=>{
    for(const stage of [0,1,2,3,4] as Stage[]){
      const a=sampleSocialMotion(stage,'dizzy',300),b=sampleSocialMotion(stage,'dizzy',600);
      expect(a.orbit).toHaveLength(3);expect(a.orbit.map(v=>v.x)).not.toEqual(b.orbit.map(v=>v.x));
      expect(Math.max(...a.orbit.map(v=>v.y))-Math.min(...a.orbit.map(v=>v.y))).toBeLessThan(7);
      expect(a.orbit.every(v=>v.y<23)).toBe(true);expect(Math.abs(a.bodyAngle)).toBeLessThan(1);
    }
  });
  it('holds a reading pose and turns a separate page right to left around its binding',()=>{
    const still=sampleSocialMotion(2,'focus',3000),turn=sampleSocialMotion(2,'focus',6500),later=sampleSocialMotion(2,'focus',7300);
    expect(still.pageOpacity).toBe(0);expect(turn.pageOpacity).toBeGreaterThan(.5);expect(turn.page).toBeLessThan(0);expect(later.page).toBeLessThan(turn.page);expect(turn.readTilt).toBeGreaterThan(4);
  });
  it('never lifts the seed pot, keeps props within the native pet area and ends gestures',()=>{
    for(const stage of [0,1,2,3,4] as Stage[]) for(const action of ['pet','play','dizzy'] as const){
      const duration=SOCIAL_DURATIONS[action];
      for(let t=0;t<duration;t+=40){const pose=sampleSocialMotion(stage,action,t);expect(Object.values(pose).every(v=>typeof v!=='number'||Number.isFinite(v))).toBe(true);expect(pose.ballX).toBeGreaterThan(70);expect(pose.ballX).toBeLessThanOrEqual(115);if(stage===0)expect(pose.bodyY).toBe(0);}
      expect(sampleSocialMotion(stage,action,duration).finished).toBe(true);
    }
  });
  it('uses different head, ball and book anchors for every stage and crown',()=>{
    const poses=([0,1,2,3,4] as Stage[]).map(stage=>sampleSocialMotion(stage,'play',1050));
    expect(new Set(poses.map(p=>p.ballX)).size).toBe(5);
    expect(new Set(poses.map(p=>p.bookY)).size).toBe(5);
    expect(sampleSocialMotion(4,'play',1050,false,'water').ballX).not.toBe(sampleSocialMotion(4,'play',1050,false,'wood').ballX);
  });
  it('keeps reduced-motion props visible and still, while focus stays until cancelled',()=>{
    for(const action of ['pet','play','focus','dizzy'] as const){const a=sampleSocialMotion(0,action,0,true),b=sampleSocialMotion(0,action,1000,true);expect(a).toEqual(b);expect(a.opacity).toBe(1);}
    expect(sampleSocialMotion(2,'focus',1e9).finished).toBe(false);
  });
});

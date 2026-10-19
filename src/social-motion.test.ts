import { describe,it,expect } from 'vitest';
import { sampleSocialMotion, SOCIAL_DURATIONS } from './social-motion';
import type { Stage } from './game';
describe('stage-specific prop and body choreography',()=>{
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

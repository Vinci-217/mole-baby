import { describe,it,expect } from 'vitest';
import { sampleSocialMotion, SOCIAL_DURATIONS, BALL_CONTACTS } from './social-motion';
import type { Stage } from './game';
describe('stage-specific prop and body choreography',()=>{
  it('anticipates, contacts and recovers on the two ball beats, without a snap or a moving seed pot',()=>{
    for(const stage of [0,1,2,3,4] as Stage[])for(const at of BALL_CONTACTS){
      const prepare=sampleSocialMotion(stage,'play',at-180),touch=sampleSocialMotion(stage,'play',at),recover=sampleSocialMotion(stage,'play',at+200);
      expect(touch.contact).toBe(1);expect(prepare.bodyScaleY).toBeLessThan(1);
      expect(touch.bodyScaleY).toBeGreaterThan(1);expect(touch.bodyAngle).toBeGreaterThan(stage>=3?2:5);
      expect(recover.contact).toBeLessThan(.02);expect(recover.bodyAngle).toBeLessThan(touch.bodyAngle);
      if(stage===0){expect(touch.bodyX).toBe(0);expect(touch.bodyY).toBe(0)}else expect(touch.bodyX).toBeGreaterThan(3);
    }
    for(const stage of [0,1,2,3,4] as Stage[])for(const action of ['pet','play','wake'] as const){
      let prev=sampleSocialMotion(stage,action,0);
      for(let t=16;t<SOCIAL_DURATIONS[action];t+=16){const p=sampleSocialMotion(stage,action,t);expect(Math.abs(p.bodyX-prev.bodyX)).toBeLessThan(1);expect(Math.abs(p.bodyAngle-prev.bodyAngle)).toBeLessThan(1.5);prev=p}
      const end=sampleSocialMotion(stage,action,SOCIAL_DURATIONS[action]);expect(end.bodyX).toBeCloseTo(0);expect(end.bodyY).toBeCloseTo(0);expect(end.bodyAngle).toBeCloseTo(0);expect(end.bodyScaleX).toBeCloseTo(1);expect(end.bodyScaleY).toBeCloseTo(1);
    }
  });
  it('settles the hand on the head, follows strokes and leaves a brief affection response',()=>{
    const arrival=sampleSocialMotion(1,'pet',0),contact=sampleSocialMotion(1,'pet',480),stroke=sampleSocialMotion(1,'pet',620),thanks=sampleSocialMotion(1,'pet',2050);
    expect(arrival.handX).toBeGreaterThan(contact.handX+20);expect(stroke.handX).not.toBe(contact.handX);
    expect(contact.bodyScaleY).toBeLessThan(.96);expect(stroke.bodyAngle).toBeGreaterThan(3);
    expect(thanks.affection).toBeGreaterThan(.8);expect(thanks.heartY).toBeLessThan(0);
  });
  it('swings a net twice while the butterfly dodges, with stage-specific gentle reactions',()=>{
    for(const stage of [0,1,2,3,4] as Stage[])for(let t=0;t<6500;t+=80){
      const p=sampleSocialMotion(stage,'watch-butterfly',t);expect(p.butterflyX).toBeGreaterThanOrEqual(28);expect(p.butterflyX).toBeLessThanOrEqual(128);expect(p.butterflyY).toBeGreaterThanOrEqual(-8);expect(Math.abs(p.bodyAngle)).toBeLessThanOrEqual(stage>=3?2:stage===0?4:5);if(stage===0)expect(p.bodyY).toBe(0);
    }
    for(const stage of [0,1,2,3,4]as Stage[]){const near=sampleSocialMotion(stage,'watch-butterfly',1550),dodge=sampleSocialMotion(stage,'watch-butterfly',1850);expect(Math.hypot(near.butterflyX-near.hoopX,near.butterflyY-near.hoopY)).toBeLessThan(4);expect(Math.hypot(dodge.butterflyX-dodge.hoopX,dodge.butterflyY-dodge.hoopY)).toBeGreaterThan(16)}
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

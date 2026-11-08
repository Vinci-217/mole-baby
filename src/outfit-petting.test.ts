import {describe,it,expect} from 'vitest';
import {outfitPettingPose,validOutfitBody,OUTFIT_PETTING_DURATION} from './outfit-petting';
describe('petting contact follows the displayed costume body',()=>{
 it('locates the hand from the source body, including junior costumes worn by a super Ram',()=>{
  const junior={x:17,y:36,width:65,height:45},small={x:26,y:65,width:44,height:32};
  const a=outfitPettingPose(junior,1000,1),b=outfitPettingPose(small,1000,1);
  expect(b.handY).toBeGreaterThan(a.handY+20);expect(b.handWidth).toBeLessThan(a.handWidth);
  expect(b.originY).toBeCloseTo(97/108*100);expect(a.originY).toBeCloseTo(81/108*100);
 });
 it('keeps contact geometry finite and gentle across every stage, source size and time',()=>{
  for(const stage of [1,2,3,4] as const)for(const body of [{x:17,y:36,width:65,height:45},{x:26,y:65,width:44,height:32},{x:10,y:20,width:80,height:70},{x:36,y:55,width:28,height:22}])for(let t=0;t<=OUTFIT_PETTING_DURATION;t+=80){
   const p=outfitPettingPose(body,t,stage);
   for(const key of ['handX','handY','handWidth','originX','originY','heartX','heartY','heartSize'] as const)expect(Number.isFinite(p[key])).toBe(true);
   expect(p.handWidth).toBeGreaterThanOrEqual(18);expect(p.handWidth).toBeLessThanOrEqual(58);
   expect(p.pose.bodyScaleX).toBeGreaterThanOrEqual(1);expect(p.pose.bodyScaleX).toBeLessThanOrEqual(1.035);
   expect(p.pose.bodyScaleY).toBeGreaterThanOrEqual(.955);expect(p.pose.bodyScaleY).toBeLessThanOrEqual(1);
  }
 });
 it('retains the costume but removes movement when reduced motion is requested',()=>{
  const p=outfitPettingPose({x:26,y:65,width:44,height:32},1200,1,undefined,true);
  expect(p.pose.bodyAngle).toBe(0);expect(p.pose.bodyScaleX).toBe(1);expect(p.pose.bodyScaleY).toBe(1);
  expect(p.handWidth).toBeGreaterThan(0);
 });
 it('rejects empty source/control frames without losing the last valid contact point',()=>{
  for(const bad of [null,{}, {x:NaN,y:1,width:20,height:20},{x:0,y:0,width:0,height:0}])expect(validOutfitBody(bad)).toBe(false);
  expect(validOutfitBody({x:26,y:65,width:44,height:32})).toBe(true);
 });
});

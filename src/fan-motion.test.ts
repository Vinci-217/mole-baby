import {describe,it,expect} from 'vitest';
import {createFanMotion,sourceFlightPose,stepFanMotion} from './fan-motion';
import flight from '../public/assets/original/flight/runtime.json';

it('plays the original senior and classic loops across their control frames',()=>{
 for(const form of ['senior','classic'] as const){
  const clip=flight.forms[form].clips.down;
  for(const pose of clip.frames)expect(sourceFlightPose(clip,(pose.sourceFrame-1+.5)*1000/flight.fps,flight.fps)).toEqual(pose);
  for(const sourceFrame of clip.emptyControlFrames){
   const visible=sourceFlightPose(clip,(sourceFrame-1+.5)*1000/flight.fps,flight.fps);
   expect(visible.sourceFrame).toBe(sourceFrame-1);
  }
  expect(sourceFlightPose(clip,(clip.sourceFrameCount+.5)*1000/flight.fps,flight.fps)).toEqual(clip.frames[0]);
 }
});
import {createElasticDrag,pullElasticDrag,stepElasticDrag,releaseElasticDrag} from './drag-motion';

describe('senior original crown interaction',()=>{
 it('spins faster for a faster horizontal drag and settles smoothly after release',()=>{
  const slow=createFanMotion(),fast=createFanMotion();
  for(let i=0;i<60;i++){stepFanMotion(slow,16,80,null);stepFanMotion(fast,16,1000,null)}
  expect(fast.speed).toBeGreaterThan(slow.speed*3);expect(fast.speed).toBeLessThanOrEqual(3.2);
  const before=fast.speed;stepFanMotion(fast,16,0,null);expect(fast.speed).toBeLessThan(before);expect(fast.speed).toBeGreaterThan(.28);
  for(let i=0;i<300;i++)stepFanMotion(fast,16,0,null);
  expect(fast.speed).toBeCloseTo(.28,5);expect(fast.angle).toBeGreaterThanOrEqual(0);expect(fast.angle).toBeLessThan(Math.PI*2);
 });
 it('gives petting a finite boost and respects reduced motion and invalid samples',()=>{
  const state=createFanMotion();for(let i=0;i<20;i++)stepFanMotion(state,16,0,i*16);
  expect(state.speed).toBeGreaterThan(1);
  stepFanMotion(state,16,NaN,null);expect(Number.isFinite(state.speed)).toBe(true);
  stepFanMotion(state,Infinity,Infinity,null);expect(Number.isFinite(state.angle)).toBe(true);
  stepFanMotion(state,16,3000,0,true);expect(state).toEqual({speed:0,angle:0});
 });
 it('measures screen-coordinate velocity rather than displacement and decays it at rest',()=>{
  const slow=createElasticDrag(),fast=createElasticDrag();
  for(const state of [slow,fast])pullElasticDrag(state,{x:100,y:100,at:1000},3);
  pullElasticDrag(slow,{x:110,y:100,at:1100},3);pullElasticDrag(fast,{x:110,y:100,at:1010},3);
  expect(fast.horizontalSpeed).toBe(slow.horizontalSpeed*10);
  releaseElasticDrag(fast);stepElasticDrag(fast,32);expect(fast.horizontalSpeed).toBeLessThan(1000);
 });
});

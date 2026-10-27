import {describe,it,expect} from 'vitest'
import {dragSpec,dragRegistration,sampleDragPose} from './drag-poses'
import {createElasticDrag,pullElasticDrag,stepElasticDrag,releaseElasticDrag} from './drag-motion'
describe('directional dragging is a moving character rather than a translated still',()=>{
 it('keeps middle at its resting body size and baseline when picked up',()=>{
  const {scale,x,y}=dragRegistration('middle'),spec=dragSpec('middle'),pose=spec.poses[spec.clips.down.frameMap[0]]
  expect(pose.body[0]*scale+x).toBeCloseTo(pose.wearBody[0],5)
  expect(pose.body[2]*scale+x).toBeCloseTo(pose.wearBody[2],5)
  expect(pose.body[3]*scale+y).toBeCloseTo(pose.wearBody[3],5)
  expect(pose.body[1]*scale+y).toBeCloseTo(pose.wearBody[1],0)
  expect(dragRegistration('junior')).toEqual({scale:1,x:0,y:0})
 })
 it('turns through original front, diagonal and side views in both forms',()=>{
  for(const form of ['junior','middle'] as const){
   expect([-1,-.4,0,.4,1].map(view=>sampleDragPose(form,view,0).direction)).toEqual(['left','leftdown','down','rightdown','right'])
   for(const view of [-1,1]){const frames=new Set(Array.from({length:64},(_,i)=>sampleDragPose(form,view,i*4).index));expect(frames.size).toBeGreaterThanOrEqual(15)}
  }
 })
 it('shares the exact body frame and phase in every view, not a second approximation',()=>{
  for(const view of [-1,-.4,0,.4,1])for(let distance=0;distance<500;distance+=3){
   const junior=sampleDragPose('junior',view,distance),middle=sampleDragPose('middle',view,distance)
   for(const key of ['index','row','frame','direction','phase','sourceFrame','body'] as const)expect(middle[key]).toEqual(junior[key])
  }
 })
 it('keeps all fifteen original body frames in each direction for both forms',()=>{
  expect(dragSpec('middle').bodyFrom).toBe('junior');expect(dragSpec('middle').clips).toEqual(dragSpec('junior').clips)
  expect(dragSpec('middle').frameCount).toBe(75)
  for(const clip of Object.values(dragSpec('middle').clips))expect(clip.frameCount).toBe(15)
 })
 it('responds to slow left/right dragging without requiring the shake threshold',()=>{
  const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:1000},2)
  for(let i=1;i<=25;i++){pullElasticDrag(s,{x:i*2,y:0,at:1000+i*16},2);stepElasticDrag(s,16)}
  expect(s.view).toBeGreaterThan(.66);expect(s.phaseDistance).toBeGreaterThan(12);expect(s.y).toBe(0)
  for(let i=1;i<=30;i++){pullElasticDrag(s,{x:50-i*2,y:0,at:1400+i*16},2);stepElasticDrag(s,16)}
  expect(s.view).toBeLessThan(-.66);releaseElasticDrag(s);for(let i=0;i<160;i++)stepElasticDrag(s,16);expect(Math.abs(s.view)).toBeLessThan(.001)
 })
 it('preserves the original body poses across extension and squeezing',()=>{
  const spec=dragSpec('middle')
  for(const clip of Object.values(spec.clips)){
   const widths=clip.frameMap.map(i=>spec.poses[i].body[2]-spec.poses[i].body[0]);expect(Math.max(...widths)-Math.min(...widths)).toBeGreaterThan(12)
  }
 })
 it('holds a front pose for reduced motion instead of removing the pet',()=>{
  for(const form of ['junior','middle'] as const)expect(sampleDragPose(form,1,900,true)).toEqual(sampleDragPose(form,-1,0,true))
 })
})

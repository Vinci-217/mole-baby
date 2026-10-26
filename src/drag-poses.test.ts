import {describe,it,expect} from 'vitest'
import {dragSpec,sampleDragPose} from './drag-poses'
import {createElasticDrag,pullElasticDrag,stepElasticDrag,releaseElasticDrag} from './drag-motion'
describe('directional dragging is a moving character rather than a translated still',()=>{
 it('turns through original front, diagonal and side views in both forms',()=>{
  for(const form of ['junior','middle'] as const){
   expect([-1,-.4,0,.4,1].map(view=>sampleDragPose(form,view,0).direction)).toEqual(['left','leftdown','down','rightdown','right'])
   for(const view of [-1,1]){const frames=new Set(Array.from({length:64},(_,i)=>sampleDragPose(form,view,i*4,false,i/32).index));expect(frames.size).toBeGreaterThanOrEqual(15)}
  }
 })
 it('keeps original middle proportions with a fixed foot baseline and no airborne poses',()=>{
  const spec=dragSpec('middle');expect(spec.bodyFrom).toBe('middle');expect(spec.sampling).toBe('compression')
  const bottoms=spec.poses.map(p=>p.body[3]);expect(Math.max(...bottoms)-Math.min(...bottoms)).toBeLessThanOrEqual(1)
  for(const clip of Object.values(spec.clips)){
   const neutral=spec.poses[clip.frameMap[0]]
   for(const index of clip.frameMap)expect(spec.poses[index].body[1]).toBeGreaterThanOrEqual(neutral.body[1]-2)
  }
 })
 it('uses generated original-middle inbetweens instead of grafting a crown on junior',()=>{
  expect(dragSpec('middle').frameCount).toBe(85)
  for(const clip of Object.values(dragSpec('middle').clips))expect(clip.frameCount).toBe(17)
  expect(sampleDragPose('middle',0,0).body).not.toEqual(sampleDragPose('junior',0,0).body)
 })
 it('responds to slow left/right dragging without requiring the shake threshold',()=>{
  const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:1000},2)
  for(let i=1;i<=25;i++){pullElasticDrag(s,{x:i*2,y:0,at:1000+i*16},2);stepElasticDrag(s,16)}
  expect(s.view).toBeGreaterThan(.66);expect(s.phaseDistance).toBeGreaterThan(12);expect(s.y).toBe(0)
  for(let i=1;i<=30;i++){pullElasticDrag(s,{x:50-i*2,y:0,at:1400+i*16},2);stepElasticDrag(s,16)}
  expect(s.view).toBeLessThan(-.66);releaseElasticDrag(s);for(let i=0;i<160;i++)stepElasticDrag(s,16);expect(Math.abs(s.view)).toBeLessThan(.001)
 })
 it('samples all reviewed compression frames without changing the source expression',()=>{
  const frames=new Set(Array.from({length:17},(_,i)=>sampleDragPose('middle',1,0,false,i/16).index));expect(frames.size).toBe(17)
  expect(sampleDragPose('middle',1,0,false,1).body[3]).toBe(sampleDragPose('middle',1,0,false,0).body[3])
 })
 it('holds a front pose for reduced motion instead of removing the pet',()=>{
  for(const form of ['junior','middle'] as const)expect(sampleDragPose(form,1,900,true)).toEqual(sampleDragPose(form,-1,0,true))
 })
})

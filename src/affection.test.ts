import {describe,it,expect} from 'vitest'
import source from '../public/assets/original/affection/source.json'
import {affectionFrame} from './original-actions'
describe('original gentle closed-eye petting',()=>{
 it('uses the real smile before the wide laugh and keeps body registration steady',()=>{
  for(const [form,spec] of Object.entries(source.forms)){
   expect(spec.sourceAction).toBe('happy');expect(spec.sourceFrames).toHaveLength(8);expect(Math.max(...spec.sourceFrames)).toBeLessThanOrEqual(4)
   const centres=spec.body.map(b=>(b[0]+b[2])/2),bottoms=spec.body.map(b=>b[3]);expect(Math.max(...centres)-Math.min(...centres)).toBeLessThan(.01);expect(Math.max(...bottoms)-Math.min(...bottoms)).toBeLessThan(.01)
   if(['senior','water','wood','fire'].includes(form))expect(new Set(spec.sourceFrames)).toEqual(new Set([1]))
  }
 })
 it('holds the small source smile through contact and finishes without stretching the face',()=>{
  const frames=new Set<number>();for(let t=180;t<2200;t+=20){const f=affectionFrame(t);expect(f).toBeGreaterThanOrEqual(0);expect(f).toBeLessThan(8);frames.add(f);expect(affectionFrame(t,true)).toBe(0)}expect(frames.size).toBe(8)
 })
})

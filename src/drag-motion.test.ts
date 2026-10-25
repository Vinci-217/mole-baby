import{describe,it,expect}from'vitest'
import{createElasticDrag,pullElasticDrag,stepElasticDrag,releaseElasticDrag}from'./drag-motion'
import type{Stage}from'./game'
describe('elastic visual dragging with an unchanged native grab point',()=>{
 it('lags opposite both cursor axes, uses distinct stages and settles after release',()=>{
  const strains=[]
  for(const stage of [0,1,2,3,4]as Stage[]){const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:1000},stage)
   for(let i=1;i<=18;i++){pullElasticDrag(s,{x:i*10,y:i*2,at:1000+i*16},stage);stepElasticDrag(s,16)}
   expect(s.x).toBeLessThan(-1);expect(s.y).toBeLessThan(0);expect(s.stretch).toBeGreaterThan(0);strains.push(s.stretch)
   const before=s.x;releaseElasticDrag(s);stepElasticDrag(s,16);expect(Math.abs(s.x-before)).toBeLessThan(2)
   for(let i=0;i<180;i++)stepElasticDrag(s,16)
   expect(Math.abs(s.x)).toBeLessThan(.001);expect(Math.abs(s.angle)).toBeLessThan(.001);expect(Math.abs(s.stretch)).toBeLessThan(.001)
  }
  expect(new Set(strains).size).toBe(5);expect(strains[0]).toBeLessThan(strains[1]/3)
 })
 it('reacts to a deliberate reversal then gets dizzy only after repeated shaking',()=>{
  const s=createElasticDrag();expect(pullElasticDrag(s,{x:0,y:0,at:100},1)).toBeNull();expect(pullElasticDrag(s,{x:20,y:0,at:130},1)).toBeNull()
  expect(pullElasticDrag(s,{x:0,y:0,at:160},1)).toBe('turn');expect(pullElasticDrag(s,{x:20,y:0,at:190},1)).toBe('turn');expect(pullElasticDrag(s,{x:0,y:0,at:220},1)).toBe('dizzy')
  expect(pullElasticDrag(s,{x:20,y:0,at:1400},1)).toBeNull();expect(s.turns).toBe(0)
 })
 it('rejects duplicate timestamps and bounds extreme deltas, stalls and reduced motion',()=>{
  const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:10},2);pullElasticDrag(s,{x:100000,y:-100000,at:10},2);expect(s.targetX).toBe(0)
  for(let i=1;i<200;i++){pullElasticDrag(s,{x:i%2?100000:-100000,y:i%3?100000:-100000,at:i*16+10},2);stepElasticDrag(s,10000);expect([s.x,s.y,s.angle,s.stretch].every(Number.isFinite)).toBe(true);expect(Math.abs(s.angle)).toBeLessThanOrEqual(25);expect(Math.abs(s.stretch)).toBeLessThanOrEqual(.13)}
  stepElasticDrag(s,16,true);expect([s.x,s.y,s.angle,s.stretch]).toEqual([0,0,0,0])
 })
})

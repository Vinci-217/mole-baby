import{describe,it,expect}from'vitest'
import{createElasticDrag,pullElasticDrag,stepElasticDrag,releaseElasticDrag}from'./drag-motion'
import type{Stage}from'./game'
describe('elastic visual dragging with an unchanged native grab point',()=>{
 it('lags opposite both cursor axes, uses distinct stages and settles after release',()=>{
  const strains=[]
  for(const stage of [0,1,2,3,4]as Stage[]){const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:1000},stage)
   for(let i=1;i<=18;i++){pullElasticDrag(s,{x:i*10,y:i*2,at:1000+i*16},stage);stepElasticDrag(s,16)}
   expect(s.x).toBeLessThan(-1);if(stage===2)expect(s.y).toBe(0);else expect(s.y).toBeLessThan(0);expect(s.stretch).toBeGreaterThan(0);strains.push(s.stretch)
   const before=s.x;releaseElasticDrag(s);stepElasticDrag(s,16);expect(Math.abs(s.x-before)).toBeLessThan(2)
   for(let i=0;i<180;i++)stepElasticDrag(s,16)
   expect(Math.abs(s.x)).toBeLessThan(.001);expect(Math.abs(s.angle)).toBeLessThan(.001);expect(Math.abs(s.stretch)).toBeLessThan(.001)
  }
  expect(new Set(strains).size).toBe(4);expect(strains[1]).toBe(strains[2]);expect(strains[0]).toBeLessThan(strains[1]/3)
 })
 it('reacts to a deliberate reversal then gets dizzy only after repeated shaking',()=>{
  const s=createElasticDrag();expect(pullElasticDrag(s,{x:0,y:0,at:100},1)).toBeNull();expect(pullElasticDrag(s,{x:20,y:0,at:130},1)).toBeNull()
  expect(pullElasticDrag(s,{x:0,y:0,at:160},1)).toBe('turn');expect(pullElasticDrag(s,{x:20,y:0,at:190},1)).toBe('turn');expect(pullElasticDrag(s,{x:0,y:0,at:220},1)).toBe('dizzy')
  expect(pullElasticDrag(s,{x:20,y:0,at:1400},1)).toBeNull();expect(s.turns).toBe(0)
 })
 it('recoils past rest more than once without losing the released position or stretching indefinitely',()=>{
  for(const stage of [0,1,2,3,4]as Stage[]){
   const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:1000},stage)
   for(let i=1;i<=24;i++){pullElasticDrag(s,{x:i*8,y:0,at:1000+i*16},stage);stepElasticDrag(s,16)}
   const held=s.x;releaseElasticDrag(s);const samples:number[]=[]
   for(let i=0;i<150;i++){stepElasticDrag(s,16);samples.push(s.x)}
   expect(Math.max(...samples)).toBeGreaterThan(Math.abs(held)*.12)
   expect(samples.filter((x,i)=>i>0&&x*samples[i-1]<0).length).toBeGreaterThanOrEqual(2)
   expect(Math.abs(s.x)+Math.abs(s.stretch)+Math.abs(s.skew)+Math.abs(s.fringe)).toBeLessThan(.002)
  }
 })
 it('squeezes on reversal and gives the original foliage a delayed follow-through',()=>{
  const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:1000},2)
  for(let i=1;i<=24;i++){pullElasticDrag(s,{x:i*8,y:0,at:1000+i*16},2);stepElasticDrag(s,16)}
  const strain=s.stretch;expect(s.fringe).toBeLessThan(-1)
  pullElasticDrag(s,{x:180,y:0,at:1400},2);stepElasticDrag(s,16)
  expect(s.fringe).toBeLessThan(-1)
  const strains:number[]=[]
  for(let i=1;i<=8;i++){pullElasticDrag(s,{x:180-i*8,y:0,at:1400+i*16},2);stepElasticDrag(s,16);strains.push(s.stretch)}
  expect(Math.min(...strains)).toBeLessThan(strain*.9)
  for(let i=9;i<=36;i++){pullElasticDrag(s,{x:180-i*8,y:0,at:1400+i*16},2);stepElasticDrag(s,16)}
  expect(s.fringe).toBeGreaterThan(1);expect(s.x).toBeGreaterThan(1)
 })
 it('plays original grounded compression smoothly without vertical movement or a frozen pose',()=>{
  const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:1000},2);const poses:number[]=[]
  for(let i=1;i<=75;i++){pullElasticDrag(s,{x:i*3,y:i,at:1000+i*32},2);stepElasticDrag(s,32);poses.push(s.compression);expect(s.y).toBe(0)}
  expect(Math.max(...poses)).toBeGreaterThan(.6);expect(Math.min(...poses)).toBeGreaterThanOrEqual(0);expect(Math.max(...poses)).toBeLessThanOrEqual(1)
  const before=s.compression;releaseElasticDrag(s);stepElasticDrag(s,16);expect(Math.abs(s.compression-before)).toBeLessThan(.2)
  for(let i=0;i<150;i++)stepElasticDrag(s,16);expect(s.compression).toBeLessThan(.001);expect(s.y).toBe(0)
 })
 it('rejects duplicate timestamps and bounds extreme deltas, stalls and reduced motion',()=>{
  const s=createElasticDrag();pullElasticDrag(s,{x:0,y:0,at:10},2);pullElasticDrag(s,{x:100000,y:-100000,at:10},2);expect(s.targetX).toBe(0)
  for(let i=1;i<200;i++){pullElasticDrag(s,{x:i%2?100000:-100000,y:i%3?100000:-100000,at:i*16+10},2);stepElasticDrag(s,10000);expect([s.x,s.y,s.angle,s.stretch,s.skew,s.fringe].every(Number.isFinite)).toBe(true);expect(Math.abs(s.angle)).toBeLessThanOrEqual(19);expect(Math.abs(s.stretch)).toBeLessThanOrEqual(.19);expect(Math.abs(s.skew)).toBeLessThanOrEqual(4.8);expect(Math.abs(s.fringe)).toBeLessThanOrEqual(9)}
  stepElasticDrag(s,16,true);expect([s.x,s.y,s.angle,s.stretch,s.skew,s.fringe]).toEqual([0,0,0,0,0,0])
 })
})

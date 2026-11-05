import {describe,it,expect} from 'vitest'
import {alphaAt,pointInPaintedRect} from './ram-hit-test'
describe('Ram pointer hit testing',()=>{
 it('accepts painted body pixels and rejects transparent padding',()=>{
  const data=new Uint8ClampedArray(10*10*4);data[(4*10+5)*4+3]=255
  expect(alphaAt(data,10,10,5,4)).toBe(true);expect(alphaAt(data,10,10,0,0)).toBe(false);expect(pointInPaintedRect(data,10,10,{left:100,top:50,width:200,height:200},210,130)).toBe(true);expect(pointInPaintedRect(data,10,10,{left:100,top:50,width:200,height:200},100,50)).toBe(false)
 })
 it('keeps the edge transparent and anti-aliased body pixels clickable',()=>{
  const data=new Uint8ClampedArray(4*4*4);data[(1*4+1)*4+3]=31;data[(2*4+2)*4+3]=64
  expect(alphaAt(data,4,4,1,1)).toBe(false);expect(alphaAt(data,4,4,2,2)).toBe(true)
 })
})

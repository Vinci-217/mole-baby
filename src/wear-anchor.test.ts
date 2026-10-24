import {describe,it,expect} from 'vitest'
import {bodyWearAnchor} from './wear-anchor'
describe('accessories follow the actual source body',()=>{
  it('ignores transparent space and follows a translated/squashed body inside an atlas',()=>{
    const mask=new Uint8ClampedArray(80*60*4),neutral=new Uint8ClampedArray(mask.length)
    for(let y=20;y<50;y++)for(let x=8;x<28;x++){const i=(y*80+x)*4;mask[i]=255;mask[i+3]=255}
    for(let y=25;y<40;y++)for(let x=52;x<77;x++){const i=(y*80+x)*4;mask[i]=255;mask[i+3]=255}
    const first=bodyWearAnchor(mask,neutral,80,0,0,40,60)!,next=bodyWearAnchor(mask,neutral,80,40,0,40,60)!
    expect(first.x).toBe(17.5);expect(first.bodyWidth).toBe(20);expect(first.bodyHeight).toBe(30)
    expect(next.x).toBe(24);expect(next.bodyWidth).toBe(25);expect(next.bodyHeight).toBe(15);expect(next.y).toBeGreaterThan(first.y)
    expect(bodyWearAnchor(mask,neutral,80,0,0,40,60,true)!.y).toBeLessThan(first.y)
  })
  it('keeps an absent body from leaving a floating accessory behind',()=>{const empty=new Uint8ClampedArray(16);expect(bodyWearAnchor(empty,empty,2,0,0,2,2)).toBeNull()})
})

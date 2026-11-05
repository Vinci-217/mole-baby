import {describe,it,expect} from 'vitest'
import {bodyWearAnchor,bodySideAccessoryOffset,backAccessoryOffset,headAccessoryOffset} from './wear-anchor'
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
  it('keeps original wings attached when their source frame travels far above its replacement body',()=>{
    const anchor={x:95,y:47,bodyWidth:151,bodyHeight:107,angle:0},origin=[32,88]
    for(const box of [[82,103,169,249],[67,0,155,142],[107,187,160,280]]){
      const before=[...box],offset=backAccessoryOffset(anchor,box,origin)
      expect((box[0]+box[2])/2-origin[0]+offset.x).toBe(anchor.x)
      expect(box[1]-origin[1]+offset.y).toBeCloseTo(anchor.y-anchor.bodyHeight*.36)
      expect(box).toEqual(before)
    }
  })
  it('keeps a shield against a moving body despite the original side pose having a different canvas offset',()=>{
    for(const anchor of [{x:84,y:67,bodyWidth:72,bodyHeight:60,angle:0},{x:108,y:31,bodyWidth:50,bodyHeight:110,angle:0}])for(const box of [[201,128,240,195],[72,86,86,166]]){
      const origin=[32,88],before=[...box],offset=bodySideAccessoryOffset(anchor,box,origin)
      const x=(box[0]+box[2])/2-origin[0]+offset.x,y=(box[1]+box[3])/2-origin[1]+offset.y
      expect(x).toBeGreaterThan(anchor.x+anchor.bodyWidth*.3)
      expect(x).toBeLessThan(anchor.x+anchor.bodyWidth*.6)
      expect(y).toBeGreaterThan(anchor.y+anchor.bodyHeight*.5)
      expect(y).toBeLessThan(anchor.y+anchor.bodyHeight*.9)
      expect(box).toEqual(before)
    }
  })
  it('places side wings on the back and keeps rigid headwear above the eyes in both hop poses',()=>{
    for(const anchor of [{x:95,y:140,bodyWidth:71,bodyHeight:49,angle:0},{x:95,y:75,bodyWidth:59,bodyHeight:95,angle:0}]){
      const box=[32,25,120,150],origin=[32,88]
      for(const facing of [-1,1]){
        const offset=backAccessoryOffset(anchor,box,origin,facing)
        expect(Math.sign((box[0]+box[2])/2-origin[0]+offset.x-anchor.x)).toBe(-facing)
      }
      for(const id of ['wizard-cap','flower-crown']){
        const offset=headAccessoryOffset(anchor,box,origin,id)
        expect((box[0]+box[2])/2-origin[0]+offset.x).toBe(anchor.x)
        expect(box[3]-origin[1]+offset.y).toBeLessThan(anchor.y+anchor.bodyHeight*.2)
      }
    }
  })
})

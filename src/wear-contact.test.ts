import {describe,it,expect} from 'vitest'
import sharp from 'sharp'
import {bodyWearAnchor,garmentBottomContour,headwearSurfaceGap,headwearContactOffset,headAccessoryOffset} from './wear-anchor'
import {outfitFrame} from './outfit-motion'
import flight from '../public/assets/original/flight/runtime.json'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import superBody from '../public/assets/original/wardrobe-motion/super-body-bounds.json'
import {borrowedBodyPlacement} from './wear-anchor'

const images=new Map<string,Promise<{pixels:Uint8ClampedArray;width:number;height:number}>>()
function pixels(path:string){
  if(!images.has(path))images.set(path,sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(({data,info})=>({pixels:new Uint8ClampedArray(data),width:info.width,height:info.height})))
  return images.get(path)!
}
function unpack(atlas:Uint8ClampedArray,atlasWidth:number,spec:NonNullable<ReturnType<typeof outfitFrame>>){
  const {sheet,index}=spec,box=sheet.rects[index],width=sheet.cell[0],height=sheet.cell[1],part=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<box[3]-box[1];y++)for(let x=0;x<box[2]-box[0];x++){
    const src=((Math.floor(index/sheet.columns)*sheet.tile[1]+y)*atlasWidth+index%sheet.columns*sheet.tile[0]+x)*4,dest=((box[1]+y)*width+box[0]+x)*4
    part.set(atlas.subarray(src,src+4),dest)
  }
  return garmentBottomContour(part,width,height)
}

describe('headwear contacts the painted head rather than an outer frame corner',()=>{
  it('registers classic borrowed hoods and handhelds against verified source bodies',()=>{
    for(const source of Object.values(superBody))expect(createHash('sha256').update(readFileSync(source.source)).digest('hex')).toBe(source.sha256)
    const reference=superBody.classic.bounds[0]!,anchor={x:94.5,y:92.125,bodyWidth:88,bodyHeight:75,angle:0}
    const fit=borrowedBodyPlacement(anchor,reference,{left:reference[0],top:reference[1],scaleX:1,scaleY:1})
    expect(fit.scaleX).toBe(fit.scaleY)
    expect(fit.left+(reference[2]-reference[0])/2*fit.scaleX).toBeCloseTo(anchor.x)
    expect(fit.top+(reference[3]-reference[1])*fit.scaleY).toBeCloseTo(168)
  })
  it('ignores a low dangling corner on an otherwise floating brim',()=>{
    const mask=new Uint8ClampedArray(40*40*4),hat=new Uint8ClampedArray(mask.length)
    for(let x=8;x<33;x++)for(let y=20;y<39;y++){const p=(y*40+x)*4;mask[p]=255;mask[p+3]=255}
    for(let x=5;x<36;x++){hat[(12*40+x)*4+3]=255;if(x===5)hat[(22*40+x)*4+3]=255}
    const anchor=bodyWearAnchor(mask,mask,40,0,0,40,40)!,bottom=garmentBottomContour(hat,40,40),placement={left:0,top:0,scaleX:1,scaleY:1}
    expect(headwearSurfaceGap(anchor,bottom,placement)).toBe(8)
    const dy=headwearContactOffset(anchor,bottom,placement)
    expect(headwearSurfaceGap(anchor,bottom,{...placement,top:dy})).toBe(-2)
    expect(bottom[5]).toBe(22)
  })
  it('closes real original-art seams across junior, middle and all final-form direction poses',async()=>{
    const ids=['wizard-cap','gold-feather','warm-scarf','flower-crown','leaf-hood','sport-goggles']
    let checked=0,previouslyFloating=0
    for(const form of ['junior','middle','senior','classic','super','water','wood','fire']){
      const flying=form==='senior'||form==='super'||form==='classic'
      const poses=flying?Object.values(flight.forms[form].clips).flatMap(clip=>clip.frames.map(p=>({kind:'flight',row:Math.floor(p.index/8),frame:p.index%8,source:p.sourceFrame}))):[
        {kind:form==='junior'||form==='middle'?'grounded':'classic',row:0,frame:0,source:1},
        ...[1,2].flatMap(row=>Array.from({length:8},(_,frame)=>({kind:'classic',row,frame,source:frame+1})))
      ]
      for(const pose of poses){
        const path=pose.kind==='classic'?`public/assets/classic/${form}-mask.png`:`public/assets/original/${pose.kind}/${form}-mask.png`
        const body=await pixels(path),anchor=bodyWearAnchor(body.pixels,body.pixels,body.width,pose.frame*192,pose.row*208,192,208)!
        expect(anchor).not.toBeNull()
        for(const id of ids){
          const mounted=pose.kind==='classic'&&pose.row>0,spec=outfitFrame(id,form,pose.kind,mounted?0:pose.frame,pose.row,8,pose.source)!
          const cloth=await pixels(`public/assets/original/wardrobe-motion/${spec.sheet.file}`),bottom=unpack(cloth.pixels,cloth.width,spec)
          const placement={left:-spec.sheet.origin[0],top:-spec.sheet.origin[1],scaleX:1,scaleY:1}
          const delta=headAccessoryOffset(anchor,spec.sheet.rects[spec.index],spec.sheet.origin,id);placement.left+=delta.x;placement.top+=delta.y
          const before=headwearSurfaceGap(anchor,bottom,placement)
          if(before!==null&&before>4)previouslyFloating++
          placement.top+=headwearContactOffset(anchor,bottom,placement)
          const after=headwearSurfaceGap(anchor,bottom,placement)
          expect(after,`${form}:${id}:${pose.kind}:${pose.row}:${pose.frame}`).not.toBeNull()
          expect(after!).toBeLessThanOrEqual(-1.9)
          expect(after!).toBeGreaterThan(-anchor.bodyHeight*.04-2)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(700)
    expect(previouslyFloating).toBeGreaterThan(30)
  },20000)
})

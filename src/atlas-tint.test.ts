import {describe,it,expect} from 'vitest';
import {tintAtlas} from './atlas-tint';

describe('responsive atlas recolouring without changing artwork',()=>{
 it('matches the former per-pixel formula byte for byte for mixed masks and extreme/custom colours',async()=>{
  let seed=73;const byte=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24};
  const source=Uint8ClampedArray.from({length:65536},byte),mask=Uint8ClampedArray.from({length:source.length},byte);
  for(const offsets of [[-240,-75,0],[0,0,0],[255,-255,127],[-43.5,12.25,-70.1]])for(const replaceAlpha of [false,true]){
   const expected=source.slice(),actual=source.slice(),clamp=(n:number)=>Math.max(0,Math.min(255,n));
   const deltas=[255,204,153].map(base=>offsets.map(offset=>clamp(base+offset)-base));
   for(let i=0;i<expected.length;i+=4){
    if(replaceAlpha)expected[i+3]=mask[i+3];
    const w=mask[i]/255,g=mask[i+1]/255,d=mask[i+2]/255;
    for(let c=0;c<3;c++)expected[i+c]=clamp(expected[i+c]+deltas[0][c]*w+deltas[1][c]*g+deltas[2][c]*d);
   }
   await tintAtlas(actual,mask,offsets,replaceAlpha);expect(actual).toEqual(expected);
  }
 });
 it('preserves unmasked artwork and opacity, including white, grey and dark body shading',async()=>{
  const pixels=new Uint8ClampedArray([255,255,255,255,204,204,204,180,153,153,153,127,90,30,70,50]);
  const mask=new Uint8ClampedArray([255,0,0,255,0,255,0,180,0,0,255,127,0,0,0,50]);
  await tintAtlas(pixels,mask,[-240,-75,0]);
  expect([...pixels]).toEqual([15,180,255,255,0,129,204,180,0,78,153,127,90,30,70,50]);
 });
 it('lets input timers run while recolouring a full atlas at its original resolution',async()=>{
  const pixels=new Uint8ClampedArray(2048*2048*4).fill(255),mask=pixels.slice();
  let inputHandled=false;const input=setTimeout(()=>{inputHandled=true},0);
  // White-only mask; alpha remains unchanged across all original pixels.
  for(let i=0;i<mask.length;i+=4){mask[i+1]=0;mask[i+2]=0}
  await tintAtlas(pixels,mask,[-240,-75,0]);clearTimeout(input);
  expect(inputHandled).toBe(true);expect(pixels.length).toBe(2048*2048*4);
  expect([...pixels.slice(-4)]).toEqual([15,180,255,255]);
 });
});

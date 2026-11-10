import {describe,it,expect} from 'vitest';
import {tintAtlas} from './atlas-tint';

describe('responsive atlas recolouring without changing artwork',()=>{
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

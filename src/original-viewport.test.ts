import {describe,it,expect} from 'vitest';
import {drawingUnion,officialViewportScale} from './original-viewport';

describe('original drawing surfaces',()=>{
 it('gives moving action/effect sources room to overflow the anatomical body',()=>{
  for(const kind of ['care','magic','skill','transform'])expect(officialViewportScale({kind})).toBe(8);
  for(const kind of ['outfit','school'])expect(officialViewportScale({kind})).toBe(3.2);
 });
 it('unites simultaneous native and costume artwork without discarding negative extents',()=>{
  expect(drawingUnion([{x:-320,y:-308,width:800,height:866},{x:-100,y:-80,width:360,height:420}])).toEqual({x:-320,y:-308,width:800,height:866});
  expect(drawingUnion([{x:-20,y:10,width:40,height:30},{x:40,y:-15,width:80,height:30}])).toEqual({x:-20,y:-15,width:140,height:55});
 });
 it('ignores invalid extents and clears after the final native player is removed',()=>{
  expect(drawingUnion([])).toBeNull();expect(drawingUnion([{x:NaN,y:0,width:200,height:200}])).toBeNull();
 });
});

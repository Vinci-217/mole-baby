import {describe,it,expect} from 'vitest';
import {drawingUnion,fitDrawingSurface,fitRoomDrawing,officialViewportScale,visibleDesktopDrawingArea} from './original-viewport';

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
 it('fits wide source art into the room, preserving scale and position whenever possible',()=>{
  const bounds={x:-100,y:-180,width:200,height:200},area={width:500,height:300};
  expect(fitRoomDrawing(bounds,{x:250,y:210},area)).toEqual({x:250,y:210,scale:1});
  expect(fitRoomDrawing(bounds,{x:455,y:287},area)).toEqual({x:396,y:276,scale:1});
  const fit=fitRoomDrawing({x:-350,y:-290,width:600,height:370},{x:455,y:287},area);
  expect(fit.scale).toBeCloseTo(292/370);
  expect(fit.y-290*fit.scale).toBeCloseTo(4);
  expect(fit.y+80*fit.scale).toBeCloseTo(296);
 });
 it('moves tall artwork into the visible part of a native window without shrinking it',()=>{
  const surface={x:-120,y:16,width:400,height:400};
  const paint={x:42,y:45,width:106,height:232};
  const area={x:31,y:71,width:160,height:270};
  expect(fitDrawingSurface(surface,paint,area)).toEqual({x:0,y:30,scale:1});
 });
 it('uniformly fits oversized artwork into the status portrait using the paint origin',()=>{
  const surface={x:-10,y:10,width:320,height:348};
  const paint={x:86,y:2,width:110,height:236};
  const area={x:90,y:56,width:120,height:130};
  const fit=fitDrawingSurface(surface,paint,area);
  const left=surface.x+fit.x+(paint.x-surface.x)*fit.scale;
  const top=surface.y+fit.y+(paint.y-surface.y)*fit.scale;
  expect(fit.scale).toBeCloseTo(122/236);
  expect(left).toBeCloseTo(94);
  expect(top).toBeCloseTo(60);
  expect(top+paint.height*fit.scale).toBeCloseTo(182);
 });
 it('uses the live window origin after a panel closes at fractional zoom',()=>{
  const native={workArea:{x:0,y:0,width:1200,height:850},scale:.81};
  const visible=visibleDesktopDrawingArea(native,{x:1094,y:705,width:160,height:239});
  expect(visible.x).toBe(0);
  expect(visible.y).toBe(0);
  expect(visible.width).toBeCloseTo(106/.81);
  expect(visible.height).toBeCloseTo(145/.81);
 });
});

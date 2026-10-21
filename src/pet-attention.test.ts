import {describe,it,expect} from 'vitest'
import {easeGaze,pointerGaze} from './pet-attention'
import {groundedMotion} from './grounded-motion'
describe('nearby pointer attention',()=>{
 const box={left:20,top:40,width:100,height:108}
 it('looks only within the local companion window and bounds eye targets',()=>{expect(pointerGaze(70,94,box)).toEqual({x:0,y:0});expect(pointerGaze(170,30,box)).toEqual({x:1,y:-1});expect(pointerGaze(900,600,box)).toEqual({x:0,y:0});expect(pointerGaze(NaN,NaN,box)).toEqual({x:0,y:0})})
 it('eases toward and away from the pointer without jumping',()=>{const a=easeGaze({x:0,y:0},{x:1,y:-1},16);expect(a.x).toBeGreaterThan(0);expect(a.x).toBeLessThan(.15);const b=easeGaze(a,{x:0,y:0},16);expect(b.x).toBeGreaterThan(0);expect(b.x).toBeLessThan(a.x);expect(easeGaze(a,{x:1,y:1},0)).toEqual(a)})
 it('keeps reading gaze and reduced-motion eyes independent of the pointer',()=>{expect(groundedMotion('middle','focus',500,500,false,{x:1,y:-1})).toEqual(groundedMotion('middle','focus',500,500,false,{x:-1,y:1}));expect(groundedMotion('junior','idle',500,500,true,{x:1,y:1})).toEqual({frame:0,eyeX:0,eyeY:0,leafAngle:0})})
})

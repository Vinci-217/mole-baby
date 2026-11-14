import {describe,it,expect} from 'vitest';
import {outfitDragAction} from './use-outfit-drag';

describe('the clothed source follows a real drag',()=>{
 it('turns and walks with the shared directional input, then rests on stop',()=>{
  expect(outfitDragAction(.8,300)).toBe('walk-right');
  expect(outfitDragAction(-.8,300,'walk-right')).toBe('walk-left');
  expect(outfitDragAction(-.8,0,'walk-left')).toBe('idle');
 });
 it('keeps the last direction across the spring centre instead of flashing the front pose',()=>{
  expect(outfitDragAction(.02,160,'walk-left')).toBe('walk-left');
  expect(outfitDragAction(-.02,160,'walk-right')).toBe('walk-right');
  expect(outfitDragAction(NaN,300,'walk-left')).toBe('idle');
 });
});

import {describe,it,expect} from 'vitest';
import {classicSheetPlan} from './classic-sheet-plan';
describe('first paint dependencies',()=>{
 it('resting and portraits do not wait for care or drag sheets',()=>{
  for(const action of ['idle','waiting','still']){
   expect(classicSheetPlan('junior',action)).toEqual(['grounded']);
   expect(classicSheetPlan('super',action)).toEqual(['classic']);
  }
 });
 it('keeps the original special sheets when actually needed',()=>{
  expect(classicSheetPlan('junior','drag')).toEqual(['drag']);
  expect(classicSheetPlan('junior','pet')).toContain('affection');
  expect(classicSheetPlan('middle','eat-bear-biscuit',true)).toEqual(['gentle']);
  expect(classicSheetPlan('super','sleep')).toEqual(['slumber']);
  expect(classicSheetPlan('super','wake')).toContain('slumber');
  expect(classicSheetPlan('junior','sick')).toContain('care');
 });
});

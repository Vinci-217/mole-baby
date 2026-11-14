import {describe,it,expect} from 'vitest';
import {magicBoxRect} from './magic-box';
import visibility from '../electron/edge-visibility.json';
import type {RamForm} from './original-actions';

describe('body-sized transformation box',()=>{
 it('matches visible width and floor across every growth and elemental form',()=>{
  for(const form of Object.keys(visibility.forms) as RamForm[]){
   const box=magicBoxRect(form),body=visibility.forms[form].body,k=box.width/288;
   expect(145*k).toBeCloseTo(body[2]-body[0],6);
   expect(box.y+226*k).toBeCloseTo(body[3],6);
   expect(box.x+143.5*k).toBeCloseTo((body[0]+body[2])/2,6);
   expect(box.height).toBe(box.width);
  }
  expect(magicBoxRect('super').width).toBeLessThan(100);
  expect(magicBoxRect('junior').width).toBeLessThan(140);
 });
});

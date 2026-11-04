import {describe,it,expect} from 'vitest';
import {readingMotion,READING_CYCLE} from './reading-motion';
describe('quiet reading and page turns',()=>{
 it('holds the book still for reading, makes one continuous right-to-left turn and settles before restarting',()=>{
  expect(readingMotion(5000).turning).toBe(false);let previous=0;
  for(let t=5500;t<=7000;t+=16){const p=readingMotion(t);expect(p.turning).toBe(true);expect(p.progress).toBeGreaterThanOrEqual(previous);expect(p.fold).toBeGreaterThanOrEqual(-1);expect(p.fold).toBeLessThanOrEqual(1);expect(p.lift).toBeGreaterThanOrEqual(0);expect(p.opacity).toBeGreaterThanOrEqual(0);previous=p.progress}
  expect(readingMotion(6250).fold).toBeCloseTo(0);expect(readingMotion(7000).fold).toBe(-1);expect(readingMotion(7500).turning).toBe(false);
  expect(readingMotion(READING_CYCLE)).toEqual(readingMotion(0));
 });
 it('shows a still open book in reduced motion and never displays a turning sheet',()=>{
  for(const t of [0,5500,6250,7100,8000,500000]){const p=readingMotion(t,true);expect(p.turning).toBe(false);expect(p.opacity).toBe(0);expect(p.fold).toBe(1);expect(p.lift).toBe(0)}
 });
});

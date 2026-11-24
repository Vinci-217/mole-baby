import {describe,expect,it,vi} from 'vitest';
import {DecodedAssetCache} from './decoded-asset-cache';

describe('decoded asset cache',()=>{
 it('shares an in-flight decode and lets a failed request retry',async()=>{
  const cache=new DecodedAssetCache(()=>8,(value:number)=>value);
  const load=vi.fn<()=>Promise<number>>().mockRejectedValueOnce(new Error('decode')).mockResolvedValue(4);
  const first=cache.get('atlas',load);
  expect(cache.get('atlas',load)).toBe(first);
  await expect(first).rejects.toThrow('decode');
  await expect(cache.get('atlas',load)).resolves.toBe(4);
  expect(load).toHaveBeenCalledTimes(2);
 });

 it('evicts the least recently used sheets until the new one fits',async()=>{
  const cache=new DecodedAssetCache(()=>8,(value:number)=>value);
  const one=vi.fn(async()=>2),two=vi.fn(async()=>3),three=vi.fn(async()=>5);
  await cache.get('one',one);
  await cache.get('two',two);
  await cache.get('one',one);
  await cache.get('three',three);
  await cache.get('one',one);
  expect(one).toHaveBeenCalledTimes(1);
  await cache.get('two',two);
  expect(two).toHaveBeenCalledTimes(2);
 });

 it('returns oversized atlases to the player without retaining them',async()=>{
  const cache=new DecodedAssetCache(()=>8,(value:number)=>value);
  const small=vi.fn(async()=>4),large=vi.fn(async()=>20);
  await cache.get('small',small);
  await expect(cache.get('large',large)).resolves.toBe(20);
  await cache.get('small',small);
  await cache.get('large',large);
  expect(small).toHaveBeenCalledTimes(1);
  expect(large).toHaveBeenCalledTimes(2);
 });
});

import {it,expect,vi,afterEach} from 'vitest';
import {debugStorage,localDebugAvailable,localDebugEnabled,installLocalDebug} from './local-debug';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
it('keeps save, memory, deletes and clear inside a separate debug store',()=>{
 const original={'ramu-house-save-v1':'original','memory':'real memory'},writes:Record<string,string>[]=[];
 const store=debugStorage(original,next=>writes.push(next));
 store.setItem('ramu-house-save-v1','test');store.memory='test memory';store.extra='extra';
 expect(Object.fromEntries(Object.entries(store))).toEqual({'ramu-house-save-v1':'test',memory:'test memory',extra:'extra'});
 expect(store.length).toBe(3);expect(store.key(0)).toBe('ramu-house-save-v1');expect(store.key(99)).toBeNull();
 store.removeItem('memory');delete store.extra;expect(store.getItem('memory')).toBeNull();store.clear();expect(Object.keys(store)).toEqual([]);expect(store.length).toBe(0);
 expect(original).toEqual({'ramu-house-save-v1':'original',memory:'real memory'});expect(writes.at(-1)).toEqual({});
});
it('ignores a leftover debug flag in a normal production build',()=>{
 vi.stubEnv('DEV',false);vi.stubEnv('VITE_LOCAL_DEBUG','');vi.stubGlobal('window',{});vi.stubGlobal('sessionStorage',{getItem:()=> 'on'});
 expect(localDebugAvailable()).toBe(false);expect(localDebugEnabled()).toBe(false);expect(()=>installLocalDebug()).not.toThrow();
});
it('keeps native storage bridges untouched even for an explicit debug preview',()=>{
 vi.stubEnv('DEV',true);vi.stubGlobal('window',{desktop:{}});expect(localDebugAvailable()).toBe(false);
 vi.stubGlobal('window',{mobile:{}});expect(localDebugAvailable()).toBe(false);
 vi.stubGlobal('window',{});expect(localDebugAvailable()).toBe(true);
});

import {describe,it,expect,vi} from 'vitest';
import {hydrateAndroidStorage} from './android-host';
class LocalStorage {
 [key:string]:unknown;
 constructor(entries:Record<string,string>){Object.assign(this,entries)}
 getItem(key:string){return Object.hasOwn(this,key)?String(this[key]):null}
 setItem(key:string,value:string){this[key]=value}
 removeItem(key:string){delete this[key]}
 key(index:number){return Object.keys(this)[index]??null}
 get length(){return Object.keys(this).length}
 clear(){for(const key of Object.keys(this))delete this[key]}
}
describe('Android upgrade bootstrap never treats a missing mirror as permission to delete',()=>{
 it('retains and backfills legacy WebView-only identity and memories',()=>{
  const storage=new LocalStorage({'ramu-house-save-v1':'old pet','ramu-companion-memory-v1:1':'old memories'}),persist=vi.fn(()=>true);
  hydrateAndroidStorage(storage,{},undefined,persist);
  expect(storage.getItem('ramu-house-save-v1')).toBe('old pet');expect(storage.getItem('ramu-companion-memory-v1:1')).toBe('old memories');expect(persist.mock.calls).toEqual([['ramu-house-save-v1','old pet'],['ramu-companion-memory-v1:1','old memories']]);
 });
 it('a failed native mirror cannot erase the remaining browser copy',()=>{
  const storage=new LocalStorage({'ramu-house-save-v1':'only remaining save'});
  hydrateAndroidStorage(storage,{},[],()=>false);expect(storage.getItem('ramu-house-save-v1')).toBe('only remaining save');
 });
 it('honours explicit farewell tombstones and preserves unrelated records',()=>{
  const storage=new LocalStorage({'ramu-house-save-v1':'explicitly deleted pet','ramu-house-preferences-v2':'preferences',unrelated:'untouched'});
  hydrateAndroidStorage(storage,{},['ramu-house-save-v1','unrelated'],()=>true);
  expect(storage.getItem('ramu-house-save-v1')).toBe(null);expect(storage.getItem('ramu-house-preferences-v2')).toBe('preferences');expect(storage.getItem('unrelated')).toBe('untouched');
 });
 it('uses existing authoritative native entries while retaining older keys absent from the mirror',()=>{
  const storage=new LocalStorage({'ramu-house-save-v1':'older pet','ramu-companion-memory-v1:1':'legacy memory'});
  hydrateAndroidStorage(storage,{'ramu-house-save-v1':'latest native pet'},[],()=>true);
  expect(storage.getItem('ramu-house-save-v1')).toBe('latest native pet');expect(storage.getItem('ramu-companion-memory-v1:1')).toBe('legacy memory');
 });
});

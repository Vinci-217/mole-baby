import {describe,it,expect} from 'vitest'
import {createPet} from './game'
import {createMemory,memoryKey,recordEvent} from './companion-memory'
import {restorePetBackup,PET_SAVE_KEY,MAX_BACKUP_BYTES,petBackupText,recoverLocalPet} from './pet-backup'
const now=1_700_000_000_000
function store(initial:Record<string,string>={},failKey?:string){const values=new Map(Object.entries(initial));return{values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(key===failKey)throw Error('Quota exceeded');values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}}
describe('pet backup imports',()=>{
 it('validates and persists the pet and its own sanitized memories together',()=>{
  const pet=createPet('小叶','blue',now),memory=recordEvent(createMemory(pet),{kind:'care',detail:'一起吃饼干',at:now}),storage=store()
  const restored=restorePetBackup(JSON.stringify({...pet,companionMemory:memory}),storage,now)
  expect(restored.pet.name).toBe('小叶');expect(JSON.parse(storage.getItem(PET_SAVE_KEY)!)).toEqual(restored.pet)
  expect(JSON.parse(storage.getItem(memoryKey(pet))!)).toEqual(restored.memory)
  expect(restored.memory.events[0].detail).toBe('一起吃饼干')
 })
 it('does not replace another pet’s memories using a mismatched backup identity',()=>{
  const pet=createPet('小叶','blue',now),other=createPet('小红','red',now-1000),storage=store()
  const restored=restorePetBackup(JSON.stringify({...pet,companionMemory:recordEvent(createMemory(other),{kind:'care',detail:'别人的回忆',at:now})}),storage,now)
  expect(restored.memory.petId).toBe(String(pet.createdAt));expect(restored.memory.events).toEqual([])
 })
 it('retains existing matching memories when an older pet-only backup has none',()=>{
  const pet=createPet('小叶','blue',now),memory=recordEvent(createMemory(pet),{kind:'care',detail:'已有回忆',at:now}),storage=store({[memoryKey(pet)]:JSON.stringify(memory)})
  expect(restorePetBackup(JSON.stringify(pet),storage,now).memory.events[0].detail).toBe('已有回忆')
 })
 it.each(['null','[]','42','{"name":"broken"}','{invalid'])('rejects malformed input without writing storage: %s',text=>{
  const storage=store({[PET_SAVE_KEY]:'original'}),before=[...storage.values]
  expect(()=>restorePetBackup(text,storage,now)).toThrow();expect([...storage.values]).toEqual(before)
 })
 it('rejects oversized UTF-8 content before parsing or writing',()=>{
  const storage=store({[PET_SAVE_KEY]:'original'})
  expect(()=>restorePetBackup('叶'.repeat(Math.ceil(MAX_BACKUP_BYTES/3)+1),storage,now)).toThrow('large')
  expect(storage.getItem(PET_SAVE_KEY)).toBe('original')
 })
 it('leaves the current save intact when memory cannot be persisted',()=>{
  const pet=createPet('小叶','blue',now),storage=store({[PET_SAVE_KEY]:'original'},memoryKey(pet))
  expect(()=>restorePetBackup(JSON.stringify(pet),storage,now)).toThrow('Quota')
  expect(storage.getItem(PET_SAVE_KEY)).toBe('original')
 })
 it('restores existing memories when committing the main save fails',()=>{
  const pet=createPet('小叶','blue',now),storage=store({[PET_SAVE_KEY]:'original',[memoryKey(pet)]:'previous-memory'},PET_SAVE_KEY)
  expect(()=>restorePetBackup(JSON.stringify(pet),storage,now)).toThrow('Quota')
  expect(storage.getItem(PET_SAVE_KEY)).toBe('original');expect(storage.getItem(memoryKey(pet))).toBe('previous-memory')
 })
 it('removes newly staged memories if committing the main save fails',()=>{
  const pet=createPet('小叶','blue',now),storage=store({[PET_SAVE_KEY]:'original'},PET_SAVE_KEY)
  expect(()=>restorePetBackup(JSON.stringify(pet),storage,now)).toThrow('Quota')
  expect([...storage.values]).toEqual([[PET_SAVE_KEY,'original']])
 })
 it('round-trips preferences with the complete pet, house and memories and ignores unrelated keys',()=>{
  const pet={...createPet('小叶','blue',now),color:'#6b399f' as const,growth:840,evolution:'super' as const,wardrobe:['wizard-cap' as const],wearing:'wizard-cap' as const,notes:[{id:'a',text:'明天见',done:false,createdAt:now}]},memory=recordEvent(createMemory(pet),{kind:'care',detail:'已有回忆',at:now}),source=store({'ramu-house-preferences-v2':'{"sound":false}','ramu-room-media-v1':'{"backgroundId":"mystery-flower-sea"}','unrelated':'leave me'});
  const exported=JSON.parse(petBackupText(pet,memory,source));exported.localData.unrelated='attack';const target=store({unrelated:'original'}),restored=restorePetBackup(JSON.stringify(exported),target,now);
  expect(restored.pet).toMatchObject({createdAt:now,color:'#6b399f',evolution:'super',wearing:'wizard-cap',notes:pet.notes});expect(restored.memory.events[0].detail).toBe('已有回忆');expect(target.getItem('ramu-house-preferences-v2')).toBe('{"sound":false}');expect(target.getItem('unrelated')).toBe('original');
 });
 it('rolls back imported settings too when the final pet write fails',()=>{
  const p=createPet('小叶','blue',now),storage=store({[PET_SAVE_KEY]:'original','ramu-house-preferences-v2':'old'},PET_SAVE_KEY);
  expect(()=>restorePetBackup(JSON.stringify({...p,localData:{'ramu-house-preferences-v2':'new'}}),storage,now)).toThrow();expect(storage.getItem('ramu-house-preferences-v2')).toBe('old');
 });
 it('recovers only a missing browser record, never overwrites a broken/existing one or a concurrent new save',async()=>{
  const p=createPet('小叶','blue',now),storage=store(),api={read:async()=>JSON.stringify(p)} as NonNullable<NonNullable<Window['desktop']>['localSaves']>;
  expect(await recoverLocalPet(storage,api)).toBe(true);expect(JSON.parse(storage.getItem(PET_SAVE_KEY)!).createdAt).toBe(now);
  storage.setItem(PET_SAVE_KEY,'broken');expect(await recoverLocalPet(storage,api)).toBe(false);expect(storage.getItem(PET_SAVE_KEY)).toBe('broken');
  storage.removeItem(PET_SAVE_KEY);const racing={read:async()=>{storage.setItem(PET_SAVE_KEY,'new adoption');return JSON.stringify(p)}} as typeof api;expect(await recoverLocalPet(storage,racing)).toBe(false);expect(storage.getItem(PET_SAVE_KEY)).toBe('new adoption');
 });
})

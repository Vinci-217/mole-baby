import {MAX_SAVE_LENGTH,normalizeSavedPet,legacyUnlockedGrowth,earnedGrowth} from './game'
import type {GameState} from './game'
import {memoryKey,parseMemory} from './companion-memory'
import type {CompanionMemory} from './companion-memory'

export const PET_SAVE_KEY='ramu-house-save-v1'
export const MAX_BACKUP_BYTES=MAX_SAVE_LENGTH
export class InvalidPetBackup extends Error {
 constructor(public reason:'size'|'format'){super(reason==='size'?'Backup is too large':'Invalid pet save')}
}
export type BackupStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>
export interface RestoredPetBackup {pet:GameState;memory:CompanionMemory}
const LOCAL_DATA_KEYS=['ramu-house-preferences-v2','ramu-room-media-v1'];
const allowedLocalKey=(key:string,pet:GameState)=>LOCAL_DATA_KEYS.includes(key)||key===`ramu-presence-v1:${pet.createdAt}`;
export function petBackupText(pet:GameState,memory:CompanionMemory,storage:Pick<Storage,'getItem'>):string{
 const localData:Record<string,string>={};
 for(const key of [...LOCAL_DATA_KEYS,`ramu-presence-v1:${pet.createdAt}`]){const value=storage.getItem(key);if(value!==null)localData[key]=value}
 return JSON.stringify({...pet,companionMemory:memory,localData},null,2);
}

/** Called before React can autosave a new adoption. An unreadable/nonempty
 * browser record is preserved for manual recovery instead of being replaced. */
export async function recoverLocalPet(storage:BackupStorage,api:NonNullable<Window['desktop']>['localSaves']):Promise<boolean>{
 if(!api||storage.getItem(PET_SAVE_KEY)!==null)return false;
 const text=await api.read();if(!text||storage.getItem(PET_SAVE_KEY)!==null)return false;
 restorePetBackup(text,storage);return true;
}

/** Validate before creating a pre-import archive, so invalid files cannot fill storage. */
export function validatePetBackup(text:string,now=Date.now()) {
 if(new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)throw new InvalidPetBackup('size')
 let raw:unknown;try{raw=JSON.parse(text)}catch{throw new InvalidPetBackup('format')}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new InvalidPetBackup('format')
 const {companionMemory,localData,...saved}=raw as Record<string,unknown>
 const pet=normalizeSavedPet(saved,now)
 if(!pet)throw new InvalidPetBackup('format')
 return {pet,companionMemory,localData};
}
/** Persist before replacing the live pet; roll back staged data on write failure. */
export function restorePetBackup(text:string,storage:BackupStorage,now=Date.now()):RestoredPetBackup {
 const decoded=validatePetBackup(text,now),{companionMemory,localData}=decoded;
 let {pet}=decoded;
 const key=memoryKey(pet),previousMemory=storage.getItem(key)
 const memory=parseMemory(companionMemory??previousMemory,pet)
 pet={...pet,highestGrowth:Math.max(earnedGrowth(pet),pet.naturalGrowth===undefined?legacyUnlockedGrowth(memory.events):0)}
 const encodedMemory=JSON.stringify(memory),encodedPet=JSON.stringify(pet),staged=new Map<string,string|null>()
 try{
  if(localData&&typeof localData==='object'&&!Array.isArray(localData))for(const [entry,value] of Object.entries(localData)){
   if(!allowedLocalKey(entry,pet)||typeof value!=='string')continue;
   staged.set(entry,storage.getItem(entry));storage.setItem(entry,value);
  }
  storage.setItem(key,encodedMemory);staged.set(key,previousMemory);
  storage.setItem(PET_SAVE_KEY,encodedPet)
 }catch(error){
  try{for(const [entry,value]of staged){if(value===null)storage.removeItem(entry);else storage.setItem(entry,value)}}catch(rollbackError){throw new AggregateError([error,rollbackError],'Backup import and memory rollback failed')}
  throw error
 }
 return {pet,memory}
}

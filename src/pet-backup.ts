import {parseSave} from './game'
import type {GameState} from './game'
import {memoryKey,parseMemory} from './companion-memory'
import type {CompanionMemory} from './companion-memory'

export const PET_SAVE_KEY='ramu-house-save-v1'
export const MAX_BACKUP_BYTES=1_000_000
export type BackupStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>
export interface RestoredPetBackup {pet:GameState;memory:CompanionMemory}

/** Validate and persist before replacing the live pet. A rejected storage write
 * must not report a successful import or discard the existing live companion. */
export function restorePetBackup(text:string,storage:BackupStorage,now=Date.now()):RestoredPetBackup {
 if(new TextEncoder().encode(text).byteLength>MAX_BACKUP_BYTES)throw new Error('Backup is too large')
 const raw:unknown=JSON.parse(text)
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid backup')
 const {companionMemory,...saved}=raw as Record<string,unknown>
 const pet=parseSave(JSON.stringify(saved),now)
 if(!pet)throw new Error('Invalid pet save')
 const key=memoryKey(pet),previousMemory=storage.getItem(key)
 const memory=parseMemory(companionMemory??previousMemory,pet)
 const encodedMemory=JSON.stringify(memory),encodedPet=JSON.stringify(pet)
 storage.setItem(key,encodedMemory)
 try{storage.setItem(PET_SAVE_KEY,encodedPet)}catch(error){
  try{if(previousMemory===null)storage.removeItem(key);else storage.setItem(key,previousMemory)}catch(rollbackError){throw new AggregateError([error,rollbackError],'Backup import and memory rollback failed')}
  throw error
 }
 return {pet,memory}
}

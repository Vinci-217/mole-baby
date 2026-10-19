import { useEffect, useRef } from 'react';
import type { GameState } from './game';
import type { CompanionMemory } from './companion-memory';
import { choosePresence, readPresenceJournal, rememberPresence } from './companion-presence';
import type { PresenceLine, PresenceJournal } from './companion-presence';

export function usePresence({pet,memory,enabled,minutes,blocked,reading=false,onLine}:{pet:GameState|null;memory:CompanionMemory;enabled:boolean;minutes:number;blocked:boolean;reading?:boolean;onLine:(line:PresenceLine)=>void}){
 const current=useRef({pet,memory,onLine,reading});current.current={pet,memory,onLine,reading};
 const journal=useRef<PresenceJournal|null>(null);
 const petId=pet?.createdAt;
 useEffect(()=>{journal.current=pet?readPresenceJournal(pet):null;},[petId]); // The cache belongs to this pet, never another adoption.
 useEffect(()=>{
  if(!enabled||blocked||petId===undefined)return;
  const preference=([10,20,40].includes(minutes)?minutes:20);
  const interval=(reading?Math.max(3,Math.min(10,preference/4)):preference)*60000;
  const last=(reading?journal.current?.history.filter(h=>h.id.startsWith('study-')):journal.current?.history)?.at(-1)?.at??0;
  let next=Math.max(Date.now()+(reading?90000:3*60000),last+interval);
  const check=()=>{
   if(document.hidden||Date.now()<next)return;
   const {pet,memory,onLine}=current.current;if(!pet||!journal.current)return;
   const line=choosePresence(pet,memory,journal.current,Date.now(),false,reading);
   next=Date.now()+interval;
   if(!line)return;
   journal.current=rememberPresence(journal.current,line,Date.now());onLine(line);
  };
  const timer=setInterval(check,15000);return()=>clearInterval(timer);
 },[petId,enabled,minutes,blocked,reading]);
 return (manual=false)=>{
  const {pet,memory,onLine,reading}=current.current;if(!pet)return;
  journal.current??=readPresenceJournal(pet);
  const line=choosePresence(pet,memory,journal.current,Date.now(),manual,reading);if(!line)return;
  journal.current=rememberPresence(journal.current,line,Date.now());onLine(line);
 };
}

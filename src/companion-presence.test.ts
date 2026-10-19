import { describe, expect, it, vi, afterEach } from 'vitest';
import { createPet } from './game';
import { appendMessage, createMemory, forgetFact, localReply, rememberChat, setPlanStatus } from './companion-memory';
import { choosePresence, CULTURE, newPresenceJournal, presenceCandidates, presenceFollowUp, presenceKey, readPresenceJournal, rememberPresence, wantsQuiet } from './companion-presence';

const NOW=1_800_000_000_000;
const pet=()=>createPet('小芽','blue',NOW-86400000);
afterEach(()=>vi.unstubAllGlobals());
describe('thoughtful desktop companionship',()=>{
 it('offers growth, work, progress, culture and life without inventing shared memories',()=>{
  const p=pet(),m=createMemory(p),lines=presenceCandidates(p,m,NOW);
  expect(new Set(lines.map(l=>l.topic))).toEqual(new Set(['growth','work','progress','culture','life']));
  expect(lines.length).toBeGreaterThan(30);
  expect(lines.filter(l=>l.topic==='growth').every(l=>!l.text.includes('叶子'))).toBe(true);
  expect(lines.some(l=>l.text.includes('看见你在工作'))).toBe(false);
  expect(m.messages).toEqual([]);expect(m.events).toEqual([]);
 });
 it('uses only real user preferences, completed plans, recent care and feelings',()=>{
  const p=pet();let m=rememberChat(createMemory(p),'叫我小米，我喜欢草莓。我下周三要考试。',NOW-60000);
  let lines=presenceCandidates(p,m,NOW);
  expect(lines.find(l=>l.id==='memory-like')?.text).toContain('草莓');
  expect(lines.some(l=>l.id==='memory-done')).toBe(false);
  m=setPlanStatus(m,m.facts.find(f=>f.kind==='plan')!.id,'done');
  m=appendMessage(m,'user','最近压力有点大',NOW);
  expect(presenceCandidates(p,m,NOW).some(l=>l.id==='memory-done')).toBe(true);
  expect(presenceCandidates(p,m,NOW).some(l=>l.id==='feeling-tired')).toBe(true);
  expect(presenceCandidates(p,m,NOW+3*3600000).some(l=>l.id==='feeling-tired')).toBe(false);
  const rested=appendMessage(m,'user','我不累，也没有压力',NOW+1);
  expect(presenceCandidates(p,rested,NOW+1).some(l=>l.id==='feeling-tired')).toBe(false);
  const forgotten=forgetFact(m,m.facts.find(f=>f.kind==='like')!.id);
  expect(JSON.stringify(presenceCandidates(p,forgotten,NOW))).not.toContain('草莓');
  expect(presenceCandidates(p,m,NOW-120000).some(l=>l.topic==='memory')).toBe(false);
 });
 it('respects quiet requests and sleep while an explicit invitation may override silence',()=>{
  const p=pet(),m=rememberChat(createMemory(p),'希望你安静陪我。',NOW),j=newPresenceJournal(p);
  expect(wantsQuiet(m)).toBe(true);expect(choosePresence(p,m,j,NOW)).toBeNull();
  expect(choosePresence(p,m,j,NOW,true)).not.toBeNull();
  expect(choosePresence({...p,sleeping:true},m,j,NOW,true)).toBeNull();
  const boundary={...m,facts:[{id:'b',kind:'boundary' as const,value:'不要讲鸡汤。不要提醒喝水。',at:NOW}]};
  expect(presenceCandidates(p,boundary,NOW).some(l=>['progress','culture','work'].includes(l.topic))).toBe(false);
 });
 it('avoids recent repetitions and consecutive topics, and limits care requests',()=>{
  const p=pet(),m=createMemory(p);let j=newPresenceJournal(p);
  for(let i=0;i<60;i++){
   const line=choosePresence(p,m,j,NOW+i*600000)!;
   expect(line).not.toBeNull();expect(j.history.at(-1)?.topic).not.toBe(line.topic);
   expect(j.history.slice(-16).some(h=>h.id===line.id)).toBe(false);
   j=rememberPresence(j,line,NOW+i*600000);
  }
  expect(j.history).toHaveLength(48);
  j=rememberPresence(j,{id:'care-food',topic:'care',text:'饿啦'},NOW);
  for(let i=0;i<20;i++)expect(choosePresence({...p,stats:{...p.stats,thirst:10}},m,j,NOW+i*60000)?.topic).not.toBe('care');
 });
 it('stores cadence per pet without copying messages or facts, safely recovers corrupt cache',()=>{
  const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});
  const p=pet(),m=createMemory(p),line=choosePresence(p,m,newPresenceJournal(p),NOW)!;
  const j=rememberPresence(newPresenceJournal(p),line,NOW);
  expect(readPresenceJournal(p)).toEqual(j);expect(JSON.stringify(j)).not.toContain(line.text);
  expect(readPresenceJournal({...p,createdAt:p.createdAt+1}).history).toEqual([]);
  data.set(presenceKey(p),'{broken');expect(readPresenceJournal(p).history).toEqual([]);
  data.set(presenceKey(p),JSON.stringify({...j,history:[null,{id:'bad',topic:'culture',at:Infinity},...j.history]}));
  expect(readPresenceJournal(p)).toEqual(j);
 });
 it('can explain every cultural line in a follow-up without saving assistant statements as user facts',()=>{
  const p=pet();
  for(const line of CULTURE){
   const m=appendMessage(createMemory(p),'assistant',line.text,NOW);
   expect(localReply(p,m,'这句话是什么意思？')).toContain(line.reply);
   expect(m.facts).toEqual([]);
  }
  expect(presenceFollowUp(CULTURE[0].text,'为什么我今天心情不好')).toBeNull();
  expect(presenceFollowUp('你好呀','这句话是什么意思')).toBeNull();
 });
});

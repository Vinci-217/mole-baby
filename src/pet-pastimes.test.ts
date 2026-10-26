import {describe,it,expect} from 'vitest'
import {createPet,parseSave} from './game'
import {beginOuting,finishOuting,spellCostume,PASTIMES} from './pet-pastimes'
import {getRamActionDuration,sampleRamPose,sampleSeedPose,sampleFlyingPose} from './components/ram-animation'
import {idleCandidates} from './idle-behavior'
import {createMemory,getCompanionMood,recordEvent} from './companion-memory'

const NOW=new Date(2026,9,24,12).getTime()
const pet=()=>({...createPet('小叶','red',NOW-2*86400000),growth:180,lastTick:NOW})
describe('self-directed little life',()=>{
 it('does not invent a whirlwind lesson before learning that actual skill',()=>{
   const places=Array.from({length:15},(_,i)=>beginOuting(pet(),i,NOW,true)!.outing!.place)
   expect(places).not.toContain('拉姆学院 · 魔法课')
   const educated={...pet(),education:{lessons:{wind:3},graduated:{wind:NOW}}}
   expect(Array.from({length:15},(_,i)=>beginOuting(educated,i,NOW,true)!.outing!.place)).toContain('拉姆学院 · 魔法课')
 })
 it('does not send seeds, sleeping pets or pets with critical needs on trips',()=>{
   expect(beginOuting({...pet(),growth:0},0,NOW,true)).toBeNull()
   expect(beginOuting({...pet(),sleeping:true},0,NOW,true)).toBeNull()
   for(const key of ['health','hunger','thirst','cleanliness','energy'] as const)expect(beginOuting({...pet(),stats:{...pet().stats,[key]:20}},0,NOW,true)).toBeNull()
 })
 it('persists a bounded trip, enforces the automatic cooldown and allows an immediate recall without losing inventory',()=>{
   const started=beginOuting(pet(),0,NOW)!;expect(started.outing).toBeDefined();expect(started.outing!.returnsAt-NOW).toBeGreaterThanOrEqual(120000);expect(started.outing!.returnsAt-NOW).toBeLessThanOrEqual(300000)
   const restored=parseSave(JSON.stringify(started),NOW)!;expect(restored.outing).toEqual(started.outing);expect(idleCandidates(restored)).toEqual([])
   const returned=finishOuting(restored);expect(returned.outing).toBeUndefined();expect(returned.inventory).toEqual(pet().inventory);expect(returned.coins).toBe(pet().coins)
   expect(beginOuting(returned,1,NOW+60000)).toBeNull();expect(beginOuting(returned,1,NOW+60000,true)).not.toBeNull()
   expect(finishOuting(returned)).toBe(returned)
 })
 it('keeps overdue trips for one return on reopening and rejects foreign or unbounded trip data',()=>{
   const started=beginOuting(pet(),0,NOW)!;expect(parseSave(JSON.stringify(started),NOW+600000)!.outing).toEqual(started.outing);expect(parseSave(JSON.stringify({...started,growth:0}),NOW)!.outing).toBeUndefined()
   for(const bad of [{...started.outing!,id:'another-pet'},{...started.outing!,returnsAt:NOW+600001},{...started.outing!,story:'untrusted invented reward'}])expect(parseSave(JSON.stringify({...started,outing:bad}),NOW)!.outing).toBeUndefined()
 })
 it('changes the daily illusion without mutating the real wardrobe',()=>{
   const before=JSON.stringify(pet()),looks=new Set(Array.from({length:4},(_,i)=>spellCostume(pet().createdAt,NOW+i*86400000)))
   expect(looks.size).toBe(4);expect(spellCostume(pet().createdAt,NOW)).toBe(spellCostume(pet().createdAt,NOW+1000));expect(JSON.stringify(pet())).toBe(before)
 })
 it('finishes every activity in all forms and reduced motion, including finite self-reading',()=>{
   for(const form of ['seed','junior','middle','senior','super','water','wood','fire'])for(const action of PASTIMES){
     const duration=getRamActionDuration(action,form)!;expect(duration).toBeGreaterThan(0);expect(duration).toBeLessThanOrEqual(18000)
     for(const reduced of [false,true]){
       const sample=(t:number)=>form==='seed'?sampleSeedPose(action,t,reduced):['junior','middle'].includes(form)?sampleRamPose(action,t,reduced,form):sampleFlyingPose(action,t,reduced,form)
       expect(sample(duration-1).finished).toBe(false);expect(sample(duration).finished).toBe(true)
     }
   }
 })
 it('never farms human affection with automatic performances or check-ins',()=>{
   const p=pet(),memory=createMemory(p),before=getCompanionMood(memory,p,NOW).affection
   let next=memory;for(const kind of ['outing-return','check-in','self-read-alone','self-spell'])next=recordEvent(next,{kind,detail:'我自己练习了一会儿。',at:NOW})
   expect(getCompanionMood(next,p,NOW).affection).toBe(before)
 })
 it('keeps care memories when automatic adventures fill their own smaller budget',()=>{
   const p=pet();let memory=recordEvent(createMemory(p),{kind:'feed',detail:'你给我喂了熊熊饼干。',at:NOW-86400000})
   for(let i=0;i<100;i++)memory=recordEvent(memory,{kind:'outing-return',detail:`我看了第${i}片叶子。`,at:NOW+i*60000})
   expect(memory.events.filter(e=>e.kind==='outing-return')).toHaveLength(40);expect(memory.events[0].kind).toBe('feed')
   memory=recordEvent(memory,{kind:'self-read-alone',detail:'我翻了几页。',at:NOW});const once=memory
   expect(recordEvent(memory,{kind:'self-read-alone',detail:'我又翻了一会儿。',at:NOW+60000})).toBe(once)
 })
})

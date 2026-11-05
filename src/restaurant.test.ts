import {restorePetBackup,PET_SAVE_KEY} from './pet-backup';
import {createMemory,recordEvent} from './companion-memory';
import {describe,it,expect} from 'vitest';
import {createPet,parseSave} from './game';
import {RECIPES,INTERIORS,createRestaurant,createSession,restaurantCommand,openRestaurant,advanceRestaurant,closeRestaurant,normalizeRestaurant,restaurantLevel} from './restaurant';
import type {RestaurantSession} from './restaurant';
import type {GameState} from './game';
const now=1700000000000;
const pet=():GameState=>({...createPet('紫紫','blue',now),color:'#9b59d0',growth:840,growthLocked:true,evolution:'classic',coins:20000,restaurant:createRestaurant()});
function run(p:GameState,s:RestaurantSession,ms:number){for(let t=0;t<ms;t+=250){const next=advanceRestaurant(p,s,Math.min(250,ms-t));p=next.state;s=next.session;}return {p,s};}
function cookAndServe(p=pet(),dish=1340001){
 const cooked=restaurantCommand(p,{kind:'cook',dish,stove:0});expect(cooked.ok).toBe(true);
 let {p:next,s}=run(cooked.state,openRestaurant(cooked.state,createSession(13)).session,RECIPES.find(r=>r.id===dish)!.cookMs);
 const collected=restaurantCommand(next,{kind:'collect',stove:0});expect(collected.ok).toBe(true);next=collected.state;
 return {p:next,s};
}
describe('online local restaurant',()=>{
 it('offers all 72 real recipes for a positive bean price and known original assets',()=>{
  expect(RECIPES).toHaveLength(72);expect(new Set(RECIPES.map(r=>r.id)).size).toBe(72);expect(INTERIORS).toHaveLength(15);
  for(const r of RECIPES){expect(r.cost).toBeGreaterThan(0);expect(r.level).toBeLessThanOrEqual(60);expect(r.servings*r.sell).toBeGreaterThan(r.cost);}
 });
 it('debits one batch atomically and rejects insufficient funds, busy stoves and locked dishes',()=>{
  const p=pet(),recipe=RECIPES[0],bought=restaurantCommand(p,{kind:'cook',dish:recipe.id,stove:0});
  expect(bought.state.coins).toBe(p.coins-recipe.cost);expect(bought.state.restaurant!.spent).toBe(recipe.cost);
  expect(restaurantCommand(bought.state,{kind:'cook',dish:recipe.id,stove:0}).state).toBe(bought.state);
  expect(restaurantCommand({...p,coins:0},{kind:'cook',dish:recipe.id,stove:1}).ok).toBe(false);
  expect(restaurantCommand(p,{kind:'cook',dish:1340074,stove:0}).ok).toBe(false);
 });
 it('requires online cooking, manual collection, and prevents collecting twice',()=>{
  const p=restaurantCommand(pet(),{kind:'cook',dish:1340001,stove:0}).state;
  expect(advanceRestaurant(p,createSession(),1000).state).toBe(p);
  expect(restaurantCommand(p,{kind:'collect',stove:0}).ok).toBe(false);
  const {p:done}=run(p,openRestaurant(p,createSession(1)).session,10000);
  const collected=restaurantCommand(done,{kind:'collect',stove:0});expect(collected.state.restaurant!.stock[1340001]).toBe(15);
  expect(restaurantCommand(collected.state,{kind:'collect',stove:0}).ok).toBe(false);
 });
 it('takes orders, fetches, delivers, returns and pays exactly once after eating',()=>{
  let {p,s}=cookAndServe();const coins=p.coins,phases=new Set<string>();
  for(let t=0;t<30000;t+=250){({state:p,session:s}=advanceRestaurant(p,s,250));for(const g of s.guests)phases.add(g.phase);}
  for(const phase of ['wait','fetch','deliver','eat','leave'])expect(phases.has(phase)).toBe(true);
  expect(s.served).toBeGreaterThan(0);expect(p.coins-coins).toBe(p.restaurant!.revenue);expect(p.restaurant!.served).toBe(s.served);
  expect(s.earned).toBe(p.restaurant!.revenue);expect(restaurantLevel(p.restaurant!.xp)).toBeGreaterThanOrEqual(1);
  const closed=closeRestaurant(p,s);expect(advanceRestaurant(closed.state,closed.session,2000).state.coins).toBe(p.coins);
 });
 it('refunds an in-flight order on close, reload or backup restore with no offline earnings',()=>{
  let {p,s}=cookAndServe();({p,s}=run(p,s,3500));expect(s.guests.some(g=>g.phase==='fetch'||g.phase==='deliver'||g.phase==='eat')).toBe(true);
  const total=(p.restaurant!.stock[1340001]??0)+Object.values(p.restaurant!.reserved??{}).reduce((a,b)=>a+b,0),coins=p.coins;
  const restore=parseSave(JSON.stringify(p),now+24*3600000)!;expect(restore.coins).toBe(coins);expect(restore.restaurant!.stock[1340001]).toBe(total);expect(restore.restaurant!.reserved).toBeUndefined();
  expect(restore.color).toBe(p.color);expect(restore.growthLocked).toBe(true);expect(restore.evolution).toBe('classic');expect(restore.inventory).toEqual(p.inventory);
  const closed=closeRestaurant(p,s);expect(closed.state.restaurant!.stock[1340001]).toBe(total);expect(closed.state.coins).toBe(coins);
  expect(closeRestaurant(closed.state,closed.session).state.restaurant).toEqual(closed.state.restaurant);
 });
 it('automatically closes on suspension and freezes remaining cooking time across restart',()=>{
  const p=restaurantCommand(pet(),{kind:'cook',dish:1340001,stove:0}).state,s=openRestaurant(p,createSession()).session;
  const paused=advanceRestaurant(p,s,60000);expect(paused.session.open).toBe(false);expect(paused.state.restaurant!.stoves[0]!.remaining).toBe(10000);
  const restored=parseSave(JSON.stringify(paused.state),now+3600000)!;expect(restored.restaurant!.stoves[0]!.remaining).toBe(10000);expect(restored.coins).toBe(p.coins);
 });
 it('burns uncollected dishes, preserves stock at capacity and does not oversell',()=>{
  const p=restaurantCommand(pet(),{kind:'cook',dish:1340001,stove:0}).state;
  const done=run(p,openRestaurant(p,createSession()).session,75000);expect(done.p.restaurant!.stoves[0]!.state).toBe('burnt');
  expect(restaurantCommand(done.p,{kind:'collect',stove:0}).ok).toBe(false);
  const p2={...pet(),restaurant:{...createRestaurant(),stock:{1340001:1}}},s2=openRestaurant(p2,createSession(3)).session;
  const sale=run(p2,s2,90000);expect(sale.p.restaurant!.served).toBe(1);expect(sale.p.restaurant!.revenue).toBe(10);expect(Object.values(sale.p.restaurant!.stock).every(n=>n>=0)).toBe(true);expect(sale.p.restaurant!.lost).toBeGreaterThan(0);
 });
 it('gates staff/interiors and stops work for a tired pet without losing unpaid meals',()=>{
  const p=pet(),hired=restaurantCommand(p,{kind:'hire'});expect(hired.ok).toBe(true);expect(hired.state.restaurant!.staff).toBe(2);expect(restaurantCommand(hired.state,{kind:'hire'}).ok).toBe(false);
  expect(restaurantCommand(p,{kind:'interior',id:1330006}).ok).toBe(false);
  let {p:working,s}=cookAndServe();({p:working,s}=run(working,s,3500));
  const stopped=advanceRestaurant({...working,stats:{...working.stats,energy:10}},s,250);expect(stopped.session.open).toBe(false);expect(stopped.state.coins).toBe(working.coins);
 });
 it('round trips all progress without altering existing save identity and rejects invalid data',()=>{
  const p=pet();p.restaurant={...createRestaurant(),xp:100000,interior:1330023,owned:[1330004,1330023],staff:4,stock:{1340001:100},mastery:{1340001:26},stoves:[{dish:1340001,state:'cooking',remaining:5000,fresh:60000}]};
  const saved=parseSave(JSON.stringify(p),now)!;expect(saved.createdAt).toBe(p.createdAt);expect(saved.color).toBe(p.color);expect(saved.restaurant!.interior).toBe(1330023);expect(saved.restaurant!.staff).toBe(4);expect(saved.restaurant!.stock).toEqual(p.restaurant.stock);
  const bad=normalizeRestaurant({version:1,stock:{evil:999,1340001:-1},stoves:[{dish:0}],xp:NaN,staff:999})!;expect(bad.xp).toBe(0);expect(bad.stock).toEqual({});expect(bad.staff).toBe(1);expect(bad.stoves.every(s=>s===null)).toBe(true);
 });
 it('exports and restores restaurant supplies together with the original pet memories',()=>{
  let {p,s}=cookAndServe();({p,s}=run(p,s,3500));
  const memory=recordEvent(createMemory(p),{kind:'test-restaurant',detail:'保留原来的陪伴记忆',at:now}),values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};
  const result=restorePetBackup(JSON.stringify({...p,companionMemory:memory}),storage,now);
  expect(result.pet.color).toBe('#9b59d0');expect(result.pet.createdAt).toBe(p.createdAt);expect(result.pet.coins).toBe(p.coins);
  expect(result.memory.events.some(e=>e.detail==='保留原来的陪伴记忆')).toBe(true);
  expect(result.pet.restaurant!.stock[1340001]).toBe(15);expect(result.pet.restaurant!.reserved).toBeUndefined();
  expect(JSON.parse(values.get(PET_SAVE_KEY)!).restaurant.stock[1340001]).toBe(15);
 });

});

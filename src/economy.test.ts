import {describe,it,expect} from 'vitest';
import {createPet,parseSave,rewardGame} from './game';
import {gameBeans} from './economy';
import {gamePrizeChoices} from './game-prizes';
import {wearOutfit} from './wardrobe';
import {beginActivity,settleActivity} from './pet-school';
import {originalSpecialActions} from './pet-original-actions';
import {SELECTABLE_EVOLUTIONS} from './game';
const now=new Date(2026,10,7,12).getTime();
describe('confirmed economy and save continuity',()=>{
 it('pays whole beans per second and settles the same time only once',()=>{
  const p={...createPet('旧拉姆','blue',now),coins:237,growth:60};const start=beginActivity(p,'restaurant',undefined,now).state;
  expect(settleActivity(start,now+999).coins).toBe(237);
  const one=settleActivity(start,now+1000);expect(one.coins).toBe(238);expect(settleActivity(one,now+1000)).toBe(one);
  expect(settleActivity(one,now+60000).coins).toBe(297);
 });
 it('retains a round receipt and daily bonus across reopen, including later duplicate callbacks',()=>{
  const p=createPet('旧拉姆','blue',now),r={id:'first-round',activeMs:20000};
  const first=rewardGame(p,10,now,()=>0,r);expect(first.baseCoins).toBe(400);expect(first.bonusCoins).toBe(500);
  const loaded=parseSave(JSON.stringify(first.state),now)!;
  const duplicate=rewardGame(loaded,10,now+20000,()=>{throw Error('No duplicate lottery')},r);expect(duplicate.ok).toBe(false);expect(duplicate.state.coins).toBe(loaded.coins);
  const second=rewardGame(loaded,10,now+20000,()=>0,{id:'second',activeMs:30000});expect(second.baseCoins).toBe(600);expect(second.bonusCoins).toBe(0);
  const tomorrow=now+86400000,next=rewardGame({...second.state,lastTick:tomorrow},5,tomorrow,()=>0,{id:'tomorrow',activeMs:30000});expect(next.bonusCoins).toBe(500);
 });
 it('awards collections to seeds without equipping or replacing existing possessions',()=>{
  const p={...createPet('种子','pink',now),coins:357,wardrobe:['party-cap' as const],room:{owned:['plant'],placed:[{id:'plant',x:50,y:70}]}};
  const pool=gamePrizeChoices(p);expect(pool.some(p=>p.id==='party-cap'||p.id==='plant')).toBe(false);
  for(const kind of ['outfit','furniture'] as const){const index=pool.findIndex(p=>p.kind===kind),prize=pool[index];expect(index).toBeGreaterThan(0);
   const result=rewardGame(p,1,now,()=>(index+.5)/pool.length,{id:kind,activeMs:30000});expect(result.prize).toEqual(prize);
   const loaded=parseSave(JSON.stringify(result.state),now)!;expect(loaded.wearing).toBeUndefined();expect(loaded.wardrobe).toContain('party-cap');expect(loaded.room?.placed).toEqual(p.room.placed);expect(loaded.coins).toBe(p.coins+gameBeans(1));
   if(kind==='outfit')expect(wearOutfit(loaded,prize.id).ok).toBe(false);
  }
 });
 it('keeps old super records while removing its selector and fragment transformations',()=>{
  const p={...createPet('旧超拉','blue',now),growth:840,evolution:'super' as const,coins:237};
  expect(parseSave(JSON.stringify(p),now)).toMatchObject({coins:237,evolution:'super',createdAt:now});expect(SELECTABLE_EVOLUTIONS.some(f=>f.id==='super')).toBe(false);
  for(const form of ['junior','middle','senior','classic','super','water','wood','fire'] as const)expect(originalSpecialActions(form).some(row=>row.clip.path.includes('/tatter/'))).toBe(false);
 });
});

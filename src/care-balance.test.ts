import {describe,it,expect} from 'vitest';
import {createPet,care,tick,parseSave,gameRewardItems,rewardGame,STAGES,WAKE_ENERGY} from './game';
import {ACTIVITY_REQUIREMENTS,RESTAURANT_REQUIREMENTS,PLAY_REQUIREMENTS,unmetNeedReason} from './pet-status';
import {activityBlockReason} from './pet-school';
import {mayPlay,playBlockReason} from './pet-pastimes';
import {elementEffectRect,originalElementClip,elementDecodedBytes} from './element-playback';
import {ELEMENT_SKILLS} from './element-skills';

const NOW=1_800_000_000_000;
const fresh=()=>({...createPet('小叶','blue',NOW),growth:180});
describe('clear need requirements',()=>{
 for(const requirements of [ACTIVITY_REQUIREMENTS,RESTAURANT_REQUIREMENTS,PLAY_REQUIREMENTS])for(const {key,minimum,exclusive} of requirements){
  it(`explains ${key} ${minimum} and accepts the exact permitted boundary (${Boolean(exclusive)})`,()=>{
   const stats={...fresh().stats,[key]:minimum-.1};
   const reason=unmetNeedReason(stats,requirements)!;
   expect(reason).toContain(String(minimum));expect(reason).toContain('当前');
   expect(unmetNeedReason({...stats,[key]:minimum},requirements)===null).toBe(!exclusive);
   expect(unmetNeedReason({...stats,[key]:minimum+.1},requirements)).toBeNull();
  });
 }
 it('uses the same blocker in activities and recreation instead of silently refusing',()=>{
  const p={...fresh(),stats:{...fresh().stats,energy:29.9}};
  expect(activityBlockReason(p,'restaurant')).toContain('31');
  expect(playBlockReason(p)).toContain('29.9');expect(mayPlay(p)).toBe(false);
 });
});
describe('quick, continuous sleep',()=>{
 it('recovers ten points per minute, persists across reload and wakes exactly at 85',()=>{
  const asleep=care({...fresh(),stats:{...fresh().stats,energy:20}},'sleep',undefined,NOW).state;
  const minute=tick(asleep,NOW+60_000);expect(minute.stats.energy).toBe(30);expect(minute.sleeping).toBe(true);
  const restored=parseSave(JSON.stringify(minute),NOW+120_000)!;expect(restored.stats.energy).toBe(40);
  const due=NOW+6.5*60_000;
  expect(tick(restored,due-1).sleeping).toBe(true);
  const awake=tick(restored,due);expect(awake.sleeping).toBe(false);expect(awake.stats.energy).toBe(WAKE_ENERGY);
  const once=tick(asleep,due);expect({...once,stats:awake.stats}).toEqual(awake);
  for(const key of Object.keys(awake.stats) as (keyof typeof awake.stats)[])expect(once.stats[key]).toBeCloseTo(awake.stats[key],5);
 });
 it('honors a manually requested one-minute nap even with full energy',()=>{
  const asleep=care({...fresh(),stats:{...fresh().stats,energy:100}},'sleep',undefined,NOW).state;
  expect(tick(asleep,NOW+59_999).sleeping).toBe(true);
  expect(tick(asleep,NOW+60_000).sleeping).toBe(false);
 });
});
describe('random game receipts',()=>{
 it('can award every eligible item at every score without changing coins or source saves',()=>{
  for(const growth of STAGES.map(s=>s.threshold)){
   const p={...fresh(),growth};const pool=gameRewardItems(p);
   expect(pool.length).toBeGreaterThan(3);
   for(const [index,item] of pool.entries())for(const score of [0,5,10]){
    const result=rewardGame(p,score,NOW,()=>(index+.5)/pool.length);
    expect(result.rewardItem?.id).toBe(item.id);expect(result.state.inventory[item.id]).toBe(1);
    expect(result.message).toContain(item.name);expect(result.state.coins-p.coins).toBe(4+score*2);
    expect(item.minStage).toBeLessThanOrEqual(growth===0?0:growth===60?1:growth===180?2:3);
    expect(p.inventory[item.id]).toBe(0);expect(parseSave(JSON.stringify(result.state),NOW)).not.toBeNull();
   }
  }
 });
 it('skips full stacks and gives coins alone when every eligible stack is full',()=>{
  const p=fresh(),pool=gameRewardItems(p);p.inventory[pool[0].id]=9999;
  expect(rewardGame(p,0,NOW,()=>0).rewardItem?.id).toBe(pool[1].id);
  for(const item of pool)p.inventory[item.id]=9999;
  const result=rewardGame(p,0,NOW,()=>{throw Error('Do not draw from an empty pool')});
  expect(result.rewardItem).toBeUndefined();expect(result.state.coins).toBe(104);expect(result.state.inventory).toEqual(p.inventory);
 });
 it('does not draw or grant a second item on duplicate completion',()=>{
  const result=rewardGame(fresh(),5,NOW,()=>.5);
  expect(rewardGame(result.state,5,NOW,()=>{throw Error('Duplicate draw')}).ok).toBe(false);
 });
});
describe('fixed original spell coordinates',()=>{
 for(const {id} of ELEMENT_SKILLS)it(`${id} keeps source scale as its effects expand`,()=>{
  const clip=originalElementClip(id),rect=elementEffectRect(id,'super')!;
  expect(rect.width/clip.width).toBeCloseTo(160/288);
  expect(rect.height/clip.height).toBeCloseTo(160/288);
  expect(elementDecodedBytes(id)).toBeLessThan(160*1024*1024);
  expect(elementEffectRect(id,'classic')!.width).toBe(rect.width);
  expect(elementEffectRect(id,'classic')!.x).toBe(rect.x);
 });
 it('allows large effects to exceed the former 160-pixel host',()=>{
  for(const id of ['fire-6','water-6','wood-6']){
   const rect=elementEffectRect(id,'super')!;expect(Math.max(rect.width,rect.height)).toBeGreaterThan(400);
  }
 });
});

import {gamePrizeChoices} from './game-prizes';
import {ALL_OUTFITS} from './wardrobe';
import {FURNITURE} from './room-furnishings';
import {ITEMS} from './catalog';
import {gameBeans} from './economy';
import {describe,it,expect} from 'vitest';
import {createPet,care,tick,parseSave,rewardGame,STAGES,WAKE_ENERGY} from './game';
import {ACTIVITY_REQUIREMENTS,RESTAURANT_REQUIREMENTS,PLAY_REQUIREMENTS,unmetNeedReason} from './pet-status';
import {activityBlockReason} from './pet-school';
import {mayPlay,playBlockReason} from './pet-pastimes';
import {elementEffectRect,originalElementClip,elementDecodedBytes} from './element-playback';
import {ELEMENT_SKILLS} from './element-skills';
import visibility from '../electron/edge-visibility.json';

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
  expect(activityBlockReason(p,'restaurant')).toBeNull();
  expect(activityBlockReason(p,'course','language')).toContain('30');
  expect(activityBlockReason({...p,stats:{...p.stats,energy:22.9}},'restaurant')).toContain('23');
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
 it('awards each eligible prize and preserves inventory, identity and ownership through reload',()=>{
  for(const growth of STAGES.map(s=>s.threshold)){
   const p={...fresh(),growth},pool=gamePrizeChoices(p);
   for(const [index,prize] of pool.entries()){
    const result=rewardGame(p,5,NOW,()=>(index+.5)/pool.length);
    expect(result.prize).toEqual(prize);expect(result.state.coins-p.coins).toBe(gameBeans(5)+500);
    expect(result.message).toContain(prize.name);const loaded=parseSave(JSON.stringify(result.state),NOW)!;expect(loaded.createdAt).toBe(p.createdAt);expect(loaded.color).toBe(p.color);
    if(prize.kind==='item'){expect(loaded.inventory[prize.id]).toBe(1);expect(p.inventory[prize.id]).toBe(0);}
    else if(prize.kind==='outfit'){expect(loaded.wardrobe).toContain(prize.id);expect(loaded.wearing).toBeUndefined();}
    else {expect(loaded.room?.owned).toContain(prize.id);expect(loaded.room?.placed??[]).toEqual([]);}
   }
  }
 });
 it('skips full stacks and can pay coins with no remaining collection slots',()=>{
  const p=fresh(),pool=gamePrizeChoices(p);p.inventory[pool[0].id]=9999;
  expect(rewardGame(p,1,NOW,()=>0).prize?.id).toBe(pool[1].id);
  p.inventory=Object.fromEntries(ITEMS.map(item=>[item.id,9999]));p.wardrobe=ALL_OUTFITS.filter(o=>o.id!=='star-wand').map(o=>o.id);p.room={owned:FURNITURE.map(f=>f.id),placed:[]};
  const result=rewardGame(p,1,NOW,()=>{throw Error('No draw from empty pool')});
  expect(result.prize).toBeUndefined();expect(result.state.coins).toBe(p.coins+gameBeans(1));expect(result.state.inventory).toEqual(p.inventory);
 });
 it('does not draw or grant a second prize on duplicate completion',()=>{
  const result=rewardGame(fresh(),5,NOW,()=>.5);
  expect(rewardGame(result.state,5,NOW,()=>{throw Error('Duplicate draw')}).ok).toBe(false);
 });
});
const formWidth=(form:'classic'|'super')=>visibility.forms[form].body[2]-visibility.forms[form].body[0];
describe('fixed original spell coordinates',()=>{
 for(const {id} of ELEMENT_SKILLS)it(`${id} keeps source scale as its effects expand`,()=>{
  const clip=originalElementClip(id),rect=elementEffectRect(id,'super')!;
  const scale=rect.width/clip.width;
  expect(rect.height/clip.height).toBeCloseTo(scale);
  expect(clip.registration.referenceBodyWidth*scale).toBeCloseTo(visibility.forms.super.body[2]-visibility.forms.super.body[0]);
  expect(elementEffectRect(id,'super')).toEqual(rect);
  expect(elementDecodedBytes(id)).toBeLessThan(160*1024*1024);
  const classic=elementEffectRect(id,'classic')!,width=formWidth('classic');
  expect(classic.width/rect.width).toBeCloseTo(width/formWidth('super'));
  expect(clip.registration.referenceBodyWidth*classic.width/clip.width).toBeCloseTo(width);
 });
 it('allows large effects to exceed the former 160-pixel host',()=>{
  for(const id of ['fire-6','water-6','wood-6']){
   const rect=elementEffectRect(id,'super')!;expect(Math.max(rect.width,rect.height)).toBeGreaterThan(400);
  }
 });
});

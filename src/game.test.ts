import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buyFood, buyItem, care, changePetStage, evolvePet, EVOLUTIONS, COLORS, createPet, GAME_REWARD_COOLDOWN_MS, getItem, getNextStage, getPetCondition, getStage, GROWTH_MAX, GROWTH_STAGE_HOURS, ITEMS, parseSave, rewardGame, STAGES, tick, WAKE_GRACE_MS } from './game';

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const fresh = () => createPet('小芽', 'pink', NOW);

describe('pet creation and growth', () => {
  it('creates independent starter inventories and sanitizes names', () => {
    const a = fresh();
    const b = fresh();
    a.inventory.berry = 5;
    expect(b.inventory.berry).toBe(0);
    expect(Object.values(b.inventory).every(count => count === 0)).toBe(true);
    expect(b.coins).toBe(100);
    expect(b.growth).toBe(0);
    expect(createPet(' \n ', 'red', NOW).name).toBe('小拉姆');
  });

  it('crosses precisely the four ordinary growth boundaries', () => {
    expect(getStage(0)).toBe(0);
    for (const [index, stage] of STAGES.slice(0, 4).entries()) {
      expect(getStage(stage.threshold)).toBe(index);
      if (index > 0) expect(getStage(stage.threshold - 0.001)).toBe(index - 1);
    }
    expect(getNextStage(0)).toEqual(STAGES[1]);
    expect(getNextStage(GROWTH_MAX)).toBeNull();
    expect(care({ ...fresh(), growth: GROWTH_MAX - 0.1 }, 'pet', undefined, NOW).state.growth).toBe(GROWTH_MAX - 0.1);
  });
});

describe('time and sleep', () => {
  it('decays needs and grows only during healthy time without mutating input', () => {
    const original = fresh();
    const result = tick(original, NOW + HOUR);
    expect(result.stats.hunger).toBe(77);
    expect(result.stats.energy).toBe(81);
    expect(result.growth).toBe(2.5);
    expect(original.stats.hunger).toBe(82);
    expect(original.growth).toBe(0);
    expect(tick({ ...original, stats: { ...original.stats, hunger: 30 } }, NOW + HOUR).growth).toBe(0);
  });

  it('caps a long absence at 24 hours and never makes needs negative', () => {
    const a = tick(fresh(), NOW + 24 * HOUR);
    const b = tick(fresh(), NOW + 90 * 24 * HOUR);
    expect(b.stats).toEqual(a.stats);
    expect(b.growth).toBe(a.growth);
    expect(b.lastTick).toBe(NOW + 90 * 24 * HOUR);
    expect(Object.values(b.stats).every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(tick(b, b.lastTick)).toBe(b);
    expect(tick(b, NOW)).toBe(b);
  });

  it('restores energy during sleep and lets the user wake the pet', () => {
    const tired = { ...fresh(), stats: { ...fresh().stats, energy: 10 } };
    const sleeping = care(tired, 'sleep', undefined, NOW).state;
    const rested = tick(sleeping, NOW + 3 * HOUR);
    expect(rested.sleeping).toBe(true);
    expect(rested.stats.energy).toBe(76);
    expect(rested.growth).toBe(0);
    expect(care(rested, 'feed', 'berry', NOW + 3 * HOUR).ok).toBe(false);
    expect(care(rested, 'sleep', undefined, NOW + 3 * HOUR).state.sleeping).toBe(false);
    const nextDay=tick(sleeping,NOW+24*HOUR);
    expect(nextDay.sleeping).toBe(false);
    expect(nextDay.stats.energy).toBeCloseTo(79.454545,4); // Two natural naps and awake time, rather than sleeping forever.
  });

  it('awards the same elapsed growth for one long interval or many short ones', () => {
    const once = tick(fresh(), NOW + 12 * HOUR);
    let many = fresh();
    for (let hour = 1; hour <= 12; hour++) many = tick(many, NOW + hour * HOUR);
    expect(many.growth).toBeCloseTo(once.growth, 5);
    expect(many.stats).toEqual(once.stats);
  });
});

describe('autonomous rest',()=>{
  it('sleeps at low energy, recovers while asleep and naturally wakes without user input',()=>{
    const p={...fresh(),stats:{...fresh().stats,energy:24}};
    const asleep=tick(p,NOW+HOUR);expect(asleep.sleeping).toBe(true);expect(asleep.stats.energy).toBe(20);
    const resting=tick(asleep,NOW+2*HOUR);expect(resting.sleeping).toBe(true);expect(resting.stats.energy).toBe(42);
    const awake=tick(resting,NOW+4*HOUR);expect(awake.sleeping).toBe(false);expect(awake.stats.energy).toBeCloseTo(84.818182,5);
    expect(p.sleeping).toBe(false);
  });
  it('gives a manually woken pet a persisted grace period without forcing energy to refill',()=>{
    const asleep={...fresh(),sleeping:true,stats:{...fresh().stats,energy:10}};
    const awake=care(asleep,'sleep',undefined,NOW).state;
    expect(awake).toMatchObject({sleeping:false,awakeUntil:NOW+WAKE_GRACE_MS});expect(awake.stats.energy).toBe(10);
    const restored=parseSave(JSON.stringify(awake),NOW+5*60000)!;expect(restored.sleeping).toBe(false);
    expect(restored.awakeUntil).toBe(NOW+WAKE_GRACE_MS);expect(restored.stats.energy).toBeLessThan(10);
    expect(tick(restored,NOW+WAKE_GRACE_MS+1000).sleeping).toBe(true);
  });
  it('integrates consistently across a complete day and both sleep boundaries',()=>{
    const p={...fresh(),stats:{...fresh().stats,energy:24}};
    const once=tick(p,NOW+24*HOUR);let many=p;
    for(let n=1;n<=24*60;n++)many=tick(many,NOW+n*60000);
    expect(many.sleeping).toBe(once.sleeping);expect(many.growth).toBeCloseTo(once.growth,3);
    for(const key of Object.keys(once.stats) as (keyof typeof once.stats)[])expect(many.stats[key]).toBeCloseTo(once.stats[key],3);
  });
  it('ignores corrupt or excessive optional wake grace without discarding an older save',()=>{
    for(const value of ['forever',-1,NOW+86400000]){
      const restored=parseSave(JSON.stringify({...fresh(),awakeUntil:value}),NOW)!;
      expect(restored).not.toBeNull();expect(restored.awakeUntil).toBeUndefined();
    }
  });
});

describe('care and shopping', () => {
  it('consumes exactly one food and caps fullness', () => {
    const original = fresh();
    original.inventory.biscuit = 3;
    const result = care(original, 'feed', 'biscuit', NOW);
    expect(result.ok).toBe(true);
    expect(result.state.inventory.biscuit).toBe(2);
    expect(result.state.stats.hunger).toBe(100);
    expect(result.state.growth).toBe(0);
    expect(original.inventory.biscuit).toBe(3);
    expect(care(result.state, 'feed', 'biscuit', NOW).ok).toBe(false);
  });

  it('does not consume unavailable or unknown food', () => {
    const empty = { ...fresh(), inventory: { berry: 0, biscuit: 0, juice: 0 } };
    expect(care(empty, 'feed', 'berry', NOW)).toMatchObject({ ok: false, state: empty });
    expect(care(fresh(), 'feed', 'unknown', NOW).ok).toBe(false);
  });

  it('charges the listed price and refuses purchases without enough coins', () => {
    const original = fresh();
    const bought = buyFood(original, 'berry');
    expect(bought.ok).toBe(true);
    expect(bought.state.coins).toBe(75);
    expect(bought.state.inventory.berry).toBe(1);
    expect(original.coins).toBe(100);
    const poor = { ...fresh(), coins: 7 };
    expect(buyFood(poor, 'berry')).toMatchObject({ state: poor, ok: false });
    expect(buyFood(original, 'unknown').ok).toBe(false);
  });
});

describe('minigame rewards', () => {
  it('grants coins, one food and a completion without instant growth; clamps excessive scores', () => {
    const original = fresh();
    const reward = rewardGame(original, 999, NOW);
    expect(reward.ok).toBe(true);
    expect(reward.state.coins).toBe(124);
    expect(reward.state.inventory.juice).toBe(1);
    expect(reward.state.growth).toBe(0);
    expect(reward.state.completedGames).toBe(1);
    expect(original.completedGames).toBe(0);
    expect(rewardGame(original, -1, NOW).state.coins).toBe(104);
    expect(rewardGame(original, Number.NaN, NOW).state.coins).toBe(104);
  });

  it('rejects duplicate rewards, then permits another completed round', () => {
    const first = rewardGame(fresh(), 7, NOW).state;
    const duplicate = rewardGame(first, 7, NOW + 100);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.state.coins).toBe(first.coins);
    expect(duplicate.state.completedGames).toBe(1);
    expect(rewardGame(first, 7, NOW + GAME_REWARD_COOLDOWN_MS).ok).toBe(true);
  });
});

describe('save validation', () => {
  it('round-trips a save and applies the time spent offline', () => {
    expect(parseSave(JSON.stringify(fresh()), NOW)).toEqual(fresh());
    const restored = parseSave(JSON.stringify(fresh()), NOW + HOUR);
    expect(restored?.stats.hunger).toBe(77);
    expect(restored?.growth).toBe(2.5);
  });

  it.each([null, '', '{', 'null', '[]', '{}', '42'])('rejects invalid JSON or save shape: %s', (raw) => {
    expect(parseSave(raw, NOW)).toBeNull();
  });

  it.each([
    { version: 2 },
    { color: 'purple' },
    { name: '' },
    { name: 'a'.repeat(17) },
    { createdAt: NOW + HOUR },
    { lastTick: NOW - 1 },
    { lastRewardAt: NOW + 1 },
    { growth: GROWTH_MAX + 1 },
    { coins: -1 },
    { coins: 1.5 },
    { completedGames: '1' },
    { sleeping: 'false' },
    { stats: { hunger: -1, happiness: 50, cleanliness: 50, energy: 50 } },
    { stats: { hunger: 50, happiness: 101, cleanliness: 50, energy: 50 } },
    { stats: { hunger: 50, happiness: 50, cleanliness: 50 } },
    { inventory: { berry: -1 } },
    { inventory: { berry: 0.5 } },
    { inventory: { berry: 10_000 } },
    { inventory: { mystery: 1 } },
    { inventory: [] },
  ])('rejects corrupted fields: %j', (override) => {
    expect(parseSave(JSON.stringify({ ...fresh(), ...override }), NOW)).toBeNull();
  });

  it('rejects non-finite values and hostile inventory keys', () => {
    const raw = JSON.stringify(fresh()).replace('"coins":100', '"coins":1e999');
    expect(parseSave(raw, NOW)).toBeNull();
    const hostile = JSON.stringify(fresh()).replace('"berry":0', '"__proto__":5');
    expect(parseSave(hostile, NOW)).toBeNull();
  });
});


describe('original item catalogue', () => {
  it('uses documented names, effects, nonzero shop prices and existing original art', () => {
    const xml = readFileSync(new URL('../public/assets/original/items/petfood.xml', import.meta.url), 'utf8');
    const source = new Map([...xml.matchAll(/<Item\s+([^>]+)\/?\s*>/g)].map(match => {
      const attributes = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(attr => [attr[1], attr[2]]));
      return [attributes.ID, attributes];
    }));
    expect(ITEMS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(ITEMS.map(item => item.id)).size).toBe(ITEMS.length);
    expect(new Set(ITEMS.map(item => item.category))).toEqual(new Set(['food', 'drink', 'clean', 'medicine']));
    for (const item of ITEMS) {
      if(item.changesColor){expect(existsSync(new URL(`../public/${item.image.slice(2)}`,import.meta.url))).toBe(true);expect(item.localPrice).toBe(true);expect(item.originalPrice).toBe(0);expect(COLORS.some(c=>c.id===item.changesColor)).toBe(true);continue;}
      const original = source.get(item.sourceId)!;
      expect(original.Name).toBe(item.name);
      expect(item.hunger).toBe(Number(original.Hungry));
      expect(item.thirst).toBe(Number(original.Thirsty));
      expect(item.cleanliness).toBe(Number(original.Sanitary));
      expect(item.happiness).toBe(Number(original.Spirit));
      expect(item.price).toBeGreaterThan(0);
      expect(item.originalPrice).toBe(Number(original.Price));
      if (item.originalPrice > 0) expect(item.price).toBe(item.originalPrice);
      else expect(item.localPrice).toBe(true);
      expect(existsSync(new URL(`../public/${item.image.slice(2)}`, import.meta.url))).toBe(true);
    }
    expect(getItem('180027')).toMatchObject({ id: 'berry', name: '可可果', hunger: 50, thirst: 0 });
    expect(getItem('juice')).toMatchObject({ hunger: 0, thirst: 50, price: 20 });
  });

  it('charges each item price, adds exactly one and preserves unrelated inventory', () => {
    for (const item of ITEMS) {
      const state = { ...fresh(), coins: 500 };
      const result = buyItem(state, item.id);
      expect(result.ok).toBe(true);
      expect(result.state.coins).toBe(500 - item.price);
      expect(result.state.inventory[item.id]).toBe(1);
      expect(state.inventory[item.id]).toBe(0);
      expect(buyItem({ ...state, coins: item.price - 1 }, item.id).ok).toBe(false);
    }
    const full = fresh();
    full.inventory['180003'] = 9999;
    expect(buyItem(full, '180003')).toMatchObject({ ok: false, state: full });
  });

  it('applies all original item effects and consumes exactly one item', () => {
    for (const item of ITEMS.filter(item=>!item.changesColor)) {
      const state = { ...fresh(), growth: GROWTH_MAX, stats: { hunger: 10, thirst: 10, cleanliness: 10, happiness: 10, health: 10, energy: 80 } };
      state.inventory[item.id] = 2;
      const result = care(state, 'use', item.id, NOW);
      expect(result.ok).toBe(true);
      expect(result.state.inventory[item.id]).toBe(1);
      for (const key of ['hunger', 'thirst', 'cleanliness', 'happiness', 'health'] as const) {
        expect(result.state.stats[key]).toBe(Math.min(100, 10 + item[key]));
      }
      expect(state.inventory[item.id]).toBe(2);
    }
  });

  it('requires an owned cleaning product and never offers a free wash', () => {
    const state = fresh();
    expect(care(state, 'wash', undefined, NOW)).toMatchObject({ ok: false, state });
    expect(care(state, 'wash', '180003', NOW)).toMatchObject({ ok: false, state });
    const purchased = buyItem(state, '180003').state;
    const clean = care(purchased, 'wash', '180003', NOW);
    expect(clean.ok).toBe(true);
    expect(clean.state.inventory['180003']).toBe(0);
    expect(clean.state.stats.cleanliness).toBe(100);
    expect(care({ ...purchased, stats: { ...purchased.stats, cleanliness: 100 } }, 'wash', '180003', NOW).ok).toBe(false);
    expect(care(purchased, 'drink', '180003', NOW).ok).toBe(false);
  });

  it('treats drinks as hydration and permits a secondary benefit when fullness is maxed', () => {
    const state = fresh();
    state.inventory.juice = 2;
    const drink = care(state, 'drink', 'juice', NOW);
    expect(drink.ok).toBe(true);
    expect(drink.state.stats.hunger).toBe(state.stats.hunger);
    expect(drink.state.stats.thirst).toBe(100);
    expect(care(state, 'feed', 'juice', NOW).state).toEqual(drink.state);
    const mixed = { ...fresh(), stats: { ...fresh().stats, hunger: 100, thirst: 10 } };
    mixed.inventory['180010'] = 1;
    const watermelon = care(mixed, 'feed', '180010', NOW);
    expect(watermelon.ok).toBe(true);
    expect(watermelon.state.stats.hunger).toBe(100);
    expect(watermelon.state.stats.thirst).toBe(30);
  });

  it('keeps original advanced-food restrictions and restores health with medicine', () => {
    const state = fresh();
    state.inventory['180018'] = 1;
    expect(care(state, 'feed', '180018', NOW).ok).toBe(false);
    expect(care({ ...state, growth: STAGES[2].threshold }, 'feed', '180018', NOW).ok).toBe(true);
    state.inventory['180005'] = 1;
    const sick = { ...state, stats: { ...state.stats, health: 5 } };
    expect(care(sick, 'use', '180005', NOW).state.stats.health).toBe(100);
    expect(care(sick, 'use', '180005', NOW).state.inventory['180005']).toBe(0);
  });
});

describe('old saves and original needs', () => {
  it('adds hydration, health and new inventory slots without resetting old progress', () => {
    const old = { ...fresh(), color: 'blue', growth: 213, coins: 531, completedGames: 5, lastRewardAt: NOW - 5000,
      stats: { hunger: 65, happiness: 42, cleanliness: 39, energy: 71 }, inventory: { berry: 7, biscuit: 3, juice: 1 } };
    const migrated = parseSave(JSON.stringify(old), NOW)!;
    expect(migrated).toMatchObject({ version: 1, color: 'blue', growth: 213, coins: 531, completedGames: 5, lastRewardAt: NOW - 5000,
      stats: { hunger: 65, happiness: 42, cleanliness: 39, energy: 71, thirst: 82, health: 100 }, inventory: { berry: 7, biscuit: 3, juice: 1, '180003': 0 } });
    expect(Object.keys(migrated.inventory)).toHaveLength(ITEMS.length);
    expect(migrated.createdAt).toBe(old.createdAt);
    expect(migrated.lastTick).toBe(old.lastTick);
  });

  it('accepts original numeric aliases at import boundaries, rejects duplicate identities and invalid new stats', () => {
    const state = { ...fresh(), inventory: { '180027': 2, '180003': 3 } };
    expect(parseSave(JSON.stringify(state), NOW)?.inventory).toMatchObject({ berry: 2, '180003': 3 });
    expect(parseSave(JSON.stringify({ ...state, inventory: { berry: 1, '180027': 2 } }), NOW)).toBeNull();
    for (const bad of [-1, 101, '20', null]) {
      expect(parseSave(JSON.stringify({ ...fresh(), stats: { ...fresh().stats, thirst: bad } }), NOW)).toBeNull();
      expect(parseSave(JSON.stringify({ ...fresh(), stats: { ...fresh().stats, health: bad } }), NOW)).toBeNull();
    }
  });

  it('maintains the four chosen colors through every stage and rejects extra colors at runtime', () => {
    expect(COLORS).toHaveLength(4);
    for (const color of COLORS) {
      const state = createPet('芽芽', color.id, NOW);
      for (const stage of STAGES) expect(tick({ ...state, growth: stage.threshold }, NOW + HOUR).color).toBe(color.id);
    }
    expect(() => createPet('芽芽', 'purple' as 'pink', NOW)).toThrow(RangeError);
  });

  it('exposes original need categories with clear sleep and desktop tired states', () => {
    const state = fresh();
    expect(getPetCondition(state)).toMatchObject({ id: 'healthy', action: 'idle' });
    const needs = { hunger: 'hungry', thirst: 'thirsty', cleanliness: 'dirty', happiness: 'sad', health: 'sick', energy: 'tired' };
    for (const [stat, id] of Object.entries(needs)) expect(getPetCondition({ ...state, stats: { ...state.stats, [stat]: 5 } }).id).toBe(id);
    expect(getPetCondition({ ...state, sleeping: true, stats: { ...state.stats, health: 5 } })).toMatchObject({ id: 'sleeping', action: 'sleep' });
  });

  it('dehydrates, loses health under neglect without dying and recovers with sustained care', () => {
    expect(tick(fresh(), NOW + HOUR).stats.thirst).toBe(76);
    const neglected = tick(fresh(), NOW + 24 * HOUR);
    expect(neglected.stats.health).toBeGreaterThanOrEqual(1);
    expect(neglected.stats.health).toBeLessThan(100);
    const cared = { ...fresh(), stats: { ...fresh().stats, health: 20 } };
    expect(tick(cared, NOW + HOUR).stats.health).toBe(22);
    let many = cared;
    for (let hour = 1; hour <= 16; hour++) many = tick(many, NOW + hour * HOUR);
    expect(many.stats).toEqual(tick(cared, NOW + 16 * HOUR).stats);
  });
});


describe('slow real companion growth', () => {
  const replenish = (state: ReturnType<typeof fresh>) => ({ ...state, stats: { hunger: 100, thirst: 100, happiness: 100, cleanliness: 100, health: 100, energy: 100 } });
  it('requires a real day for a healthy seed and several days for the later stages', () => {
    expect(GROWTH_STAGE_HOURS).toEqual([24, 72, 168, 168]);
    let state = replenish(fresh());
    for (let hour = 1; hour <= 24 + 72 + 168 + 168; hour++) {
      state = tick(replenish(state), NOW + hour * HOUR);
      if (hour === 23) expect(getStage(state.growth)).toBe(0);
      if (hour === 24) expect(state.growth).toBe(60);
      if (hour === 95) expect(getStage(state.growth)).toBe(1);
      if (hour === 96) expect(state.growth).toBeCloseTo(180, 4);
      if (hour === 263) expect(getStage(state.growth)).toBe(2);
    }
    expect(state.growth).toBe(GROWTH_MAX);
  });
  it('cannot accelerate a seed by repeated petting, feeding or game rewards', () => {
    let state = fresh();
    for (let click = 0; click < 500; click++) {
      state = care(state, 'pet', undefined, NOW).state;
      state.inventory.berry = 1;
      state.stats.hunger = 10;
      state = care(state, 'feed', 'berry', NOW).state;
      state = rewardGame({ ...state, completedGames: 0 }, 10, NOW).state;
    }
    expect(state.growth).toBe(0);
    expect(getStage(state.growth)).toBe(0);
  });
  it('integrates accurately across boundaries and preserves old mature saves', () => {
    const initial = { ...replenish(fresh()), growth: 59 };
    const once = tick(initial, NOW + 2 * HOUR);
    const split = tick(tick(initial, NOW + HOUR), NOW + 2 * HOUR);
    expect(split.growth).toBeCloseTo(once.growth, 5);
    expect(once.growth).toBeCloseTo(60 + 1.6 * (120 / 72), 5);
    for (const growth of [60, 180, 213, 420]) {
      expect(parseSave(JSON.stringify({ ...fresh(), growth }), NOW)?.growth).toBe(growth);
    }
  });
});


describe('four original god-power evolution choices', () => {
  it('keeps old senior saves ordinary until a deliberate choice, and rejects early/invalid choices', () => {
    const old = { ...fresh(), growth: 420 };
    expect(parseSave(JSON.stringify(old), NOW)?.evolution).toBeUndefined();
    expect(evolvePet(old, 'water', NOW).ok).toBe(false);
    const ready = { ...old, growth: GROWTH_MAX };
    expect(getStage(ready.growth)).toBe(3);
    expect(evolvePet({ ...ready, sleeping: true }, 'water', NOW).ok).toBe(false);
    // @ts-expect-error invalid values must also be rejected at runtime
    expect(evolvePet(ready, 'light', NOW).ok).toBe(false);
  });
  it('preserves all four colors, inventory and identity for each form across save/restore', () => {
    for (const color of COLORS) for (const form of EVOLUTIONS) {
      const ready = { ...createPet('小芽', color.id, NOW), growth: GROWTH_MAX };
      const result = evolvePet(ready, form.id, NOW);
      expect(result.ok).toBe(true);
      expect(result.state).toEqual({ ...ready, evolution: form.id });
      expect(getStage(result.state.growth, result.state.evolution)).toBe(4);
      expect(parseSave(JSON.stringify(result.state), NOW)).toEqual(result.state);
      expect(evolvePet(result.state, 'fire', NOW).ok).toBe(false);
    }
    expect(parseSave(JSON.stringify({ ...fresh(), evolution: 'water' }), NOW)).toBeNull();
    expect(parseSave(JSON.stringify({ ...fresh(), growth: GROWTH_MAX, evolution: 'light' }), NOW)).toBeNull();
  });
});


describe('deliberate settings stage selection', () => {
  it('switches every form in both directions without replacing identity, supplies or needs', () => {
    const original={...fresh(),name:'小红',inventory:{...fresh().inventory,biscuit:3},coins:427};
    for (const stage of [4,3,2,1,0,4] as const) for (const form of EVOLUTIONS) {
      const from={...original,growth:GROWTH_MAX,evolution:'water' as const};
      const result=changePetStage(from,stage,form.id,NOW+1000);
      expect(result.ok).toBe(true);expect(getStage(result.state.growth,result.state.evolution)).toBe(stage);
      expect(result.state).toMatchObject({name:original.name,color:original.color,createdAt:original.createdAt,coins:427,inventory:original.inventory,stats:original.stats});
      expect(result.state.evolution).toBe(stage===4?form.id:undefined);
      expect(parseSave(JSON.stringify(result.state),NOW+1000)?.evolution).toBe(stage===4?form.id:undefined);
    }
  });
  it('preserves natural progress on repeated selection and rejects invalid stages/forms', () => {
    const current={...fresh(),growth:213};
    const locked=changePetStage(current,2).state;expect(locked.growth).toBe(current.growth);expect(locked.growthLocked).toBe(true);expect(changePetStage(locked,2).state).toBe(locked);
    for(const stage of [-1,5,1.5,NaN])expect(changePetStage(current,stage as 0).ok).toBe(false);
    expect(changePetStage(current,4,'invalid' as 'super').ok).toBe(false);
    expect(changePetStage(current,4).state.evolution).toBe('super');
  });
});


describe('local four-colour potion transactions',()=>{
 it('requires a purchased bottle and preserves the pet through every stage and target colour',()=>{
  for(const stage of [0,1,2,3,4] as const)for(const color of COLORS){
   const potion=ITEMS.find(v=>v.changesColor===color.id)!;
   const original={...fresh(),color:(color.id==='red'?'blue':'red') as 'red'|'blue',growth:STAGES[stage].threshold,...(stage===4?{evolution:'water' as const}:{}),coins:500,stats:{hunger:100,thirst:100,cleanliness:100,happiness:100,health:100,energy:100}};
   expect(care(original,'use',potion.id,NOW).ok).toBe(false);
   const bought=buyItem(original,potion.id);expect(bought.state.coins).toBe(500-potion.price);expect(bought.state.inventory[potion.id]).toBe(1);
   const used=care(bought.state,'use',potion.id,NOW);expect(used.ok).toBe(true);expect(used.state.color).toBe(color.id);expect(used.state.inventory[potion.id]).toBe(0);
   for(const key of ['name','createdAt','growth','evolution','stats','completedGames'] as const)expect(used.state[key]).toEqual(original[key]);
   expect(parseSave(JSON.stringify(used.state),NOW)?.color).toBe(color.id);
  }
 });
 it('never consumes a bottle for the same colour or during sleep, and migrates old inventory with empty slots',()=>{
  const potion=ITEMS.find(v=>v.changesColor===fresh().color)!;const original=fresh();original.inventory[potion.id]=2;
  const same=care(original,'use',potion.id,NOW);expect(same.ok).toBe(false);expect(same.state.inventory[potion.id]).toBe(2);
  const different={...original,color:(original.color==='red'?'blue':'red') as 'red'|'blue',sleeping:true};expect(care(different,'use',potion.id,NOW).ok).toBe(false);
  const old=fresh();for(const v of ITEMS.filter(v=>v.changesColor))delete old.inventory[v.id];const restored=parseSave(JSON.stringify(old),NOW)!;
  for(const v of ITEMS.filter(v=>v.changesColor))expect(restored.inventory[v.id]).toBe(0);
  expect(COLORS).toHaveLength(4);
 });
});


describe('manual stage selection stays fixed',()=>{
 it('locks even selecting the current seed, survives reopen and still decays needs',()=>{
  const time=1_700_000_000_000,p=createPet('豆','red',time);
  const locked=changePetStage(p,0,undefined,time).state;
  expect(locked.growthLocked).toBe(true);
  const next=parseSave(JSON.stringify(locked),time+4*3_600_000)!;
  expect(next.growth).toBe(0);expect(next.stats.hunger).toBeLessThan(p.stats.hunger);
 });
 it('preserves natural growth unless settings explicitly selected a stage',()=>{
  const time=1_700_000_000_000,p=createPet('豆','red',time);
  expect(tick(p,time+3_600_000).growth).toBeGreaterThan(0);
  const locked=changePetStage(p,2,undefined,time).state;
  expect(tick(locked,time+3_600_000).growth).toBe(STAGES[2].threshold);
 });
 it('migrates recorded old manual choices before applying offline growth',()=>{
  const time=1_700_000_000_000,p={...createPet('豆','red',time),growth:60};
  expect(parseSave(JSON.stringify(p),time+3_600_000,true)!.growth).toBe(60);
 });
});

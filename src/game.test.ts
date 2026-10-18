import { describe, expect, it } from 'vitest';
import { buyFood, care, createPet, GAME_REWARD_COOLDOWN_MS, getNextStage, getStage, GROWTH_MAX, parseSave, rewardGame, STAGES, tick } from './game';

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const fresh = () => createPet('小芽', 'pink', NOW);

describe('pet creation and growth', () => {
  it('creates independent starter inventories and sanitizes names', () => {
    const a = fresh();
    const b = fresh();
    a.inventory.berry = 0;
    expect(b.inventory.berry).toBe(5);
    expect(b.coins).toBe(100);
    expect(b.growth).toBe(0);
    expect(createPet(' \n ', 'red', NOW).name).toBe('小拉姆');
  });

  it('crosses precisely the four ordinary growth boundaries', () => {
    expect(getStage(0)).toBe(0);
    for (const [index, stage] of STAGES.entries()) {
      expect(getStage(stage.threshold)).toBe(index);
      if (index > 0) expect(getStage(stage.threshold - 0.001)).toBe(index - 1);
    }
    expect(getNextStage(0)).toEqual(STAGES[1]);
    expect(getNextStage(GROWTH_MAX)).toBeNull();
    expect(care({ ...fresh(), growth: GROWTH_MAX - 0.1 }, 'pet', undefined, NOW).state.growth).toBe(GROWTH_MAX);
  });
});

describe('time and sleep', () => {
  it('decays needs and grows only during healthy time without mutating input', () => {
    const original = fresh();
    const result = tick(original, NOW + HOUR);
    expect(result.stats.hunger).toBe(77);
    expect(result.stats.energy).toBe(81);
    expect(result.growth).toBe(18);
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
    expect(tick(sleeping, NOW + 24 * HOUR).stats.energy).toBe(100);
  });

  it('awards the same elapsed growth for one long interval or many short ones', () => {
    const once = tick(fresh(), NOW + 12 * HOUR);
    let many = fresh();
    for (let hour = 1; hour <= 12; hour++) many = tick(many, NOW + hour * HOUR);
    expect(many.growth).toBeCloseTo(once.growth, 5);
    expect(many.stats).toEqual(once.stats);
  });
});

describe('care and shopping', () => {
  it('consumes exactly one food and caps fullness', () => {
    const original = fresh();
    const result = care(original, 'feed', 'biscuit', NOW);
    expect(result.ok).toBe(true);
    expect(result.state.inventory.biscuit).toBe(2);
    expect(result.state.stats.hunger).toBe(100);
    expect(result.state.growth).toBe(4);
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
    expect(bought.state.coins).toBe(92);
    expect(bought.state.inventory.berry).toBe(6);
    expect(original.coins).toBe(100);
    const poor = { ...fresh(), coins: 7 };
    expect(buyFood(poor, 'berry')).toMatchObject({ state: poor, ok: false });
    expect(buyFood(original, 'unknown').ok).toBe(false);
  });
});

describe('minigame rewards', () => {
  it('grants coins, one food, growth and a completion; clamps excessive scores', () => {
    const original = fresh();
    const reward = rewardGame(original, 999, NOW);
    expect(reward.ok).toBe(true);
    expect(reward.state.coins).toBe(124);
    expect(reward.state.inventory.juice).toBe(3);
    expect(reward.state.growth).toBe(13);
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
    expect(restored?.growth).toBe(18);
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
    const hostile = JSON.stringify(fresh()).replace('"berry":5', '"__proto__":5');
    expect(parseSave(hostile, NOW)).toBeNull();
  });
});

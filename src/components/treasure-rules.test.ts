import { describe, expect, it } from 'vitest';
import { createTreasureRound, findTreasure, TREASURE_POOL, treasureHint, treasureScore } from './treasure-rules';

describe('a quiet room treasure hunt', () => {
  it('always places distinct original items and three reachable clues, including random endpoints', () => {
    for (const random of [() => 0, () => .999999, () => 1, () => -1, () => NaN, Math.random]) {
      const round = createTreasureRound(random);
      expect(round.objects).toHaveLength(6);
      expect(new Set(round.objects.map(object => object.id)).size).toBe(6);
      expect(new Set(round.objects.map(object => `${object.x},${object.y}`)).size).toBe(6);
      expect(round.targets).toHaveLength(3); expect(new Set(round.targets).size).toBe(3);
      for (const object of round.objects) {
        expect(TREASURE_POOL).toContain(object.id);
        expect(object.name.length).toBeGreaterThan(0); expect(object.image).toMatch(/original\/items\/\d+\.png$/);
        expect(object.x).toBeGreaterThanOrEqual(15); expect(object.x).toBeLessThanOrEqual(85);
        expect(object.y).toBeGreaterThanOrEqual(20); expect(object.y).toBeLessThanOrEqual(70);
      }
      expect(round.targets.every(id => round.objects.some(object => object.id === id))).toBe(true);
    }
  });
  it('collects only matching visible targets once and leaves the previous found list untouched', () => {
    const round = createTreasureRound(() => .2), first = round.targets[0], found: string[] = [];
    const decoy = round.objects.find(object => !round.targets.includes(object.id))!.id;
    expect(findTreasure(round, found, decoy)).toBeNull(); expect(findTreasure(round, found, 'missing')).toBeNull();
    const next = findTreasure(round, found, first)!;
    expect(next).toEqual([first]); expect(found).toEqual([]);
    expect(findTreasure(round, next, first)).toBeNull();
    expect(findTreasure({ ...round, objects: [] }, [], first)).toBeNull();
  });
  it('helps only with remaining clues and never rewards incomplete searching', () => {
    const round = createTreasureRound(() => .4);
    expect(treasureHint(round, [])).toBe(round.targets[0]);
    expect(treasureHint(round, [round.targets[0]])).toBe(round.targets[1]);
    expect(treasureHint(round, round.targets)).toBeNull();
    expect(treasureScore(round, [], [])).toBe(0);
    expect(treasureScore(round, round.targets.slice(0, 2), [])).toBe(0);
    expect(treasureScore(round, round.targets, [])).toBe(10);
    expect(treasureScore(round, round.targets, [round.targets[0], round.targets[0], 'missing'])).toBe(9);
    expect(treasureScore(round, round.targets, round.targets)).toBe(7);
    expect(treasureScore({ ...round, targets: [] }, [], [])).toBe(0);
  });
});

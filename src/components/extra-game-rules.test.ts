import { describe, expect, it } from 'vitest';
import {
  activeFrameDelta, createOrchard, createPuzzle, ORCHARD_DURATION, orchardClaim, orchardScore,
  puzzleMove, puzzleNeighbors, puzzleSolved, RHYTHM_BEATS, rhythmHit, rhythmScore, SOLVED_PUZZLE,
} from './extra-game-rules';
import type { BeatJudgment } from './extra-game-rules';

describe('rhythm contact and scoring', () => {
  const empty = () => RHYTHM_BEATS.map((): BeatJudgment => null);
  it('only judges within the visible hit window, with a tighter perfect band', () => {
    expect(rhythmHit(1_000, empty())).toEqual({ index: 0, judgment: 'perfect' });
    expect(rhythmHit(1_085, empty())?.judgment).toBe('perfect');
    expect(rhythmHit(1_086, empty())?.judgment).toBe('good');
    expect(rhythmHit(1_180, empty())?.judgment).toBe('good');
    expect(rhythmHit(1_181, empty())).toBeNull();
    expect(rhythmHit(819, empty())).toBeNull();
  });
  it('cannot award the same beat twice or reward repeated rapid taps', () => {
    const judged = empty(); judged[0] = 'perfect';
    expect(rhythmHit(1_005, judged)).toBeNull();
    expect(rhythmHit(1_000, empty(), 980)).toBeNull();
    expect(rhythmHit(1_000, empty(), 800)?.index).toBe(0);
    expect(rhythmHit(NaN, empty())).toBeNull();
  });
  it('uses the full round to normalize score instead of awarding ten for one hit', () => {
    expect(rhythmScore(empty())).toBe(0);
    expect(rhythmScore(RHYTHM_BEATS.map(() => 'perfect'))).toBe(10);
    expect(rhythmScore(RHYTHM_BEATS.map(() => 'good'))).toBe(5);
    expect(rhythmScore(RHYTHM_BEATS.map((_, i) => i < 10 ? 'perfect' : 'miss'))).toBe(5);
  });
});

describe('orchard fruit contact', () => {
  it('gives every fruit a distinct time window inside the round and changes grass slots', () => {
    const rounds = [createOrchard(() => 0), createOrchard(() => .999), createOrchard()];
    for (const fruits of rounds) {
      expect(fruits).toHaveLength(15);
      fruits.forEach((fruit, index) => {
        expect(fruit.slot).toBeGreaterThanOrEqual(0); expect(fruit.slot).toBeLessThan(9);
        expect(fruit.end).toBeLessThan(ORCHARD_DURATION);
        if (index) { expect(fruit.slot).not.toBe(fruits[index - 1].slot); expect(fruit.start).toBeGreaterThan(fruits[index - 1].end); }
      });
    }
  });
  it('requires the clicked grass slot to visibly contain an unclaimed fruit', () => {
    const fruits = createOrchard(() => .2), first = fruits[0];
    expect(orchardClaim(fruits, new Set(), first.start - 1, first.slot)).toBe(-1);
    expect(orchardClaim(fruits, new Set(), first.start, first.slot)).toBe(0);
    expect(orchardClaim(fruits, new Set(), first.end, first.slot)).toBe(-1);
    expect(orchardClaim(fruits, new Set(), first.start + 10, (first.slot + 1) % 9)).toBe(-1);
    expect(orchardClaim(fruits, new Set([0]), first.start + 10, first.slot)).toBe(-1);
  });
  it('caps scores and does not award full credit for partial rounds', () => {
    expect(orchardScore(0)).toBe(0); expect(orchardScore(3)).toBe(2);
    expect(orchardScore(15)).toBe(10); expect(orchardScore(30)).toBe(10); expect(orchardScore(-5)).toBe(0);
  });
});

describe('reachable sliding puzzles', () => {
  it('moves adjacent pieces, forbids row wrapping, and leaves the source untouched', () => {
    const board = [...SOLVED_PUZZLE];
    expect(puzzleMove(board, 7)).toEqual([1, 2, 3, 4, 5, 6, 7, 0, 8]);
    expect(board).toEqual(SOLVED_PUZZLE);
    expect(puzzleMove(board, 0)).toBeNull(); expect(puzzleMove(board, 8)).toBeNull();
    expect(puzzleNeighbors(3)).not.toContain(2); expect(puzzleNeighbors(2)).not.toContain(3);
    expect(puzzleNeighbors(-1)).toEqual([]); expect(puzzleMove(board, NaN)).toBeNull();
  });
  it('always produces unsolved permutations with an even inversion count', () => {
    for (let seed = 0; seed < 100; seed++) {
      let value = seed + 1;
      const random = () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 2 ** 32; };
      const board = createPuzzle(random);
      expect([...board].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(puzzleSolved(board)).toBe(false);
      const tiles = board.filter(Boolean);
      const inversions = tiles.reduce((total, tile, index) => total + tiles.slice(index + 1).filter(next => next < tile).length, 0);
      expect(inversions % 2).toBe(0);
    }
    expect(puzzleSolved(createPuzzle(() => 0))).toBe(false);
    expect(puzzleSolved(createPuzzle(() => .999))).toBe(false);
  });
  it('recognizes only the fully completed nine-tile picture', () => {
    expect(puzzleSolved(SOLVED_PUZZLE)).toBe(true);
    expect(puzzleSolved([1, 2, 3])).toBe(false);
    expect(puzzleSolved([1, 2, 3, 4, 5, 6, 0, 7, 8])).toBe(false);
  });
});

describe('active round clocks', () => {
  it('does not consume playtime on hidden, paused, first, stalled or invalid frames', () => {
    expect(activeFrameDelta(100, null, false)).toBe(0);
    expect(activeFrameDelta(116, 100, false)).toBe(16);
    expect(activeFrameDelta(116, 100, true)).toBe(0);
    expect(activeFrameDelta(1_000, 100, false)).toBe(0);
    expect(activeFrameDelta(90, 100, false)).toBe(0);
    expect(activeFrameDelta(Infinity, 100, false)).toBe(0);
  });
});

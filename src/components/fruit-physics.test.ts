import { describe, expect, it } from 'vitest';
import { advanceFruitGame, crossingCatch, FRUIT_SIZE, getCatchBand, initialFruitModel } from './fruit-physics';
import { sampleRamPose } from './ram-animation';

describe('contact matches the visible catch band', () => {
  const before = { x: 100, y: 200, halfWidth: 18, spriteTop: 160 };
  const after = { ...before, x: 300 };
  it('interpolates where the pet was when contact occurred, not its final position', () => {
    expect(crossingCatch({ x: 300, y: 178 }, 198, before, after)).toBeNull();
    expect(crossingCatch({ x: 200, y: 178 }, 198, before, after)).toEqual({ x: 200, y: 200, catcherX: 200 });
  });
  it('counts the fruit edge touching the band but rejects a gap', () => {
    const fixed = { ...before, x: 200 };
    expect(crossingCatch({ x: 227, y: 178 }, 198, fixed, fixed)).not.toBeNull();
    expect(crossingCatch({ x: 228, y: 178 }, 198, fixed, fixed)).toBeNull();
  });
  it('cannot catch something already below the head', () => {
    expect(crossingCatch({ x: 100, y: 202 }, 210, before, before)).toBeNull();
  });
  it('updates the score, removes the fruit, and creates contact feedback in one step', () => {
    const state = initialFruitModel(), band = getCatchBand(2, state.basket);
    state.spawned = 10; state.berries = [{ id: 4, x: band.x, y: band.y - FRUIT_SIZE.height / 2 - 1, speed: 100, rotation: 0 }];
    const caught = advanceFruitGame(state, .02, 0, 2);
    expect(caught.score).toBe(1); expect(caught.berries).toHaveLength(0);
    expect(caught.feedback).toHaveLength(1); expect(caught.feedback[0]).toMatchObject({ id: 4, kind: 'caught', x: band.x, y: band.y });
    expect(advanceFruitGame(caught, .02, 0, 2).score).toBe(1);
  });
  it('shows a miss instead of silently discarding fruit or awarding points', () => {
    const state = initialFruitModel(); state.spawned = 10; state.berries = [{ id: 3, x: 10, y: 270, speed: 100, rotation: 0 }];
    const missed = advanceFruitGame(state, .02, 0, 2);
    expect(missed.score).toBe(0); expect(missed.missed).toBe(1); expect(missed.feedback[0].kind).toBe('missed');
  });
  it('does not fast forward a hidden or stalled browser through a collision', () => {
    const state = initialFruitModel();
    expect(advanceFruitGame(state, 5, 1, 2)).toBe(state);
    expect(advanceFruitGame(state, NaN, 1, 2)).toBe(state);
  });
  it('keeps a planted seed immobile even if called outside the disabled UI', () => {
    const state = initialFruitModel(); state.target = 350;
    expect(advanceFruitGame(state, .05, 1, 0).basket).toBe(200);
  });
});

describe('quiet and finite Ram animation', () => {
  it('holds the idle pose between occasional blinks', () => {
    expect(sampleRamPose('idle', 5000)).toMatchObject({ row: 0, frame: 0 });
    expect(sampleRamPose('idle', 6400).frame).toBeGreaterThan(0);
  });
  it('acknowledges a catch without jumping and finishes after 249ms', () => {
    for (const t of [0, 90, 180, 250]) expect(sampleRamPose('catch', t).row).toBe(0);
    expect(sampleRamPose('catch', 250).finished).toBe(true);
    expect(sampleRamPose('catch', 10000)).toEqual({ row: 0, frame: 0, finished: true });
  });
  it('honors still and reduced motion, and keeps genuine walking separate', () => {
    expect(sampleRamPose('still', 6400)).toMatchObject({ row: 0, frame: 0 });
    expect(sampleRamPose('walk-left', 240)).toMatchObject({ row: 2, frame: 3 });
    expect(sampleRamPose('play', 100, true)).toMatchObject({ row: 0, frame: 0 });
  });
});

it('aligns each god-power catch band with its original body, excluding the crown', () => {
  for (const form of ['super', 'water', 'wood', 'fire'] as const) {
    const band = getCatchBand(4, 200, form);
    expect(Number.isFinite(band.spriteTop)).toBe(true);
    expect(band.halfWidth).toBeGreaterThan(10);
    expect(band.y).toBeGreaterThan(band.spriteTop + 40);
    expect(crossingCatch({ x: band.x, y: band.y - 30 }, band.y + 20, band, band)).not.toBeNull();
    expect(crossingCatch({ x: band.x + 100, y: band.y - 30 }, band.y + 20, band, band)).toBeNull();
  }
});

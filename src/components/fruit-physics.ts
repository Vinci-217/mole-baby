import type { Stage } from '../game';

// Everything, including the artwork and the collision band, shares this canvas.
// Rendering these coordinates as percentages keeps them aligned on narrow screens.
export const FRUIT_ARENA = { width: 400, height: 300 } as const;
export const GAME_SECONDS = 20;
export const MAX_FRUIT = 10;
export const FRUIT_SIZE = { width: 18, height: 24 } as const;
export const PET_WIDTH = 88;
export const PET_HEIGHT = PET_WIDTH * 208 / 192;
export const GROUND_Y = 278;
const PET_FOOT_Y = 264;
const MOVEMENT_SPEED = 320;
const SPAWN_POSITIONS = [96, 288, 168, 320, 76, 228, 140, 312, 104, 256];

// Measured from the coloured body in original row 0, frame 0 (192 × 208).
// Leaves and transparent margins do not enlarge the area that can catch fruit.
const BODY_BOUNDS = {
  0: { left: 21, top: 48, right: 169, bottom: 152 },
  1: { left: 21, top: 48, right: 169, bottom: 152 },
  2: { left: 39, top: 85, right: 159, bottom: 169 },
  3: { left: 37, top: 105, right: 143, bottom: 193 },
} as const;

export interface Fruit {
  id: number;
  x: number;
  y: number;
  speed: number;
  rotation: number;
}
export interface FruitFeedback {
  id: number;
  kind: 'caught' | 'missed';
  x: number;
  y: number;
  catcherX: number;
  createdAt: number;
}
export interface FruitModel {
  basket: number;
  target: number;
  berries: Fruit[];
  feedback: FruitFeedback[];
  spawned: number;
  score: number;
  missed: number;
  elapsed: number;
  lastCatchAt: number;
}
export interface CatchBand { x: number; y: number; halfWidth: number; spriteTop: number }

export function initialFruitModel(): FruitModel {
  return { basket: 200, target: 200, berries: [], feedback: [], spawned: 0, score: 0, missed: 0, elapsed: 0, lastCatchAt: -1 };
}

export function clampCatcher(x: number): number {
  return Math.min(FRUIT_ARENA.width - PET_WIDTH / 2, Math.max(PET_WIDTH / 2, x));
}

export function getCatchBand(stage: Stage, basket: number): CatchBand {
  const body = BODY_BOUNDS[stage];
  const scale = PET_WIDTH / 192;
  const spriteTop = PET_FOOT_Y - body.bottom * scale;
  // A narrow, visible band across the upper part of the actual body. The band
  // stays at the same height during the short catch acknowledgement.
  const y = spriteTop + (body.top + (body.bottom - body.top) * .18) * scale;
  return {
    x: basket + ((body.left + body.right) / 2 - 96) * scale,
    y,
    halfWidth: (body.right - body.left) * scale * .31,
    spriteTop,
  };
}

/** Swept rectangle/band contact. Interpolate BOTH objects at the contact time;
 * comparing a previous fruit with the final catcher position creates false hits.
 */
export function crossingCatch(
  fruit: Pick<Fruit, 'x' | 'y'>,
  nextY: number,
  before: CatchBand,
  after: CatchBand,
): { x: number; y: number; catcherX: number } | null {
  const previousBottom = fruit.y + FRUIT_SIZE.height / 2;
  const nextBottom = nextY + FRUIT_SIZE.height / 2;
  const travel = nextBottom - previousBottom;
  if (travel <= 0 || previousBottom > before.y || nextBottom < after.y) return null;
  const t = (before.y - previousBottom) / travel;
  if (t < 0 || t > 1) return null;
  const catcherX = before.x + (after.x - before.x) * t;
  if (Math.abs(fruit.x - catcherX) > before.halfWidth + FRUIT_SIZE.width / 2) return null;
  return { x: fruit.x, y: before.y, catcherX };
}

/** Advance only active, short frame intervals. Hidden tabs and long stalls must
 * never fast-forward fruit through the character or silently consume game time.
 */
export function advanceFruitGame(previous: FruitModel, seconds: number, direction: number, stage: Stage): FruitModel {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > .25 || previous.elapsed >= GAME_SECONDS) return previous;
  const delta = Math.min(seconds, .05, GAME_SECONDS - previous.elapsed);
  const elapsed = previous.elapsed + delta;
  const target = stage === 0 ? 200 : direction ? clampCatcher(previous.basket + Math.sign(direction) * MOVEMENT_SPEED * delta) : clampCatcher(previous.target);
  const distance = target - previous.basket;
  const basket = stage === 0 ? 200 : previous.basket + Math.sign(distance) * Math.min(Math.abs(distance), MOVEMENT_SPEED * delta);
  const before = getCatchBand(stage, previous.basket);
  const after = getCatchBand(stage, basket);
  let score = previous.score;
  let missed = previous.missed;
  let spawned = previous.spawned;
  let lastCatchAt = previous.lastCatchAt;
  const feedback = previous.feedback.filter(effect => elapsed - effect.createdAt < .8);
  const fruit = [...previous.berries];
  if (spawned < MAX_FRUIT && elapsed >= .45 + spawned * 1.7) {
    fruit.push({ id: spawned, x: SPAWN_POSITIONS[spawned], y: -FRUIT_SIZE.height, speed: 96 + (spawned % 3) * 3, rotation: (spawned % 2 ? 1 : -1) * 11 });
    spawned++;
  }
  const berries: Fruit[] = [];
  for (const berry of fruit) {
    const nextY = berry.y + berry.speed * delta;
    const hit = crossingCatch(berry, nextY, before, after);
    if (hit) {
      score = Math.min(MAX_FRUIT, score + 1);
      lastCatchAt = elapsed;
      feedback.push({ id: berry.id, kind: 'caught', ...hit, createdAt: elapsed });
    } else if (nextY + FRUIT_SIZE.height / 2 >= GROUND_Y) {
      missed++;
      feedback.push({ id: berry.id, kind: 'missed', x: berry.x, y: GROUND_Y, catcherX: after.x, createdAt: elapsed });
    } else {
      berries.push({ ...berry, y: nextY });
    }
  }
  return { basket, target, berries, feedback, spawned, score, missed, elapsed, lastCatchAt };
}

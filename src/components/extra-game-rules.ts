/** Timing and board rules are independent of animation/render frequency. */
export const RHYTHM_DURATION = 20_000;
export const RHYTHM_BEATS = Array.from({ length: 20 }, (_, index) => 1_000 + index * 900);
export type BeatJudgment = 'perfect' | 'good' | 'miss' | null;

export function rhythmHit(elapsed: number, judgments: readonly BeatJudgment[], lastTap = -Infinity) {
  if (!Number.isFinite(elapsed) || elapsed - lastTap < 110) return null;
  let best = -1;
  let distance = Infinity;
  RHYTHM_BEATS.forEach((time, index) => {
    const difference = Math.abs(time - elapsed);
    if (judgments[index] === null && difference <= 180 && difference < distance) {
      best = index; distance = difference;
    }
  });
  return best < 0 ? null : { index: best, judgment: distance <= 85 ? 'perfect' as const : 'good' as const };
}

export function rhythmScore(judgments: readonly BeatJudgment[]) {
  const points = judgments.reduce<number>((total, judgment) => total + (judgment === 'perfect' ? 2 : judgment === 'good' ? 1 : 0), 0);
  return Math.min(10, Math.max(0, Math.round(points / (RHYTHM_BEATS.length * 2) * 10)));
}

export interface OrchardFruit { slot: number; start: number; end: number; kind: number }
export const ORCHARD_DURATION = 15_000;
export function createOrchard(random: () => number = Math.random): OrchardFruit[] {
  let lastSlot = -1;
  return Array.from({ length: 15 }, (_, index) => {
    const choice = Math.min(7, Math.max(0, Math.floor(random() * 8)));
    const slot = choice >= lastSlot && lastSlot >= 0 ? choice + 1 : choice;
    lastSlot = slot;
    return { slot, start: 700 + index * 900, end: 1_400 + index * 900, kind: index % 3 };
  });
}
export function orchardClaim(fruits: readonly OrchardFruit[], claimed: ReadonlySet<number>, elapsed: number, slot: number) {
  return fruits.findIndex((fruit, index) => fruit.slot === slot && elapsed >= fruit.start && elapsed < fruit.end && !claimed.has(index));
}
export function orchardScore(hits: number) {
  return Math.max(0, Math.min(10, Math.round(hits / 15 * 10)));
}

export const SOLVED_PUZZLE = [1, 2, 3, 4, 5, 6, 7, 8, 0] as const;
export function puzzleSolved(board: readonly number[]) {
  return board.length === 9 && board.every((value, index) => value === SOLVED_PUZZLE[index]);
}
export function puzzleNeighbors(blank: number) {
  if (!Number.isInteger(blank) || blank < 0 || blank > 8) return [];
  return [blank - 3, blank + 3, ...(blank % 3 > 0 ? [blank - 1] : []), ...(blank % 3 < 2 ? [blank + 1] : [])].filter(index => index >= 0 && index < 9);
}
export function puzzleMove(board: readonly number[], index: number): number[] | null {
  if (board.length !== 9 || !Number.isInteger(index)) return null;
  const blank = board.indexOf(0);
  if (!puzzleNeighbors(blank).includes(index)) return null;
  const next = [...board]; [next[index], next[blank]] = [next[blank], next[index]];
  return next;
}
/** Scrambling by legal moves guarantees reachability, even with a fixed random source. */
export function createPuzzle(random: () => number = Math.random, steps = 36) {
  let board: number[] = [...SOLVED_PUZZLE];
  let previous = -1;
  for (let step = 0; step < Math.max(1, steps); step++) {
    const blank = board.indexOf(0);
    const options = puzzleNeighbors(blank).filter(index => index !== previous);
    const index = options[Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)))];
    board = puzzleMove(board, index)!; previous = blank;
  }
  if (puzzleSolved(board)) board = puzzleMove(board, 7)!;
  return board;
}

/** Suspended/background frames never consume a round's active play time. */
export function activeFrameDelta(now: number, previous: number | null, paused: boolean) {
  if (paused || previous === null || !Number.isFinite(now) || !Number.isFinite(previous)) return 0;
  const delta = now - previous;
  return delta >= 0 && delta <= 250 ? delta : 0;
}

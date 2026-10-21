import { getItem } from '../catalog';

/** Existing original game items, without changing the player's inventory. */
export const TREASURE_POOL = ['berry', 'biscuit', 'juice', '180002', '180010', '180028', '180030', '180071'] as const;
export const TREASURE_TARGET_COUNT = 3;
export interface TreasureObject { id: string; name: string; image: string; x: number; y: number }
export interface TreasureRound { objects: TreasureObject[]; targets: string[] }
const PLACES = [[17, 27], [47, 34], [80, 25], [18, 69], [52, 66], [84, 61]] as const;

function shuffle<T>(source: readonly T[], random: () => number): T[] {
  const result = [...source];
  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    const at = Number.isFinite(value) ? Math.max(0, Math.min(i, Math.floor(value * (i + 1)))) : 0;
    [result[i], result[at]] = [result[at], result[i]];
  }
  return result;
}

/** Distinct, separated positions keep every clue reachable in the small room. */
export function createTreasureRound(random: () => number = Math.random): TreasureRound {
  const ids = shuffle(TREASURE_POOL, random).slice(0, PLACES.length);
  const places = shuffle(PLACES, random);
  const objects = ids.map((id, index) => {
    const item = getItem(id)!;
    return { id, name: item.name, image: item.image, x: places[index][0], y: places[index][1] };
  });
  return { objects, targets: shuffle(ids, random).slice(0, TREASURE_TARGET_COUNT) };
}

/** A visible decoy, unknown ID, or already found item never advances the list. */
export function findTreasure(round: TreasureRound, found: readonly string[], id: string): string[] | null {
  if (!round.targets.includes(id) || !round.objects.some(object => object.id === id) || found.includes(id)) return null;
  return [...found, id];
}

export function treasureHint(round: TreasureRound, found: readonly string[]): string | null {
  return round.targets.find(id => !found.includes(id)) ?? null;
}

/** Unhurried searching has no time penalty. Only completed lists can score. */
export function treasureScore(round: TreasureRound, found: readonly string[], hinted: readonly string[]): number {
  if (round.targets.length !== TREASURE_TARGET_COUNT || !round.targets.every(id => found.includes(id))) return 0;
  const hints = new Set(hinted.filter(id => round.targets.includes(id))).size;
  return 10 - hints;
}

import { ITEMS, getStage, type Action, type GameState, type ItemCategory, type PetItem } from './game';

export const CLASSIC_PAGE_SIZE = 12;
export const categoryAction = (category: ItemCategory): Action => ({food:'feed',drink:'drink',clean:'wash',medicine:'use'} as const)[category];
/** Keep the last consumed slot in place until selection changes. Never show
 * unowned shop stock as if it were in the player's backpack. */
export function pocketItems(pet: GameState, retained?: string) {
  return ITEMS.filter(item => (pet.inventory[item.id] ?? 0) > 0 || item.id === retained);
}
export function itemUseReason(pet: GameState, item: PetItem, busy: boolean) {
  if (pet.sleeping) return '先叫醒拉姆';
  if (busy) return '正在照料…';
  if (!(pet.inventory[item.id] > 0)) return '已经用完啦';
  if (getStage(pet.growth, pet.evolution) < item.minStage) return `${['种子期','初级','中级','高级'][item.minStage]}可用`;
  if (item.changesColor === pet.color) return '已经是这个颜色';
  return null;
}

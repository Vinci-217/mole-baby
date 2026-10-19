/** Original item names/effects/prices: assets/original/items/petfood.xml.
 * Activity gifts have explicit local shop prices; see research/items-states.md.
 * Stable berry/biscuit/juice IDs keep existing v1 saves and rewards intact.
 */
import type { PetColor } from './game';
export type ItemCategory = 'food' | 'drink' | 'clean' | 'medicine';
export const CATEGORY_LABELS: Record<ItemCategory, string> = { food: '食物', drink: '饮品', clean: '清洁', medicine: '药水' };
export interface PetItem {
  id: string;
  sourceId: string;
  name: string;
  category: ItemCategory;
  image: string;
  emoji: string;
  price: number;
  originalPrice: number;
  localPrice: boolean;
  hunger: number;
  thirst: number;
  cleanliness: number;
  happiness: number;
  health: number;
  minStage: 0 | 1 | 2 | 3;
  description: string;
  changesColor?: PetColor;
}

export const ITEMS: PetItem[] = [
  { id: 'berry', sourceId: '180027', name: '可可果', category: 'food', image: './assets/original/items/180027.png', emoji: '🍽️', price: 25, originalPrice: 0, localPrice: true, hunger: 50, thirst: 0, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '饱食+50；活动道具，商店价格为桌宠设定。' },
  { id: 'biscuit', sourceId: '180017', name: '熊熊饼干', category: 'food', image: './assets/original/items/180017.png', emoji: '🍽️', price: 15, originalPrice: 15, localPrice: false, hunger: 30, thirst: 0, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '饱食+30。' },
  { id: 'juice', sourceId: '180008', name: '浆果果汁', category: 'drink', image: './assets/original/items/180008.png', emoji: '🥛', price: 20, originalPrice: 20, localPrice: false, hunger: 0, thirst: 50, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '水分+50。' },
  { id: '180001', sourceId: '180001', name: '巧克力豆', category: 'food', image: './assets/original/items/180001.png', emoji: '🍽️', price: 10, originalPrice: 10, localPrice: false, hunger: 20, thirst: 0, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '饱食+20。' },
  { id: '180002', sourceId: '180002', name: '麦香牛奶', category: 'drink', image: './assets/original/items/180002.png', emoji: '🥛', price: 10, originalPrice: 10, localPrice: false, hunger: 0, thirst: 20, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '水分+20。' },
  { id: '180003', sourceId: '180003', name: '泡泡浴', category: 'clean', image: './assets/original/items/180003.png', emoji: '🛁', price: 10, originalPrice: 10, localPrice: false, hunger: 0, thirst: 0, cleanliness: 20, happiness: 0, health: 0, minStage: 0, description: '清洁+20。' },
  { id: '180005', sourceId: '180005', name: '万能药水', category: 'medicine', image: './assets/original/items/180005.png', emoji: '🧪', price: 400, originalPrice: 400, localPrice: false, hunger: 20, thirst: 20, cleanliness: 20, happiness: 20, health: 100, minStage: 0, description: '饱食+20，水分+20，清洁+20，心情+20，恢复健康（桌宠适配）。' },
  { id: '180007', sourceId: '180007', name: '青叶粽子', category: 'food', image: './assets/original/items/180007.png', emoji: '🍽️', price: 25, originalPrice: 25, localPrice: false, hunger: 20, thirst: 0, cleanliness: 0, happiness: 10, health: 0, minStage: 0, description: '饱食+20，心情+10。' },
  { id: '180009', sourceId: '180009', name: '青苹果洗面奶', category: 'clean', image: './assets/original/items/180009.png', emoji: '🛁', price: 20, originalPrice: 20, localPrice: false, hunger: 0, thirst: 0, cleanliness: 50, happiness: 0, health: 0, minStage: 0, description: '清洁+50。' },
  { id: '180010', sourceId: '180010', name: '冰镇西瓜', category: 'food', image: './assets/original/items/180010.png', emoji: '🍽️', price: 20, originalPrice: 20, localPrice: false, hunger: 20, thirst: 20, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '饱食+20，水分+20。' },
  { id: '180014', sourceId: '180014', name: '运动可乐', category: 'drink', image: './assets/original/items/180014.png', emoji: '🥛', price: 15, originalPrice: 15, localPrice: false, hunger: 0, thirst: 30, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '水分+30。' },
  { id: '180018', sourceId: '180018', name: '摩香汉堡', category: 'food', image: './assets/original/items/180018.png', emoji: '🍽️', price: 20, originalPrice: 20, localPrice: false, hunger: 40, thirst: 0, cleanliness: 0, happiness: 0, health: 0, minStage: 2, description: '饱食+40；中级及以上可用。' },
  { id: '180019', sourceId: '180019', name: '水晶蛋糕', category: 'food', image: './assets/original/items/180019.png', emoji: '🍽️', price: 40, originalPrice: 40, localPrice: false, hunger: 80, thirst: 0, cleanliness: 0, happiness: 0, health: 0, minStage: 3, description: '饱食+80；高级及以上可用。' },
  { id: '180020', sourceId: '180020', name: '火腿三明治', category: 'food', image: './assets/original/items/180020.png', emoji: '🍽️', price: 30, originalPrice: 30, localPrice: false, hunger: 60, thirst: 0, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '饱食+60。' },
  { id: '180021', sourceId: '180021', name: '兔兔胡萝卜汁', category: 'drink', image: './assets/original/items/180021.png', emoji: '🥛', price: 30, originalPrice: 30, localPrice: false, hunger: 0, thirst: 60, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '水分+60。' },
  { id: '180022', sourceId: '180022', name: '清爽沐浴露', category: 'clean', image: './assets/original/items/180022.png', emoji: '🛁', price: 30, originalPrice: 30, localPrice: false, hunger: 0, thirst: 0, cleanliness: 60, happiness: 0, health: 0, minStage: 0, description: '清洁+60。' },
  { id: '180024', sourceId: '180024', name: '喜刷刷牙膏', category: 'clean', image: './assets/original/items/180024.png', emoji: '🛁', price: 15, originalPrice: 15, localPrice: false, hunger: 0, thirst: 0, cleanliness: 30, happiness: 0, health: 0, minStage: 0, description: '清洁+30。' },
  { id: '180025', sourceId: '180025', name: '跳跳布丁', category: 'food', image: './assets/original/items/180025.png', emoji: '🍽️', price: 20, originalPrice: 0, localPrice: true, hunger: 20, thirst: 20, cleanliness: 0, happiness: 20, health: 0, minStage: 0, description: '饱食+20，水分+20，心情+20；活动道具，商店价格为桌宠设定。' },
  { id: '180028', sourceId: '180028', name: '咕咕果', category: 'drink', image: './assets/original/items/180028.png', emoji: '🥛', price: 25, originalPrice: 0, localPrice: true, hunger: 0, thirst: 50, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '水分+50；活动道具，商店价格为桌宠设定。' },
  { id: '180029', sourceId: '180029', name: '爽爽果', category: 'clean', image: './assets/original/items/180029.png', emoji: '🛁', price: 25, originalPrice: 0, localPrice: true, hunger: 0, thirst: 0, cleanliness: 50, happiness: 0, health: 0, minStage: 0, description: '清洁+50；活动道具，商店价格为桌宠设定。' },
  { id: '180030', sourceId: '180030', name: '开心果', category: 'food', image: './assets/original/items/180030.png', emoji: '🍽️', price: 25, originalPrice: 0, localPrice: true, hunger: 0, thirst: 0, cleanliness: 0, happiness: 50, health: 0, minStage: 0, description: '心情+50；活动道具，商店价格为桌宠设定。' },
  { id: '180043', sourceId: '180043', name: '苹果派', category: 'food', image: './assets/original/items/180043.png', emoji: '🍽️', price: 45, originalPrice: 0, localPrice: true, hunger: 35, thirst: 35, cleanliness: 0, happiness: 35, health: 0, minStage: 0, description: '饱食+35，水分+35，心情+35；活动道具，商店价格为桌宠设定。' },
  { id: '180044', sourceId: '180044', name: '草莓派', category: 'food', image: './assets/original/items/180044.png', emoji: '🍽️', price: 55, originalPrice: 0, localPrice: true, hunger: 45, thirst: 45, cleanliness: 0, happiness: 45, health: 0, minStage: 0, description: '饱食+45，水分+45，心情+45；活动道具，商店价格为桌宠设定。' },
  { id: '180045', sourceId: '180045', name: '拉姆小馒头', category: 'food', image: './assets/original/items/180045.png', emoji: '🍽️', price: 30, originalPrice: 0, localPrice: true, hunger: 25, thirst: 25, cleanliness: 0, happiness: 25, health: 0, minStage: 0, description: '饱食+25，水分+25，心情+25；活动道具，商店价格为桌宠设定。' },
  { id: '180047', sourceId: '180047', name: '热狗', category: 'food', image: './assets/original/items/180047.png', emoji: '🍽️', price: 40, originalPrice: 40, localPrice: false, hunger: 50, thirst: 0, cleanliness: 0, happiness: 0, health: 0, minStage: 0, description: '饱食+50。' },
  { id: '180070', sourceId: '180070', name: '云朵面包', category: 'food', image: './assets/original/items/180070.png', emoji: '🍽️', price: 35, originalPrice: 0, localPrice: true, hunger: 30, thirst: 30, cleanliness: 0, happiness: 30, health: 0, minStage: 0, description: '饱食+30，水分+30，心情+30；活动道具，商店价格为桌宠设定。' },
  { id: '180071', sourceId: '180071', name: '拉姆能量星', category: 'food', image: './assets/original/items/180071.png', emoji: '🍽️', price: 45, originalPrice: 0, localPrice: true, hunger: 30, thirst: 30, cleanliness: 30, happiness: 30, health: 0, minStage: 0, description: '饱食+30，水分+30，清洁+30，心情+30；活动道具，商店价格为桌宠设定。' },
  { id: '180073', sourceId: '180073', name: '优质牛奶', category: 'drink', image: './assets/original/items/180073.png', emoji: '🥛', price: 60, originalPrice: 0, localPrice: true, hunger: 50, thirst: 50, cleanliness: 0, happiness: 50, health: 0, minStage: 0, description: '饱食+50，水分+50，心情+50；活动道具，商店价格为桌宠设定。' },
];

// Original petfood.xml has Tool=2 colour-changing items. These four bottled
// variants and their bean price are this desktop adaptation, not official IDs.
export const COLOR_POTIONS = ([['red','红色'],['yellow','黄色'],['blue','蓝色'],['pink','粉色']] as const).map(([color,name]): PetItem => ({
  id:`recolor-${color}`,sourceId:`recolor-${color}`,name:`${name}换色药水`,category:'medicine',
  image:`./assets/generated/recolor-${color}.png`,emoji:'🧪',price:80,originalPrice:0,localPrice:true,
  hunger:0,thirst:0,cleanliness:0,happiness:0,health:0,minStage:0,changesColor:color,
  description:`变为${name}，保留阶段、物品和回忆。`,
}));
ITEMS.push(...COLOR_POTIONS);

/** Accept a source numeric ID at API boundaries, return the stable save ID. */
export function getItem(id: string | undefined): PetItem | undefined {
  return ITEMS.find(item => item.id === id || item.sourceId === id);
}

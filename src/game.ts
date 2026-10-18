export type PetColor = 'pink' | 'yellow' | 'blue' | 'red';
export type Stage = 0 | 1 | 2 | 3;
export type Action = 'pet' | 'feed' | 'wash' | 'play' | 'sleep';

export interface PetStats {
  hunger: number;
  happiness: number;
  cleanliness: number;
  energy: number;
}

export interface GameState {
  version: 1;
  name: string;
  color: PetColor;
  createdAt: number;
  lastTick: number;
  growth: number;
  coins: number;
  stats: PetStats;
  inventory: Record<string, number>;
  sleeping: boolean;
  completedGames: number;
  lastRewardAt: number;
}

export interface CareResult {
  state: GameState;
  message: string;
  ok: boolean;
}

export interface Food {
  id: string;
  name: string;
  emoji: string;
  price: number;
  hunger: number;
  happiness: number;
  description: string;
}

export const COLORS: { id: PetColor; name: string; hex: string; light: string }[] = [
  { id: 'pink', name: '粉色', hex: '#ff6bff', light: '#ffe1ff' },
  { id: 'yellow', name: '黄色', hex: '#ffea00', light: '#fff9ba' },
  { id: 'blue', name: '蓝色', hex: '#28c6ff', light: '#d4f4ff' },
  { id: 'red', name: '红色', hex: '#ff3805', light: '#ffded3' },
];

export const FOODS: Food[] = [
  { id: 'berry', name: '可可果', emoji: '🍎', price: 8, hunger: 16, happiness: 4, description: '拉姆喜欢的可可果，给小肚子补充能量。' },
  { id: 'biscuit', name: '熊熊饼干', emoji: '🍪', price: 12, hunger: 26, happiness: 5, description: '香香脆脆的小点心，是午后的小确幸。' },
  { id: 'juice', name: '浆果果汁', emoji: '🧃', price: 15, hunger: 18, happiness: 12, description: '清爽的浆果果汁，喝一口心情也亮起来。' },
];

// Timings are simplified for this desktop companion. Super Ram is not a growth stage.
export const STAGES = [
  { name: '种子期', description: '待在花盆里的种子，身体轻轻摆动。', threshold: 0 },
  { name: '初级拉姆', description: '离开花盆，无叶的初级拉姆。', threshold: 60 },
  { name: '中级拉姆', description: '长出两片嫩叶的中级拉姆。', threshold: 180 },
  { name: '高级拉姆', description: '扇形叶片展开的高级拉姆。', threshold: 420 },
] as const;

export const GROWTH_MAX = STAGES[3].threshold;
export const GAME_REWARD_COOLDOWN_MS = 10_000;
const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000;
const MAX_INVENTORY = 9_999;
const MAX_COINS = 1_000_000_000;

const clamp = (value: number, max = 100): number => Math.min(max, Math.max(0, value));
const rounded = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;
const grow = (growth: number, amount: number): number => rounded(clamp(growth + amount, GROWTH_MAX));

export function createPet(name: string, color: PetColor, now = Date.now()): GameState {
  const safeName = Array.from(name.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 16).join('') || '小拉姆';
  return {
    version: 1,
    name: safeName,
    color,
    createdAt: now,
    lastTick: now,
    growth: 0,
    coins: 100,
    stats: { hunger: 82, happiness: 78, cleanliness: 88, energy: 85 },
    inventory: { berry: 5, biscuit: 3, juice: 2 },
    sleeping: false,
    completedGames: 0,
    lastRewardAt: 0,
  };
}

export function getStage(growth: number): Stage {
  if (growth >= STAGES[3].threshold) return 3;
  if (growth >= STAGES[2].threshold) return 2;
  if (growth >= STAGES[1].threshold) return 1;
  return 0;
}

export function getNextStage(growth: number): (typeof STAGES)[number] | null {
  const stage = getStage(growth);
  return stage === 3 ? null : STAGES[stage + 1];
}

/** Apply up to one day of elapsed time. Repeated ticks at the same instant are inert. */
export function tick(state: GameState, now = Date.now()): GameState {
  if (!Number.isFinite(now) || now <= state.lastTick) return state;
  const hours = Math.min(now - state.lastTick, OFFLINE_CAP_MS) / 3_600_000;
  const rates = state.sleeping
    ? { hunger: 3, happiness: 1, cleanliness: 1.5, energy: -22 }
    : { hunger: 5, happiness: 3, cleanliness: 3.5, energy: 4 };

  // Count only the part of the interval before a need drops below its healthy limit.
  // This gives credit for the healthy part of an absence, without growing indefinitely.
  const healthyHours = state.sleeping ? 0 : Math.max(0, Math.min(
    hours,
    (state.stats.hunger - 35) / rates.hunger,
    (state.stats.happiness - 35) / rates.happiness,
    (state.stats.cleanliness - 30) / rates.cleanliness,
    (state.stats.energy - 25) / rates.energy,
  ));

  return {
    ...state,
    lastTick: now,
    growth: grow(state.growth, healthyHours * 18),
    stats: {
      hunger: rounded(clamp(state.stats.hunger - hours * rates.hunger)),
      happiness: rounded(clamp(state.stats.happiness - hours * rates.happiness)),
      cleanliness: rounded(clamp(state.stats.cleanliness - hours * rates.cleanliness)),
      energy: rounded(clamp(state.stats.energy - hours * rates.energy)),
    },
  };
}

export function care(state: GameState, action: Action, foodId?: string, now = Date.now()): CareResult {
  const current = tick(state, now);
  if (action === 'sleep') {
    return {
      state: { ...current, sleeping: !current.sleeping },
      message: current.sleeping ? `${current.name}醒来啦，今天也想和你在一起！` : '晚安呀，睡一会儿就能恢复精力。',
      ok: true,
    };
  }
  if (current.sleeping) return { state: current, message: '小拉姆正在休息，先轻轻叫醒它吧。', ok: false };
  const stats = { ...current.stats };

  if (action === 'feed') {
    const food = FOODS.find((item) => item.id === foodId);
    if (!food) return { state: current, message: '先挑选一份食物吧。', ok: false };
    if (!current.inventory[food.id]) return { state: current, message: `${food.name}吃完啦，去小铺补充一些吧。`, ok: false };
    if (stats.hunger >= 95) return { state: current, message: '肚子饱饱的，留着等会儿再吃吧。', ok: false };
    stats.hunger = clamp(stats.hunger + food.hunger);
    stats.happiness = clamp(stats.happiness + food.happiness);
    return {
      state: { ...current, stats, growth: grow(current.growth, 4), inventory: { ...current.inventory, [food.id]: current.inventory[food.id] - 1 } },
      message: `啊呜！${food.name}真好吃，谢谢你。`,
      ok: true,
    };
  }

  if (action === 'pet') {
    stats.happiness = clamp(stats.happiness + 6);
    return { state: { ...current, stats, growth: grow(current.growth, 1) }, message: '咕噜咕噜～最喜欢你摸摸我啦！', ok: true };
  }
  if (action === 'wash') {
    if (stats.cleanliness >= 98) return { state: current, message: '已经洗得香喷喷啦，来抱一下吧。', ok: false };
    stats.cleanliness = clamp(stats.cleanliness + 35);
    stats.happiness = clamp(stats.happiness + 4);
    stats.energy = clamp(stats.energy - 3);
    return { state: { ...current, stats, growth: grow(current.growth, 3) }, message: '泡泡飞呀飞，洗完澡又是干净的小拉姆！', ok: true };
  }
  if (stats.energy < 12) return { state: current, message: '有一点困啦，睡一会儿再玩好不好？', ok: false };
  stats.happiness = clamp(stats.happiness + 16);
  stats.energy = clamp(stats.energy - 12);
  stats.hunger = clamp(stats.hunger - 5);
  return { state: { ...current, stats, growth: grow(current.growth, 3) }, message: '蹦蹦跳跳！和你一起玩最开心。', ok: true };
}

export function buyFood(state: GameState, foodId: string): CareResult {
  const food = FOODS.find((item) => item.id === foodId);
  if (!food) return { state, message: '小铺里暂时没有这种食物。', ok: false };
  if (state.coins < food.price) return { state, message: '摩尔豆不够啦，玩一局小游戏赚一些吧。', ok: false };
  const count = state.inventory[food.id] ?? 0;
  if (count >= MAX_INVENTORY) return { state, message: '这种食物已经装满背包啦。', ok: false };
  return {
    state: { ...state, coins: state.coins - food.price, inventory: { ...state.inventory, [food.id]: count + 1 } },
    message: `收好啦，${food.name} × 1！`,
    ok: true,
  };
}

export function rewardGame(state: GameState, score: number, now = Date.now()): CareResult {
  const current = tick(state, now);
  if (current.sleeping) return { state: current, message: '小拉姆正在睡觉，醒来再一起玩吧。', ok: false };
  if (current.completedGames > 0 && now - current.lastRewardAt < GAME_REWARD_COOLDOWN_MS) {
    return { state: current, message: '这份奖励已经领过啦，休息一下再开始新的一局。', ok: false };
  }
  const safeScore = Number.isFinite(score) ? Math.floor(clamp(score, 10)) : 0;
  const coins = Math.min(4 + safeScore * 2, MAX_COINS - current.coins);
  const food = FOODS[safeScore >= 8 ? 2 : safeScore >= 5 ? 1 : 0];
  const count = current.inventory[food.id] ?? 0;
  const foodReward = count < MAX_INVENTORY;
  return {
    state: {
      ...current,
      coins: clamp(current.coins + coins, MAX_COINS),
      growth: grow(current.growth, 3 + safeScore),
      stats: {
        ...current.stats,
        happiness: clamp(current.stats.happiness + 8 + safeScore),
        hunger: clamp(current.stats.hunger - 4),
        energy: clamp(current.stats.energy - 8),
      },
      inventory: foodReward ? { ...current.inventory, [food.id]: count + 1 } : { ...current.inventory },
      completedGames: Math.min(current.completedGames + 1, MAX_COINS),
      lastRewardAt: now,
    },
    message: `本局获得 ${safeScore} 分！收获 ${coins} 摩尔豆${foodReward ? `和${food.name} × 1` : '，食物背包已满'}。`,
    ok: true,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isIntegerIn = (value: unknown, min: number, max: number): value is number =>
  isNumberIn(value, min, max) && Number.isInteger(value);

/** Validate untrusted local storage, normalize known fields, then apply offline time. */
export function parseSave(raw: string | null, now = Date.now()): GameState | null {
  if (!raw || raw.length > 50_000 || !Number.isFinite(now) || now < 0) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1) return null;
    if (typeof value.name !== 'string' || !value.name.trim() || Array.from(value.name).length > 16 || /[\u0000-\u001f\u007f]/.test(value.name)) return null;
    if (!COLORS.some((color) => color.id === value.color)) return null;
    if (!isIntegerIn(value.createdAt, 0, now + 300_000) || !isIntegerIn(value.lastTick, value.createdAt, now + 300_000)) return null;
    if (!isNumberIn(value.growth, 0, GROWTH_MAX) || !isIntegerIn(value.coins, 0, MAX_COINS)) return null;
    if (typeof value.sleeping !== 'boolean' || !isIntegerIn(value.completedGames, 0, MAX_COINS)) return null;
    if (!isIntegerIn(value.lastRewardAt, 0, value.lastTick)) return null;
    if (!isRecord(value.stats) || !isRecord(value.inventory)) return null;
    const { hunger, happiness, cleanliness, energy } = value.stats;
    if (!isNumberIn(hunger, 0, 100) || !isNumberIn(happiness, 0, 100) || !isNumberIn(cleanliness, 0, 100) || !isNumberIn(energy, 0, 100)) return null;
    const inventory: Record<string, number> = {};
    for (const [id, count] of Object.entries(value.inventory)) {
      if (!FOODS.some((food) => food.id === id) || !isIntegerIn(count, 0, MAX_INVENTORY)) return null;
      inventory[id] = count;
    }
    for (const food of FOODS) inventory[food.id] ??= 0;
    return tick({
      version: 1,
      name: value.name.trim(),
      color: value.color as PetColor,
      createdAt: value.createdAt,
      lastTick: value.lastTick,
      growth: value.growth,
      coins: value.coins,
      stats: { hunger, happiness, cleanliness, energy },
      inventory,
      sleeping: value.sleeping,
      completedGames: value.completedGames,
      lastRewardAt: value.lastRewardAt,
    }, now);
  } catch {
    return null;
  }
}

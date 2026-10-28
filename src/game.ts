import { ITEMS, getItem } from './catalog';
import {normalizeWardrobe} from './wardrobe';
import {reconcileCourseRewards} from './course-rewards';
import type {OutfitId} from './wardrobe';
import type { PetItem } from './catalog';
import {normalizeCheckIn} from './daily-check-in';
import type {DailyCheckIn} from './daily-check-in';
import {normalizeOuting} from './pet-pastimes';
import type {PetOuting} from './pet-pastimes';
import {normalizeEducation,normalizeActivity,settleActivity,cancelActivity} from './pet-school';
import type {Education,PetActivity} from './pet-school';
import {normalizeRoom} from './room-furnishings';
import {NEED_RATES,HEALTH_RECOVERY_PER_HOUR,HEALTH_LOSS_PER_HOUR} from './pet-status';
import type {RoomFurnishings} from './room-furnishings';
export { ITEMS, getItem, CATEGORY_LABELS } from './catalog';
export type { PetItem, ItemCategory } from './catalog';

import {isPetColor,petColorName,customPotionColor,MAX_CUSTOM_POTION_COLORS} from './pet-color';
import type {PetColor} from './pet-color';
export type {PetColor} from './pet-color';
export type Stage = 0 | 1 | 2 | 3 | 4;
export type GrowthMode = 'auto' | 'fixed';
export interface GrowthSelection {mode:GrowthMode;stage:Stage;evolution?:Evolution}
export type Evolution = 'super' | 'water' | 'wood' | 'fire' | 'classic';
export const EVOLUTIONS: { id: Evolution; name: string; description: string }[] = [
  { id: 'classic', name: '经典超级拉姆', description: '三片金色叶子的经典超级拉姆。' },
  { id: 'super', name: '神力超级拉姆', description: '金色神力头冠，神力超级形态。' },
  { id: 'water', name: '神奇水系拉姆', description: '展开晶莹的水花头冠。' },
  { id: 'wood', name: '弹力木系拉姆', description: '戴着翠绿的木系头冠。' },
  { id: 'fire', name: '霹雳火系拉姆', description: '顶着明亮的火焰头冠。' },
];
export type Action = 'pet' | 'feed' | 'drink' | 'wash' | 'use' | 'play' | 'sleep';

export interface PetStats {
  hunger: number;
  thirst: number;
  happiness: number;
  cleanliness: number;
  health: number;
  energy: number;
}

export interface GameState {
  version: 1;
  name: string;
  color: PetColor;
  createdAt: number;
  lastTick: number;
  growth: number;
  /** Set only by an explicit stage choice in settings. */
  growthLocked?: boolean;
  evolution?: Evolution;
  coins: number;
  wardrobe?: OutfitId[];
  wearing?: OutfitId;
  stats: PetStats;
  inventory: Record<string, number>;
  sleeping: boolean;
  /** Short grace period after the user wakes a tired pet; persisted across reloads. */
  awakeUntil?: number;
  sleepUntil?: number;
  completedGames: number;
  lastRewardAt: number;
  checkIn?: DailyCheckIn;
  outing?: PetOuting;
  lastOutingAt?: number;
  education?: Education;
  activity?: PetActivity;
  room?: RoomFurnishings;
}

export interface CareResult {
  state: GameState;
  message: string;
  ok: boolean;
}

/** Kept for old imports; shop items now carry all five original care effects. */
export type Food = PetItem;

export const COLORS: { id: PetColor; name: string; hex: string; light: string }[] = [
  { id: 'pink', name: '粉色', hex: '#ff6bff', light: '#ffe1ff' },
  { id: 'yellow', name: '黄色', hex: '#ffea00', light: '#fff9ba' },
  { id: 'blue', name: '蓝色', hex: '#28c6ff', light: '#d4f4ff' },
  { id: 'red', name: '红色', hex: '#ff3805', light: '#ffded3' },
];

/** Compatibility export for older callers; rewards use the full usable pool. */
export const FOODS: Food[] = ['berry', 'biscuit', 'juice'].map(id => getItem(id)!);

// Desktop adaptation: growth is earned by healthy elapsed time, never by clicks.
// These durations are a playable slow pace, not a claim about original server timers.
export const GROWTH_STAGE_HOURS = [24, 72, 168, 168] as const;
export const STAGES = [
  { name: '种子期', description: '待在花盆里的种子，身体轻轻摆动。', threshold: 0 },
  { name: '初级拉姆', description: '离开花盆，无叶的初级拉姆。', threshold: 60 },
  { name: '中级拉姆', description: '长出两片嫩叶的中级拉姆。', threshold: 180 },
  { name: '高级拉姆', description: '扇形叶片展开的高级拉姆。', threshold: 420 },
  { name: '神力拉姆', description: '五种原版神力形态，选择自己的成长方向。', threshold: 840 },
] as const;

export const GROWTH_MAX = STAGES[4].threshold;
export const GAME_REWARD_COOLDOWN_MS = 10_000;
const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000;
export const REST_ENERGY = 20;
export const WAKE_ENERGY = 85;
export const WAKE_GRACE_MS = 15 * 60 * 1000;
const MAX_INVENTORY = 9_999;
const MAX_COINS = 1_000_000_000;

const clamp = (value: number, max = 100): number => Math.min(max, Math.max(0, value));
const rounded = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;
const grow = (growth: number, amount: number): number => clamp(growth + amount, GROWTH_MAX);

/** Integrate across stage boundaries, so one long tick equals many short ticks. */
function growForHours(growth: number, hours: number): number {
  let result = growth, remaining = hours;
  while (remaining > 0 && result < GROWTH_MAX) {
    const stage = Math.min(3, getStage(result)) as 0|1|2|3;
    const next = STAGES[stage + 1].threshold;
    const rate = (next - STAGES[stage].threshold) / GROWTH_STAGE_HOURS[stage];
    const spent = Math.min(remaining, (next - result) / rate);
    result = grow(result, spent * rate);
    if (next - result < 0.0000001) result = next;
    remaining -= spent;
  }
  return result;
}

export function createPet(name: string, color: PetColor, now = Date.now()): GameState {
  if (!COLORS.some(entry => entry.id === color)) throw new RangeError('拉姆只有粉、黄、蓝、红四种基础颜色。');
  const safeName = Array.from(name.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, 16).join('') || '小拉姆';
  return {
    version: 1,
    name: safeName,
    color,
    createdAt: now,
    lastTick: now,
    growth: 0,
    coins: 100,
    stats: { hunger: 82, thirst: 82, happiness: 78, cleanliness: 88, health: 100, energy: 85 },
    inventory: Object.fromEntries(ITEMS.map(item => [item.id, 0])),
    sleeping: false,
    completedGames: 0,
    lastRewardAt: 0,
  };
}

export function getStage(growth: number, evolution?: Evolution): Stage {
  if (growth >= STAGES[4].threshold && EVOLUTIONS.some(form => form.id === evolution)) return 4;
  if (growth >= STAGES[3].threshold) return 3;
  if (growth >= STAGES[2].threshold) return 2;
  if (growth >= STAGES[1].threshold) return 1;
  return 0;
}

export function getNextStage(growth: number): (typeof STAGES)[number] | null {
  const stage = getStage(growth);
  return growth >= GROWTH_MAX ? null : STAGES[stage + 1];
}

function validStageChoice(stage:Stage,evolution?:Evolution){
  return Number.isInteger(stage)&&stage>=0&&stage<=4&&(evolution===undefined||EVOLUTIONS.some(form=>form.id===evolution));
}

/** Deliberate local stage selection, separate from the slow natural growth clock. */
export function changePetStage(state: GameState, stage: Stage, evolution?: Evolution, now = Date.now()): CareResult {
  if (!validStageChoice(stage,evolution)) {
    return { state, ok: false, message: '请选择一个拉姆阶段。' };
  }
  const form = stage === 4 ? evolution ?? state.evolution ?? 'super' : undefined;
  if (state.growthLocked && getStage(state.growth, state.evolution) === stage && state.evolution === form) {
    return { state, ok: true, message: `现在就是${STAGES[stage].name}啦。` };
  }
  const next = { ...state, growth: getStage(state.growth,state.evolution)===stage && state.evolution===form ? state.growth : STAGES[stage].threshold, growthLocked: true, lastTick: Math.max(now,state.lastTick) };
  if (form) next.evolution = form; else delete next.evolution;
  return { state: next, ok: true, message: `已经切换为${form ? EVOLUTIONS.find(v => v.id === form)!.name : STAGES[stage].name}。` };
}

export function evolvePet(state: GameState, evolution: Evolution, now = Date.now()): CareResult {
  const current = tick(state, now);
  const form = EVOLUTIONS.find(form => form.id === evolution);
  if(current.growthLocked)return {state:current,ok:false,message:'当前形态已在设置中固定，请在设置里选择神力形态。'};
  if (!form || current.evolution || current.growth < GROWTH_MAX) return { state: current, ok: false, message: '继续健康成长，等高级阶段的陪伴进度积满后再选择进化吧。' };
  if (current.sleeping) return { state: current, ok: false, message: '先轻轻叫醒拉姆，再一起选择成长的方向。' };
  return { state: { ...current, evolution }, ok: true, message: `${current.name}进化成了${form.name}！身体仍是最初领养时的颜色。` };
}

/** Settle elapsed time under the OLD mode before changing it. A mode-only
 * switch never resets growth; choosing another stage starts at its threshold. */
export function configureGrowth(state:GameState,selection:GrowthSelection,now=Date.now()):CareResult{
  if(!selection||!['auto','fixed'].includes(selection.mode)||!validStageChoice(selection.stage,selection.evolution)||!Number.isFinite(now))return {state,ok:false,message:'请选择有效的成长设置。'};
  const current=tick(state,Math.max(now,state.lastTick));
  const sameAppearance=selection.stage===getStage(state.growth,state.evolution)&&(selection.stage!==4||(selection.evolution??state.evolution)===state.evolution);
  // Crossing a natural stage boundary while the confirmation is open must
  // not turn a mode-only switch into a rollback to the previous threshold.
  const targetStage=sameAppearance?getStage(current.growth,current.evolution):selection.stage;
  const changed=changePetStage(current,targetStage,sameAppearance?current.evolution:selection.evolution,current.lastTick);
  if(!changed.ok)return changed;
  const next={...changed.state,growthLocked:selection.mode==='fixed'};
  const label=next.evolution?EVOLUTIONS.find(form=>form.id===next.evolution)!.name:STAGES[getStage(next.growth,next.evolution)].name;
  return {state:next,ok:true,message:selection.mode==='auto'?`已从${label}继续自动成长，进度会保存。`:`已固定为${label}，成长进度已保留。`};
}

/** Integrate one continuous awake/asleep span; transitions are handled by tick. */
function advanceStats(state: GameState, now: number): GameState {
  const hours = Math.min(now - state.lastTick, OFFLINE_CAP_MS) / 3_600_000;
  const rates = state.sleeping ? NEED_RATES.asleep : NEED_RATES.awake;

  // Count only the part of the interval before a need drops below its healthy limit.
  // This gives credit for the healthy part of an absence, without growing indefinitely.
  const healthyHours = state.sleeping ? 0 : Math.max(0, Math.min(
    hours,
    (state.stats.hunger - 35) / rates.hunger,
    (state.stats.thirst - 35) / rates.thirst,
    (state.stats.happiness - 35) / rates.happiness,
    (state.stats.cleanliness - 30) / rates.cleanliness,
    (state.stats.energy - 25) / rates.energy,
  ));

  // Original needs include health. This companion has no death: neglect lowers it
  // to one, and sustained care or the original universal medicine restores it.
  // Split the interval at the first critical need so long and short ticks agree.
  const caredHours = Math.max(0, Math.min(hours,
    (state.stats.hunger - 20) / rates.hunger,
    (state.stats.thirst - 20) / rates.thirst,
    (state.stats.cleanliness - 20) / rates.cleanliness,
  ));
  const health = Math.max(1, clamp(state.stats.health + caredHours * HEALTH_RECOVERY_PER_HOUR) - (hours - caredHours) * HEALTH_LOSS_PER_HOUR);

  return {
    ...state,
    lastTick: now,
    growth: state.growthLocked ? state.growth : growForHours(state.growth, healthyHours),
    stats: {
      hunger: rounded(clamp(state.stats.hunger - hours * rates.hunger)),
      thirst: rounded(clamp(state.stats.thirst - hours * rates.thirst)),
      health: rounded(health),
      happiness: rounded(clamp(state.stats.happiness - hours * rates.happiness)),
      cleanliness: rounded(clamp(state.stats.cleanliness - hours * rates.cleanliness)),
      energy: rounded(clamp(state.stats.energy - hours * rates.energy)),
    },
  };
}

function settleRest(state: GameState, now: number): GameState {
  if(state.sleeping&&state.stats.energy>=WAKE_ENERGY&&now>=(state.sleepUntil??0))return {...state,sleeping:false};
  if(!state.sleeping&&state.stats.energy<=REST_ENERGY&&now>=(state.awakeUntil??0))return {...cancelActivity(state),sleeping:true};
  return state;
}

/** Automatic rest follows energy, independent of the user's one-shot focus timer.
 * Split elapsed time at sleep/wake boundaries so long absences and short ticks agree. */
export function tick(state: GameState, now = Date.now()): GameState {
  if(!Number.isFinite(now)||now<state.lastTick)return state;
  if(now===state.lastTick)return settleActivity(state,now);
  let cursor=now-Math.min(now-state.lastTick,OFFLINE_CAP_MS);
  let current=settleRest(settleActivity(cursor===state.lastTick?state:{...state,lastTick:cursor},cursor),cursor);
  while(cursor<now){
    const untilTransition=current.sleeping
      ? Math.max((WAKE_ENERGY-current.stats.energy)/-NEED_RATES.asleep.energy*3_600_000,(current.sleepUntil??0)-cursor)
      : Math.max((current.stats.energy-REST_ENERGY)/NEED_RATES.awake.energy*3_600_000,(current.awakeUntil??0)-cursor);
    // Reward at the actual deadline, before a later nap or stat decay. This
    // keeps a bulk offline tick equivalent to many ordinary timer ticks.
    const end=Math.min(now,cursor+Math.max(1,untilTransition),current.activity?.endsAt??Infinity);
    current=settleRest(settleActivity(advanceStats(current,end),end),end);cursor=end;
  }
  return current;
}

export function care(state: GameState, action: Action, foodId?: string, now = Date.now()): CareResult {
  const current = tick(state, now);
  if (action === 'sleep') {
    const waking=state.sleeping||current.sleeping;
    return {
      state: { ...cancelActivity(current), sleeping: !waking, ...(waking?{awakeUntil:now+WAKE_GRACE_MS,sleepUntil:0}:{sleepUntil:now+60_000}) },
      message: waking ? `${current.name}醒来啦，今天也想和你在一起！` : '晚安呀，睡一会儿就能恢复精力。',
      ok: true,
    };
  }
  if (current.sleeping) return { state: current, message: '小拉姆正在休息，先轻轻叫醒它吧。', ok: false };
  const stats = { ...current.stats };

  if (action === 'feed' || action === 'drink' || action === 'wash' || action === 'use') {
    const item = getItem(foodId);
    if (!item) return { state: current, message: action === 'wash' ? '先从背包挑选一份清洁用品，缺少时可以去商店购买。' : '先从背包挑选一份用品吧。', ok: false };
    // Old clients used feed/juice before the drink action existed.
    const rightCategory = action === 'use' || (action === 'feed' && (item.category === 'food' || item.id === 'juice'))
      || (action === 'drink' && item.category === 'drink') || (action === 'wash' && item.category === 'clean');
    if (!rightCategory) return { state: current, message: '这种用品需要在对应的照料分类里使用。', ok: false };
    if (getStage(current.growth) < item.minStage) return { state: current, message: `${item.name}要等到${STAGES[item.minStage].name}才能使用，先留在背包里吧。`, ok: false };
    if (!(current.inventory[item.id] > 0)) return { state: current, message: `${item.name}用完啦，去商店用摩尔豆补充一些吧。`, ok: false };
    if (item.changesColor) {
      if (current.color === item.changesColor) return {state:current,ok:false,message:'已经是这个颜色啦，药水先收好。'};
      return {state:{...current,color:item.changesColor,inventory:{...current.inventory,[item.id]:current.inventory[item.id]-1}},ok:true,message:`咕嘟～换成${petColorName(item.changesColor)}啦，还是陪着你的我。`};
    }
    const keys = ['hunger', 'thirst', 'cleanliness', 'happiness', 'health'] as const;
    if (!keys.some(key => item[key] > 0 && stats[key] < 100)) {
      const message = item.category === 'food' ? '肚子饱饱的，留着等会儿再吃吧。'
        : item.category === 'drink' ? '已经喝饱啦，饮品先留在背包里。'
          : item.category === 'clean' ? '已经洗得香喷喷啦，清洁用品先收好。' : '身体很健康，药水先留着吧。';
      return { state: current, message, ok: false };
    }
    for (const key of keys) stats[key] = clamp(stats[key] + item[key]);
    return {
      state: { ...current, stats, inventory: { ...current.inventory, [item.id]: current.inventory[item.id] - 1 } },
      message: item.category === 'clean' ? `${item.name}的泡泡香香的，洗干净啦！`
        : item.category === 'drink' ? `咕嘟咕嘟，${item.name}真解渴！`
          : item.category === 'medicine' ? '喝过药水，身体舒服多啦。谢谢你照顾我！' : `啊呜！${item.name}真好吃，谢谢你。`,
      ok: true,
    };
  }

  if (action === 'pet') {
    stats.happiness = clamp(stats.happiness + 6);
    return { state: { ...current, stats }, message: '咕噜咕噜～最喜欢你摸摸我啦！', ok: true };
  }
  if (stats.energy < 12) return { state: current, message: `玩球至少需要 12 点精力（当前 ${Math.floor(stats.energy*10)/10} 点），睡一会儿恢复后再玩吧。`, ok: false };
  stats.happiness = clamp(stats.happiness + 16);
  stats.energy = clamp(stats.energy - 12);
  stats.hunger = clamp(stats.hunger - 5);
  return { state: { ...current, stats }, message: '小球来啦，和你一起玩一会儿真开心。', ok: true };
}

export function buyItem(state: GameState, itemId: string): CareResult {
  const item = getItem(itemId);
  if (!item) return { state, message: '商店里暂时没有这种用品。', ok: false };
  if (customPotionColor(item.id)) return { state, message: '这种药水只能在拉姆换色游戏里自己调制。', ok: false };
  if (state.coins < item.price) return { state, message: '摩尔豆不够啦，玩一局小游戏赚一些吧。', ok: false };
  const count = state.inventory[item.id] ?? 0;
  if (count >= MAX_INVENTORY) return { state, message: '这种用品已经装满背包啦。', ok: false };
  return {
    state: { ...state, coins: state.coins - item.price, inventory: { ...state.inventory, [item.id]: count + 1 } },
    message: `收好啦，${item.name} × 1！`,
    ok: true,
  };
}

/** Backwards-compatible name; the shop now sells drinks and care supplies too. */
export const buyFood = buyItem;

export type PetConditionId = 'sleeping' | 'sick' | 'hungry' | 'thirsty' | 'dirty' | 'sad' | 'tired' | 'healthy';
export interface PetCondition { id: PetConditionId; label: string; action: string; description: string }

/** Need labels come from the original client; tired/sleep are desktop additions. */
export function getPetCondition(state: GameState): PetCondition {
  if (state.sleeping) return { id: 'sleeping', label: '睡梦中', action: 'sleep', description: '正在闭眼休息，点“叫醒”就可以继续互动。' };
  if (state.stats.health <= 35) return { id: 'sick', label: '生病了', action: 'sick', description: '健康较低，记得照料饮食和清洁；万能药水可以帮助恢复。' };
  if (state.stats.hunger < 30) return { id: 'hungry', label: '肚子饿了', action: 'hungry', description: '从背包挑一份食物，空背包可以去商店补充。' };
  if (state.stats.thirst < 30) return { id: 'thirsty', label: '口渴了', action: 'thirsty', description: '需要喝一点麦香牛奶、果汁或其他饮品。' };
  if (state.stats.cleanliness < 30) return { id: 'dirty', label: '需要清洁', action: 'dirty', description: '使用泡泡浴、洗面奶或沐浴露清洁一下吧。' };
  if (state.stats.happiness < 30) return { id: 'sad', label: '有点难过', action: 'sad', description: '摸摸它，或者一起玩一会儿。' };
  if (state.stats.energy < 25) return { id: 'tired', label: '有点困了', action: 'tired', description: '困了会自己闭眼休息，睡着后可以轻轻叫醒。' };
  return { id: 'healthy', label: '状态很好', action: 'idle', description: '吃得饱、喝得足，正在安心地陪伴你。' };
}

export function gameRewardItems(state:GameState):PetItem[]{
  const stage=getStage(state.growth,state.evolution);
  return ITEMS.filter(item=>['food','drink','clean'].includes(item.category)&&item.minStage<=stage);
}

export function rewardGame(state: GameState, score: number, now = Date.now(), random:()=>number=Math.random): CareResult & {rewardItem?:PetItem} {
  const current = tick(state, now);
  if (current.sleeping) return { state: current, message: '小拉姆正在睡觉，醒来再一起玩吧。', ok: false };
  if (current.completedGames > 0 && now - current.lastRewardAt < GAME_REWARD_COOLDOWN_MS) {
    return { state: current, message: '这份奖励已经领过啦，休息一下再开始新的一局。', ok: false };
  }
  const safeScore = Number.isFinite(score) ? Math.floor(clamp(score, 10)) : 0;
  const coins = Math.min(4 + safeScore * 2, MAX_COINS - current.coins);
  const pool=gameRewardItems(current).filter(item=>(current.inventory[item.id]??0)<MAX_INVENTORY);
  const roll=pool.length?random():0;
  const food=pool[Math.min(pool.length-1,Math.max(0,Math.floor((Number.isFinite(roll)?roll:0)*pool.length)))];
  return {
    state: {
      ...current,
      coins: clamp(current.coins + coins, MAX_COINS),
      stats: {
        ...current.stats,
        happiness: clamp(current.stats.happiness + 8 + safeScore),
        hunger: clamp(current.stats.hunger - 4),
        energy: clamp(current.stats.energy - 8),
      },
      inventory: food ? { ...current.inventory, [food.id]: (current.inventory[food.id]??0) + 1 } : { ...current.inventory },
      completedGames: Math.min(current.completedGames + 1, MAX_COINS),
      lastRewardAt: now,
    },
    rewardItem:food,
    message: `本局获得 ${safeScore} 分！收获 ${coins} 摩尔豆${food ? `和${food.name} × 1` : '，可用用品背包已满'}。`,
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
export function parseSave(raw: string | null, now = Date.now(), manualStageSelected = false): GameState | null {
  if (!raw || raw.length > 50_000 || !Number.isFinite(now) || now < 0) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1) return null;
    if (typeof value.name !== 'string' || !value.name.trim() || Array.from(value.name).length > 16 || /[\u0000-\u001f\u007f]/.test(value.name)) return null;
    if (!isPetColor(value.color)) return null;
    if (!isIntegerIn(value.createdAt, 0, now + 300_000) || !isIntegerIn(value.lastTick, value.createdAt, now + 300_000)) return null;
    if (!isNumberIn(value.growth, 0, GROWTH_MAX) || !isIntegerIn(value.coins, 0, MAX_COINS)) return null;
    if (value.growthLocked !== undefined && typeof value.growthLocked !== 'boolean') return null;
    if (value.evolution !== undefined && (!EVOLUTIONS.some(form => form.id === value.evolution) || value.growth < GROWTH_MAX)) return null;
    if (typeof value.sleeping !== 'boolean' || !isIntegerIn(value.completedGames, 0, MAX_COINS)) return null;
    if (!isIntegerIn(value.lastRewardAt, 0, value.lastTick)) return null;
    if (!isRecord(value.stats) || !isRecord(value.inventory)) return null;
    const { hunger, happiness, cleanliness, energy } = value.stats;
    // v0.4 saves have four stats. Add only new fields, preserving every old need,
    // inventory count, growth point and timestamp before normal offline ticking.
    const thirst = value.stats.thirst === undefined ? 82 : value.stats.thirst;
    const health = value.stats.health === undefined ? 100 : value.stats.health;
    if (!isNumberIn(hunger, 0, 100) || !isNumberIn(thirst, 0, 100) || !isNumberIn(health, 0, 100) || !isNumberIn(happiness, 0, 100) || !isNumberIn(cleanliness, 0, 100) || !isNumberIn(energy, 0, 100)) return null;
    const inventory: Record<string, number> = {};
    for (const [id, count] of Object.entries(value.inventory)) {
      const item = getItem(id);
      if (!item || !isIntegerIn(count, 0, MAX_INVENTORY) || Object.hasOwn(inventory, item.id)) return null;
      inventory[item.id] = count;
    }
    if(Object.keys(inventory).filter(id=>customPotionColor(id)).length>MAX_CUSTOM_POTION_COLORS)return null;
    for (const item of ITEMS) inventory[item.id] ??= 0;
    const importedOuting=value.growth>=STAGES[1].threshold?normalizeOuting(value.outing,now,value.createdAt):undefined;
    const education=normalizeEducation(value.education,now),room=normalizeRoom(value.room);
    const activity=value.growth>=STAGES[1].threshold&&!value.sleeping&&!importedOuting?normalizeActivity(value.activity,{createdAt:value.createdAt,education,growth:value.growth,evolution:value.evolution as Evolution|undefined},now):undefined;
    return tick(reconcileCourseRewards({
      version: 1,
      name: value.name.trim(),
      color: value.color as PetColor,
      createdAt: value.createdAt,
      lastTick: value.lastTick,
      growth: value.growth,
      ...(typeof value.growthLocked==='boolean'?{growthLocked:value.growthLocked}:manualStageSelected?{growthLocked:true}:{}),
      ...(value.evolution ? { evolution: value.evolution as Evolution } : {}),
      coins: value.coins,
      ...normalizeWardrobe(value.wardrobe,value.wearing),
      stats: { hunger, thirst, happiness, cleanliness, health, energy },
      inventory,
      sleeping: value.sleeping,
      ...(isIntegerIn(value.awakeUntil,0,now+WAKE_GRACE_MS)?{awakeUntil:value.awakeUntil}:{}),
      ...(isIntegerIn(value.sleepUntil,0,now+60_000)?{sleepUntil:value.sleepUntil}:{}),
      completedGames: value.completedGames,
      lastRewardAt: value.lastRewardAt,
      ...(normalizeCheckIn(value.checkIn,now)?{checkIn:normalizeCheckIn(value.checkIn,now)}:{}),
      ...(importedOuting?{outing:importedOuting}:{}),
      ...(education?{education}:{}),...(activity?{activity}:{}),...(room?{room}:{}),
      ...(isIntegerIn(value.lastOutingAt,value.createdAt,now+300000)?{lastOutingAt:value.lastOutingAt}:{}),
    }), now);
  } catch {
    return null;
  }
}

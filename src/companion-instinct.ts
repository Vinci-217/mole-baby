import { ITEMS } from './catalog';
import { companionFeeling } from './companion-feeling';
import { getStage } from './game';
import type { GameState } from './game';
import type { CompanionEvent, CompanionMemory } from './companion-memory';

export const HABIT_DAYS = 7;
export interface HabitActivity { id: string; name: string; count: number; lastAt: number }
export interface HabitItem extends HabitActivity { image: string }
export interface PetHabits { days: number; food: HabitItem | null; drink: HabitItem | null; play: HabitActivity | null }
const GAME_NAMES = ['拉姆接果子', '口袋翻翻乐', '拉姆拍拍乐', '节奏拍拍乐', '草地采果', '小屋拼拼乐', '小屋寻宝'];

function top<T extends HabitActivity>(entries: Map<string, T>): T | null {
  return [...entries.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt || a.id.localeCompare(b.id))[0] ?? null;
}
function increment<T extends HabitActivity>(entries: Map<string, T>, entry: T) {
  const previous = entries.get(entry.id);
  entries.set(entry.id, { ...entry, count: (previous?.count ?? 0) + 1, lastAt: Math.max(previous?.lastAt ?? 0, entry.lastAt) });
}
function careItem(event: CompanionEvent) {
  if (event.kind !== 'feed' && event.kind !== 'drink') return null;
  // These are the successful local care receipts, not an arbitrary item name
  // mentioned while shopping, chatting or planning to feed the pet later.
  const named = event.detail.match(/^你用(.+)照料了我。?$/)
    ?? event.detail.match(event.kind === 'feed' ? /^你给我喂了(.+?)。?$/ : /^你给我(?:倒了|喝了)(.+?)。?$/);
  if (!named) return null;
  return ITEMS.find(item => item.name === named[1] && item.category === (event.kind === 'feed' ? 'food' : 'drink')) ?? null;
}
function playActivity(event: CompanionEvent): { id: string; name: string } | null {
  if (event.kind === 'play') {
    if (/^你陪我在原地看了一会儿小蝴蝶。?$/.test(event.detail) || event.detail === '你回应我的小邀请，陪我在原地看了一会儿小蝴蝶。') return { id: 'butterfly', name: '看小蝴蝶' };
    if (/^我们一起玩了一会儿。?$/.test(event.detail) || event.detail === '你回应我的小邀请，我们一起玩了一会儿小球。') return { id: 'ball', name: '一起玩球' };
  }
  if (event.kind === 'pet' && (/^你轻轻摸了摸我。?$/.test(event.detail) || event.detail === '你答应我的小邀请，轻轻摸了摸我。')) return { id: 'pet', name: '轻轻摸摸' };
  if (event.kind === 'game') {
    const completed = event.detail.match(/^我们一起在[^《》]{1,40}完成了《([^《》]+)》，得到(?:10|[0-9])分，收获\d+摩尔豆。$/);
    if (completed && GAME_NAMES.includes(completed[1])) return { id: `game:${completed[1]}`, name: completed[1] };
  }
  return null;
}

/** A fresh view of the last seven days, never a second memory store. */
export function getPetHabits(memory: CompanionMemory, now = Date.now()): PetHabits {
  if (!Number.isFinite(now)) return { days: HABIT_DAYS, food: null, drink: null, play: null };
  const foods = new Map<string, HabitItem>(), drinks = new Map<string, HabitItem>(), plays = new Map<string, HabitActivity>();
  const seen = new Set<string>(), since = now - HABIT_DAYS * 86_400_000;
  for (const event of memory.events) {
    if (!Number.isFinite(event.at) || event.at > now || event.at < since || seen.has(event.id)) continue;
    seen.add(event.id);
    const item = careItem(event);
    if (item) increment(item.category === 'food' ? foods : drinks, { id: item.id, name: item.name, image: item.image, count: 1, lastAt: event.at });
    const activity = playActivity(event);
    if (activity) increment(plays, { ...activity, count: 1, lastAt: event.at });
  }
  return { days: HABIT_DAYS, food: top(foods), drink: top(drinks), play: top(plays) };
}

/** Pet-directed questions only. A user's own likes keep their existing reply. */
export function petHabitReply(pet: GameState, memory: CompanionMemory, text: string, now = Date.now()): string | null {
  if (memory.petId !== String(pet.createdAt) || /(?:我|主人)(?:最近|最|很|比较|特别)?(?:喜欢|爱)(?:吃|喝|玩)?/.test(text)) return null;
  const drink = /(?:你|拉姆).*(?:喜欢|爱|常|熟悉).*(?:喝|饮品|饮料)/.test(text);
  const recallCare = /你.*(?:记得|记不记得).*(?:喂过|喂了|给你吃)/.test(text) || /我.*(?:喂过?你|给你(?:吃|喂)).*(?:什么|哪些)/.test(text);
  const food = /(?:你|拉姆).*(?:喜欢|爱|常|熟悉).*(?:吃|食物|零食)/.test(text) || recallCare;
  const play = /(?:你|拉姆).*(?:喜欢|爱|常|熟悉).*(?:玩|游戏|活动|互动)/.test(text);
  if (!food && !drink && !play) return null;
  const habits = getPetHabits(memory, now);
  if (play) {
    const activity = habits.play;
    if (!activity) return '最近一起玩过什么，我还没有想起来呢。玩球、看小蝴蝶，你想先试哪一个？';
    const action = activity.id === 'ball' ? '玩球' : activity.id === 'butterfly' ? '看小蝴蝶' : `玩「${activity.name}」`;
    if (activity.id === 'pet') return `最近你${activity.count > 1 ? '常常' : ''}轻轻摸摸我，这件小事我记着呢。你愿意时，再摸摸我吧。`;
    return `最近我们${activity.count > 1 ? '常常' : '一起'}${action}，这件小事我记着呢。下次还想和你一起玩。`;
  }
  const item = drink ? habits.drink : habits.food ?? (recallCare ? habits.drink : null);
  if (!item) return drink ? '最近喝过什么，我还没想起来呢。先一起尝尝，熟悉的味道要慢慢发现。' : '最近吃过什么，我还没想起来呢。先一起尝尝，熟悉的味道要慢慢发现。';
  const verb = drink || (!habits.food && habits.drink) ? '喝' : '吃';
  return item.count > 1 ? `最近你常给我${verb}${item.name}，已经是熟悉的味道啦。我们也可以慢慢尝尝别的。` : `最近你给我${verb}过${item.name}，这份照料我记着呢。我们也可以慢慢尝尝别的。`;
}

/** A name call is an immediate local response, not a command to wake or feed. */
export function nameResponse(pet: GameState, memory: CompanionMemory, sequence = 0, now = Date.now()): { text: string; action: string } {
  const own = memory.petId === String(pet.createdAt);
  const nickname = own ? memory.facts.filter(fact => fact.kind === 'nickname' && fact.at <= now).sort((a, b) => b.at - a.at)[0]?.value : undefined;
  const address = nickname ? `${nickname}，` : '', name = pet.name;
  if (pet.sleeping) return { action: 'sleep', text: `${address}${name}听见啦，还想打个小盹。想玩时，可以轻轻叫醒我。` };
  if (pet.stats.health < 35) return { action: 'look-around', text: `${address}${name}听见啦，这会儿有点没精神。陪我安静待一会儿，好吗？` };
  if (pet.stats.energy < 25) return { action: 'look-around', text: `${address}${name}在这里，有点困，但听见你叫我啦。` };
  const latest = own ? memory.messages.filter(message => message.role === 'user' && message.at <= now && now - message.at < 2 * 3_600_000).at(-1)?.content : undefined;
  if (latest && companionFeeling(latest) === 'low') return { action: 'look-around', text: `${address}我在，${name}听见你啦。要我安静陪着也可以。` };
  const phase = Number.isFinite(sequence) ? Math.abs(Math.floor(sequence)) % 3 : 0;
  const personality = own ? memory.personality : '';
  const stage = getStage(pet.growth, pet.evolution);
  const stageLine = stage === 0 ? '小花盆在这儿，我也在这儿。' : stage === 1 ? '我回过神来啦，听你说。' : stage === 2 ? '两片小叶子也跟着高兴起来啦。' : '我在这里轻轻飘着，听你说。';
  const familiar = own ? getPetHabits(memory, now).play : null;
  const gentle = /慢热|安静/.test(personality), curious = /故事|好奇/.test(personality);
  const texts = [
    gentle ? `${address}嗯，${name}在这里。你慢慢说，我听着。` : curious ? `${address}${name}听见啦。今天有什么小发现想告诉我？` : `${address}到！${name}听见你叫我啦。`,
    `${address}叫到${name}啦！${stageLine}`,
    familiar && familiar.count > 1 ? `${address}${name}在呢。要不要再一起${familiar.id === 'pet' ? '摸摸' : familiar.id === 'ball' ? '玩球' : familiar.id === 'butterfly' ? '看小蝴蝶' : `玩「${familiar.name}」`}？` : `${address}${name}听见啦。想玩一会儿，还是让我陪你待着？`,
  ];
  return { action: 'look-around', text: texts[phase] };
}

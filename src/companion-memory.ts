import { COLORS } from './game';
import type { GameState } from './game';

export type ChatRole = 'user' | 'assistant';
export type FactKind = 'nickname' | 'like' | 'dislike' | 'plan' | 'story' | 'boundary';
export interface CompanionMessage { id: string; role: ChatRole; content: string; at: number }
export interface CompanionFact { id: string; kind: FactKind; value: string; at: number; status?: 'active' | 'done' }
export interface CompanionEvent { id: string; kind: string; detail: string; at: number }
export interface CompanionMemory {
  version: 1; petId: string; personality: string; facts: CompanionFact[];
  events: CompanionEvent[]; messages: CompanionMessage[];
}
export interface CompanionMood { id: 'sleepy' | 'unwell' | 'concerned' | 'cheerful' | 'peaceful' | 'downcast' | 'drowsy'; label: string; affection: number; relationship: string }
export interface DiaryDay { day: string; moments: string[]; count: number }

export const MEMORY_LIMITS = { facts: 64, events: 120, messages: 80, text: 1000 } as const;
export const FACT_LABELS: Record<FactKind, string> = { nickname: '称呼', like: '喜欢', dislike: '不喜欢', plan: '计划', story: '你的小事', boundary: '陪伴偏好' };
const PREFIX = 'ramu-companion-memory-v1:';
const personalities = ['喜欢留意小细节，语气轻快', '有点慢热，喜欢安静陪伴', '好奇又爱听故事', '活泼，但也会认真听人说话'];
const clean = (value: string, max: number = MEMORY_LIMITS.text) => Array.from(value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[已隐藏密钥]').trim()).slice(0, max).join('');
const stamp = (now: number) => Number.isFinite(now) && now >= 0 && now <= 8_640_000_000_000_000 ? now : Date.now();
const uid = (kind: string, value: string, at: number) => `${kind}:${at}:${value.slice(0, 32)}`;
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8_640_000_000_000_000;
export const memoryKey = (pet: Pick<GameState, 'createdAt'>) => `${PREFIX}${pet.createdAt}`;
const dayKey = (at: number) => { const date = new Date(at); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

/** Stable temperament belongs to this pet. It can be edited, never inferred from the model. */
export function createMemory(pet: GameState): CompanionMemory {
  const seed = Math.abs(Math.floor(pet.createdAt / 1000)) + Math.max(0, COLORS.findIndex(c => c.id === pet.color));
  return { version: 1, petId: String(pet.createdAt), personality: personalities[seed % personalities.length], facts: [], events: [], messages: [] };
}

/** v1 remains compatible; old memories gain the richer features without fabricated facts. */
export function parseMemory(raw: unknown, pet: GameState): CompanionMemory {
  const fallback = createMemory(pet);
  try {
    const source = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!source || typeof source !== 'object' || source.version !== 1 || source.petId !== fallback.petId) return fallback;
    const arr = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : [];
    const facts: CompanionFact[] = arr(source.facts).filter(v => v.kind==='boundary').filter(v => validTime(v.at) && Object.hasOwn(FACT_LABELS, String(v.kind)) && typeof v.value === 'string').slice(-MEMORY_LIMITS.facts).map(v => {
      const kind = v.kind as FactKind, value = clean(String(v.value), 160), at = v.at as number;
      return { id: uid(kind, value, at), kind, value, at, ...(kind === 'plan' && (v.status === 'active' || v.status === 'done') ? { status: v.status as 'active' | 'done' } : {}) };
    }).filter(v => v.value);
    const events: CompanionEvent[] = arr(source.events).filter(v => validTime(v.at) && typeof v.kind === 'string' && typeof v.detail === 'string').slice(-MEMORY_LIMITS.events).map(v => ({ id: uid(clean(String(v.kind), 30), clean(String(v.detail), 160), v.at as number), kind: clean(String(v.kind), 30), detail: clean(String(v.detail), 160), at: v.at as number })).filter(v => v.detail);
    // Conversation and API features are retired; never retain old transcripts.
    const messages: CompanionMessage[] = [];
    return { ...fallback, personality: typeof source.personality === 'string' ? clean(source.personality, 80) || fallback.personality : fallback.personality, facts, events, messages };
  } catch { return fallback; }
}
export function loadMemory(pet: GameState): CompanionMemory {
  try { return parseMemory(localStorage.getItem(memoryKey(pet)), pet); } catch { return createMemory(pet); }
}
export function saveMemory(pet: GameState, memory: CompanionMemory): boolean {
  try { localStorage.setItem(memoryKey(pet), JSON.stringify(parseMemory(memory, pet))); return true; } catch { return false; }
}
export function recordEvent(memory: CompanionMemory, event: { kind: string; detail: string; at?: number }): CompanionMemory {
  const at = stamp(event.at ?? Date.now()), kind = clean(event.kind, 30), detail = clean(event.detail, 160);
  if (!kind || !detail) return memory;
  // Keep a day's first completed pastime; repeated idle performances should
  // not push the owner's meals and shared experiences out of the diary.
  if(kind.startsWith('self-')&&memory.events.some(e=>e.kind===kind&&dayKey(e.at)===dayKey(at)))return memory;
  const previous = memory.events.at(-1);
  if (kind!=='focus-timer' && previous?.kind === kind && previous.detail === detail && at >= previous.at && at - previous.at < 60_000) return memory;
  const events=[...memory.events,{id:uid(kind,detail,at),kind,detail,at}];
  const automatic=events.filter(e=>/^(self-|outing-|check-in$)/.test(e.kind));
  const discarded=new Set(automatic.slice(0,Math.max(0,automatic.length-40)).map(e=>e.id));
  return {...memory,events:events.filter(e=>!discarded.has(e.id)).slice(-MEMORY_LIMITS.events)};
}
export function recordCare(memory: CompanionMemory, action: string, detail?: string, now = Date.now()): CompanionMemory {
  const labels: Record<string, string> = { pet: '你轻轻摸了摸我', feed: '你给我喂了食物', drink: '你给我倒了饮品', wash: '你帮我洗了澡', sleep: '你照顾了我的作息', play: '我们一起玩了一会儿', game: '我们一起完成了小游戏', buy: '你为我买了用品' };
  return recordEvent(memory, { kind: action, detail: detail || labels[action] || '我们一起度过了一会儿', at: now });
}

/** Summaries are derived from surviving records, so forgetting leaves no hidden summary. */
export function getDiary(memory: CompanionMemory): DiaryDay[] {
  const days = new Map<string, { moments: string[]; count: number }>();
  const entries = [...memory.events.map(e => ({ at: e.at, text: e.detail })), ...memory.facts.filter(f => f.kind === 'story').map(f => ({ at: f.at, text: `你说：${f.value}` }))].sort((a, b) => a.at - b.at);
  for (const entry of entries) {
    const key = dayKey(entry.at), day = days.get(key) ?? { moments: [], count: 0 };
    day.count++;
    if (!day.moments.includes(entry.text)) day.moments.push(entry.text);
    days.set(key, day);
  }
  return [...days.entries()].map(([day, record]) => ({ day, moments: record.moments.slice(-6), count: record.count })).slice(-14);
}
export function getCompanionMood(memory: CompanionMemory, pet: GameState, now = Date.now()): CompanionMood {
  // One point per real companion day and a few different care categories; clicks cannot farm affection.
  const actual = [...memory.events.filter(e => ['adoption','pet','feed','drink','wash','play','game','buy','dress','call-name','mood-check','rename'].includes(e.kind) && e.at <= now).map(e => ({ at: e.at, kind: e.kind }))];
  const days = new Set(actual.map(e => dayKey(e.at))).size;
  const kinds = new Set(actual.map(e => e.kind)).size;
  const affection = Math.min(100, days * 2 + Math.min(8, kinds));
  const relationship = affection >= 60 ? '熟悉的老朋友' : affection >= 20 ? '越来越熟悉' : '慢慢认识你';
  const base = { affection, relationship };
  if (pet.sleeping) return { ...base, id: 'sleepy', label: '安心打盹' };
  if (pet.stats.health < 35) return { ...base, id: 'unwell', label: '想被照顾' };
  if(pet.stats.happiness<40)return {...base,id:'downcast',label:'有点闷闷的'};
  if(pet.stats.energy<45)return {...base,id:'drowsy',label:'困困地陪你'};
  if (pet.stats.happiness >= 80 && memory.events.some(e => ['feed', 'play', 'game', 'pet'].includes(e.kind) && e.at <= now && now - e.at < 20 * 60_000)) return { ...base, id: 'cheerful', label: '心情雀跃' };
  return { ...base, id: 'peaceful', label: '安心陪伴' };
}

export function forgetFact(memory: CompanionMemory, id: string): CompanionMemory {
  const removed = memory.facts.find(f => f.id === id); if (!removed) return memory;
  return { ...memory, facts: memory.facts.filter(f => f.id !== id && !f.value.includes(removed.value)), events: memory.events.filter(e => !e.detail.includes(removed.value)), messages: [] };
}
export function forgetEvent(memory: CompanionMemory, id: string): CompanionMemory {
  const removed = memory.events.find(e => e.id === id); if (!removed) return memory;
  return { ...memory, events: memory.events.filter(e => e.id !== id && e.detail !== removed.detail), facts: memory.facts.filter(f => !f.value.includes(removed.detail)), messages: [] };
}
export function editFact(memory: CompanionMemory, id: string, value: string): CompanionMemory {
  const previous = memory.facts.find(f => f.id === id), text = clean(value, 160); if (!previous || !text) return memory;
  const forgotten = forgetFact(memory, id);
  return { ...forgotten, facts: [...forgotten.facts, { ...previous, id: uid(previous.kind, text, previous.at), value: text }].slice(-MEMORY_LIMITS.facts) };
}
export function setPlanStatus(memory: CompanionMemory, id: string, status: 'active' | 'done'): CompanionMemory {
  return { ...memory, facts: memory.facts.map(f => f.id === id && f.kind === 'plan' ? { ...f, status } : f), messages: [] };
}
export function setPersonality(memory: CompanionMemory, value: string): CompanionMemory {
  return { ...memory, personality: clean(value, 80) || memory.personality, messages: [] };
}
export function clearMemory(memory: CompanionMemory): CompanionMemory { return { ...memory, facts: [], events: [], messages: [] }; }

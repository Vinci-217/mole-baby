import { getStage } from './game';
import type { GameState } from './game';
import type { CompanionMemory } from './companion-memory';

export type InvitationKind = 'ball' | 'butterfly' | 'pet';
export interface CompanionInvitation {
  kind: InvitationKind;
  title: string;
  text: string;
  acceptLabel: string;
}
export const COMPANION_PAUSE_MS = 30 * 60_000;

/** A pause is an actual user choice in the same forgettable memory as the
 * interaction. No second preference cache can keep it alive after forgetting. */
export function companionSnoozeUntil(memory: CompanionMemory, now = Date.now()): number {
  if (!Number.isFinite(now) || now < 0) return 0;
  let latest: { kind: string; at: number } | undefined;
  for (const event of memory.events) {
    if (!['companion-pause', 'companion-resume'].includes(event.kind)
      || !Number.isFinite(event.at) || event.at < 0 || event.at > now) continue;
    // Equal timestamps follow the surviving event order, so an immediate
    // explicit resume wins over the pause recorded just before it.
    if (!latest || event.at >= latest.at) latest = event;
  }
  if (!latest || latest.kind === 'companion-resume') return 0;
  const until = latest.at + COMPANION_PAUSE_MS;
  return until > now ? until : 0;
}

/** Suggest only existing, free interactions. This creates neither a memory nor
 * a reward: the user's later acceptance must perform the actual action. */
export function createInvitation(pet: GameState, memory: CompanionMemory, sequence = 0, now = Date.now()): CompanionInvitation | null {
  const needs = pet.stats;
  if (pet.sleeping || needs.health < 35 || needs.hunger < 35 || needs.thirst < 35
    || needs.cleanliness < 30 || needs.energy < 25) return null;
  const stage = getStage(pet.growth, pet.evolution);
  const belongs = memory.petId === String(pet.createdAt);
  const history = belongs ? memory.events.filter(event => event.at <= now && now - event.at < 7 * 86_400_000) : [];
  const lastPlay = history.filter(event => ['play', 'pet'].includes(event.kind)).sort((a, b) => b.at - a.at)[0];
  const known: InvitationKind | undefined = lastPlay?.kind === 'pet' ? 'pet'
    : lastPlay?.detail.includes('小蝴蝶') ? 'butterfly'
      : lastPlay?.kind === 'play' && ['我们一起玩了一会儿', '你回应我的小邀请，我们一起玩了一会儿小球。'].includes(lastPlay.detail) ? 'ball' : undefined;
  const canPlayBall = needs.energy >= 45 && needs.hunger >= 45 && needs.thirst >= 40 && needs.health >= 60;
  const subjects: Record<InvitationKind, RegExp> = { ball: /玩球|小球|足球/, butterfly: /蝴蝶/, pet: /摸摸|摸头|抚摸/ };
  const preferences = belongs ? memory.facts.filter(fact => fact.at <= now && ['boundary', 'dislike'].includes(fact.kind)) : [];
  const allowed: InvitationKind[] = canPlayBall ? ['ball', 'butterfly', 'pet'] : ['butterfly', 'pet'];
  const kinds = allowed.filter(kind => !preferences.some(fact => fact.value.split(/[，,。；;！？!?]/).some(clause =>
    subjects[kind].test(clause) && (fact.kind === 'dislike' || /别|不要|不想|不愿|不喜欢/.test(clause)),
  )));
  if (!kinds.length) return null;
  if (known && kinds.includes(known)) { kinds.splice(kinds.indexOf(known), 1); kinds.unshift(known); }
  const personality = belongs ? Array.from(memory.personality).reduce((sum, character) => sum + character.codePointAt(0)!, 0) : 0;
  const turn = Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
  const index = (known ? turn : Math.abs(Math.floor(pet.createdAt / 1000)) + personality + turn) % kinds.length;
  const kind = kinds[index];
  if (kind === 'ball') return {
    kind, title: '一起玩小球', acceptLabel: '陪你玩球',
    text: stage === 0 ? '想看看小球滚到花盆边。要陪我玩一小会儿吗？'
      : stage >= 3 ? '想飘在这里和你玩小球。要不要一起玩一小会儿？'
        : '我想和你把小球滚来滚去。空下来时，陪我玩一会儿好吗？',
  };
  if (kind === 'butterfly') return {
    kind, title: '一起看小蝴蝶', acceptLabel: '一起看看',
    text: stage === 0 ? '我待在花盆里，你陪我看一会儿小蝴蝶，好吗？'
      : '想和你在这里看一会儿小蝴蝶。你有空吗？',
  };
  return {
    kind: 'pet', title: '想要一个摸摸', acceptLabel: '轻轻摸摸',
    text: stage === 0 ? '想被你轻轻摸一下，然后继续在花盆里陪你。可以吗？'
      : stage >= 3 ? '我轻轻飘着，想讨一个摸摸。你有空吗？'
        : '想讨一个轻轻的摸摸，再安静陪你一会儿。可以吗？',
  };
}

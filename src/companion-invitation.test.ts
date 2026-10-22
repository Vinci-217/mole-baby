import { describe, expect, it } from 'vitest';
import { createPet } from './game';
import { createMemory, forgetEvent, recordEvent } from './companion-memory';
import { companionSnoozeUntil, COMPANION_PAUSE_MS, createInvitation } from './companion-invitation';

const now = new Date(2026, 9, 22, 10).getTime();
const pet = () => createPet('小芽', 'blue', now - 86_400_000);

describe('small, optional companion invitations', () => {
  it('uses only existing free interactions and keeps every original stage in character', () => {
    for (const [growth, evolution] of [[0, undefined], [60, undefined], [180, undefined], [420, undefined], [840, 'super'], [840, 'water'], [840, 'wood'], [840, 'fire']] as const) {
      const current = { ...pet(), growth, ...(evolution ? { evolution } : {}) }, memory = createMemory(current);
      const before = JSON.stringify({ current, memory }), kinds = new Set<string>();
      for (let sequence = 0; sequence < 6; sequence++) {
        const offer = createInvitation(current, memory, sequence, now)!;
        expect(offer.acceptLabel.length).toBeGreaterThan(0); expect(offer.text).toMatch(/[？?]$/);
        if (growth === 0) { expect(offer.text).toContain('花盆'); expect(offer.text).not.toMatch(/飞|跑|跳|离开/); }
        if (growth >= 420 && offer.kind !== 'butterfly') expect(offer.text).toContain('飘');
        kinds.add(offer.kind);
      }
      expect(kinds).toEqual(new Set(['ball', 'butterfly', 'pet']));
      expect(JSON.stringify({ current, memory })).toBe(before);
    }
  });
  it('lets sleep and real needs take priority and never asks a tired pet to play ball', () => {
    const p = pet(), memory = createMemory(p);
    expect(createInvitation({ ...p, sleeping: true }, memory, 0, now)).toBeNull();
    for (const [key, value] of [['health', 34], ['hunger', 34], ['thirst', 34], ['cleanliness', 29], ['energy', 24]] as const) {
      expect(createInvitation({ ...p, stats: { ...p.stats, [key]: value } }, memory, 0, now)).toBeNull();
    }
    const tired = { ...p, stats: { ...p.stats, energy: 30 } };
    for (let sequence = 0; sequence < 6; sequence++) expect(createInvitation(tired, memory, sequence, now)?.kind).not.toBe('ball');
  });
  it('remembers only a surviving real interaction when suggesting a familiar activity', () => {
    const p = pet(), empty = createMemory(p);
    let memory = recordEvent(empty, { kind: 'play', detail: '你陪我在原地看了一会儿小蝴蝶。', at: now - 1000 });
    memory = recordEvent(memory, { kind: 'companion-pause', detail: '先忙一会儿', at: now - 500 });
    memory = recordEvent(memory, { kind: 'pet', detail: '明天摸摸', at: now + 1000 });
    expect(createInvitation(p, memory, 0, now)?.kind).toBe('butterfly');
    const forgotten = forgetEvent(memory, memory.events[0].id);
    expect(createInvitation(p, forgotten, 0, now)).toEqual(createInvitation(p, empty, 0, now));
    expect(createInvitation(p, { ...memory, petId: 'another-pet' }, 0, now)).toEqual(createInvitation(p, { ...empty, petId: 'another-pet' }, 0, now));
    expect(createInvitation(p, memory, NaN, now)).toEqual(createInvitation(p, memory, 0, now));
    const accepted = recordEvent(memory, { kind: 'play', detail: '你回应我的小邀请，我们一起玩了一会儿小球。', at: now });
    expect(createInvitation(p, accepted, 0, now)?.kind).toBe('ball');
    expect(createInvitation(p, forgetEvent(accepted, accepted.events.at(-1)!.id), 0, now)?.kind).toBe('butterfly');
  });
  it('respects actual action-specific boundaries without treating a positive clause as another refusal', () => {
    const p = pet(), memory = createMemory(p);
    memory.facts = [{ id: 'a', kind: 'boundary', value: '不要玩球，不想看蝴蝶，只想摸摸。', at: now }];
    for (let sequence = 0; sequence < 5; sequence++) expect(createInvitation(p, memory, sequence, now)?.kind).toBe('pet');
    memory.facts.push({ id: 'b', kind: 'dislike', value: '摸摸', at: now });
    expect(createInvitation(p, memory, 0, now)).toBeNull();
    memory.facts[1].at = now + 1000;
    expect(createInvitation(p, memory, 0, now)?.kind).toBe('pet');
  });
});

describe('the user can postpone companionship without leaving a hidden setting', () => {
  it('pauses for exactly thirty minutes and an explicit resume cancels immediately', () => {
    const p = pet(), empty = createMemory(p);
    const paused = recordEvent(empty, { kind: 'companion-pause', detail: '先忙30分钟', at: now });
    expect(companionSnoozeUntil(empty, now)).toBe(0);
    expect(companionSnoozeUntil(paused, now)).toBe(now + COMPANION_PAUSE_MS);
    expect(companionSnoozeUntil(paused, now + COMPANION_PAUSE_MS - 1)).toBe(now + COMPANION_PAUSE_MS);
    expect(companionSnoozeUntil(paused, now + COMPANION_PAUSE_MS)).toBe(0);
    const resumed = recordEvent(paused, { kind: 'companion-resume', detail: '又有空啦', at: now });
    expect(companionSnoozeUntil(resumed, now)).toBe(0);
    expect(companionSnoozeUntil(forgetEvent(paused, paused.events[0].id), now)).toBe(0);
  });
  it('uses the latest past choice, ignores future or invalid events, and cannot be extended by unrelated care', () => {
    const memory = createMemory(pet());
    memory.events = [
      { id: 'pause', kind: 'companion-pause', detail: '', at: now - 1000 },
      { id: 'future', kind: 'companion-resume', detail: '', at: now + 1000 },
      { id: 'bad', kind: 'companion-pause', detail: '', at: NaN },
      { id: 'care', kind: 'pet', detail: '', at: now },
      { id: 'old', kind: 'companion-pause', detail: '', at: now - 5000 },
    ];
    expect(companionSnoozeUntil(memory, now)).toBe(now - 1000 + COMPANION_PAUSE_MS);
    expect(companionSnoozeUntil(memory, NaN)).toBe(0);
    expect(companionSnoozeUntil(memory, -1)).toBe(0);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPet } from './game';
import { appendMessage, buildMessages, createMemory, forgetEvent, localReply, parseMemory, recordCare, recordEvent, rememberChat } from './companion-memory';
import { getPetHabits, HABIT_DAYS, nameResponse, petHabitReply } from './companion-instinct';

const now = new Date(2026, 9, 22, 14, 0).getTime();
const pet = createPet('小芽', 'pink', now - 8 * 86_400_000);
afterEach(() => vi.useRealTimers());

describe('familiarity comes from surviving shared events', () => {
  it('counts real food and drink care once, excluding purchases, plans, wrong categories, stale and future records', () => {
    let memory = createMemory(pet);
    for (const [kind, detail, at] of [
      ['feed', '你用熊熊饼干照料了我。', now - 120_000],
      ['feed', '你用熊熊饼干照料了我。', now - 60_000],
      ['drink', '你用麦香牛奶照料了我。', now - 50_000],
      ['buy', '你用水晶蛋糕照料了我。', now - 40_000],
      ['import', '你用水晶蛋糕照料了我。', now - 30_000],
      ['feed', '下次想用水晶蛋糕照料我。', now - 20_000],
      ['feed', '你用麦香牛奶照料了我。', now - 15_000],
      ['drink', '你用红色换色药水照料了我。', now - 10_000],
      ['feed', '你用可可果照料了我。', now + 1],
      ['feed', '你用可可果照料了我。', now - HABIT_DAYS * 86_400_000 - 1],
    ] as const) memory = recordEvent(memory, { kind, detail, at });
    memory.events.push({ ...memory.events[0] });
    const habits = getPetHabits(memory, now);
    expect(habits.days).toBe(7);
    expect(habits.food).toMatchObject({ id: 'biscuit', name: '熊熊饼干', count: 2, lastAt: now - 60_000 });
    expect(habits.drink).toMatchObject({ id: '180002', name: '麦香牛奶', count: 1 });
    expect(habits.play).toBeNull();
    expect(getPetHabits(memory, NaN)).toEqual({ days: 7, food: null, drink: null, play: null });
  });

  it('chooses a familiar actual activity, retaining recency as a tie breaker without counting invitations', () => {
    let memory = createMemory(pet);
    for (const [kind, detail, at] of [
      ['play', '我们一起玩了一会儿', now - 180_000],
      ['play', '你陪我在原地看了一会儿小蝴蝶。', now - 120_000],
      ['play', '你陪我在原地看了一会儿小蝴蝶。', now - 60_000],
      ['presence', '你陪我在原地看了一会儿小蝴蝶。', now - 50_000],
      ['play', '要不要陪我看小蝴蝶？', now - 40_000],
      ['cancel', '我们一起在树洞房完成了《小屋寻宝》，得到10分，收获24摩尔豆。', now - 30_000],
      ['game', '我们一起在树洞房完成了《小屋寻宝》，得到10分，收获24摩尔豆。', now - 20_000],
      ['game', '我们一起在星光温室完成了《小屋寻宝》，得到9分，收获22摩尔豆。', now - 10_000],
    ] as const) memory = recordEvent(memory, { kind, detail, at });
    expect(getPetHabits(memory, now).play).toMatchObject({ id: 'game:小屋寻宝', name: '小屋寻宝', count: 2 });
    const butterflyOnly = { ...memory, events: memory.events.filter(event => event.kind !== 'game') };
    expect(getPetHabits(butterflyOnly, now).play).toMatchObject({ id: 'butterfly', count: 2 });
  });

  it('restores evidence for offline and model replies, then immediately forgets it with no extra profile', () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const source = recordCare(createMemory(pet), 'feed', '你用熊熊饼干照料了我。', now - 1000);
    const memory = parseMemory(source, pet);
    expect(localReply(pet, memory, '你喜欢吃什么？')).toContain('熊熊饼干');
    expect(buildMessages(pet, memory, '你喜欢吃什么？', now)[0].content).toContain('"recentHabits":{"days":7,"food":{"id":"biscuit"');
    expect(buildMessages(pet, memory, '你喜欢吃什么？', now)[0].content).toContain('不代表永远最爱或用户自己的偏好');
    const forgotten = forgetEvent(memory, memory.events[0].id);
    expect(getPetHabits(forgotten, now).food).toBeNull();
    expect(localReply(pet, forgotten, '你喜欢吃什么？')).not.toContain('熊熊饼干');
    expect(localReply(pet, forgotten, '你喜欢吃什么？')).toContain('还没');
    expect(buildMessages(pet, forgotten, '你喜欢吃什么？', now)[0].content).not.toContain('熊熊饼干');
  });

  it('counts an accepted invitation only through its actual care action, without treating the offer or a busy reply as play', () => {
    let memory = createMemory(pet);
    for (const [kind, detail, at] of [
      ['presence', '你回应我的小邀请，我们一起玩了一会儿小球。', now - 5000],
      ['invitation-deferred', '你答应我的小邀请，轻轻摸了摸我。', now - 4000],
      ['play', '你回应我的小邀请，我们一起玩了一会儿小球。', now - 3000],
      ['play', '你回应我的小邀请，陪我在原地看了一会儿小蝴蝶。', now - 2000],
      ['pet', '你答应我的小邀请，轻轻摸了摸我。', now - 1000],
    ] as const) memory = recordEvent(memory, { kind, detail, at });
    expect(getPetHabits(memory, now).play).toMatchObject({ id: 'pet', count: 1 });
    const ballOnly = { ...memory, events: memory.events.filter(event => !['pet'].includes(event.kind) && !event.detail.includes('小蝴蝶')) };
    expect(getPetHabits(ballOnly, now).play).toMatchObject({ id: 'ball', count: 1 });
  });

  it('keeps the user’s own preferences separate and is honest when this pet has no shared history', () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const memory = rememberChat(recordCare(createMemory(pet), 'feed', '你用熊熊饼干照料了我。', now - 1000), '我喜欢草莓。', now);
    expect(localReply(pet, memory, '我喜欢什么？')).toContain('草莓');
    expect(localReply(pet, memory, '你记得我喜欢吃什么吗？')).toContain('草莓');
    expect(petHabitReply(pet, memory, '你记得我喜欢吃什么吗？', now)).toBeNull();
    expect(petHabitReply(pet, memory, '你记得我喂过什么吗？', now)).toContain('熊熊饼干');
    expect(petHabitReply(pet, createMemory(pet), '你喜欢喝什么？', now)).toContain('还没');
    expect(petHabitReply(pet, createMemory(pet), '你喜欢玩什么？', now)).toContain('还没有');
    const onlyMilk = recordCare(createMemory(pet), 'drink', '你用麦香牛奶照料了我。', now - 1000);
    expect(petHabitReply(pet, onlyMilk, '你喜欢吃什么？', now)).not.toContain('麦香牛奶');
    expect(petHabitReply(pet, onlyMilk, '你喜欢喝什么？', now)).toContain('麦香牛奶');
    expect(petHabitReply({ ...pet, createdAt: pet.createdAt + 1 }, memory, '你喜欢吃什么？', now)).toBeNull();
  });
});

describe('a local response to its actual name', () => {
  it('varies within a stable temperament, honours the current name and saved owner nickname, and keeps each stage’s anatomy', () => {
    const memory = rememberChat({ ...createMemory(pet), personality: '有点慢热，喜欢安静陪伴' }, '叫我小米。', now - 1000);
    expect(nameResponse(pet, memory, 0, now)).toEqual(nameResponse(pet, memory, 0, now));
    expect(nameResponse(pet, memory, 0, now).text).toContain('小米');
    expect(nameResponse(pet, memory, 0, now).text).toContain('你慢慢说');
    expect(nameResponse({ ...pet, name: '小桃' }, memory, 0, now).text).toContain('小桃');
    expect(nameResponse({ ...pet, name: '小桃' }, memory, 0, now).text).not.toContain('小芽');
    for (const [growth, expected] of [[0, '小花盆'], [60, '回过神'], [180, '两片'], [420, '飘着']] as const) {
      const response = nameResponse({ ...pet, growth }, memory, 1, now);
      expect(response.action).toBe('look-around'); expect(response.text).toContain(expected);
    }
    expect(nameResponse({ ...pet, growth: 840, evolution: 'water' }, memory, 1, now).text).toContain('飘着');
    expect(nameResponse(pet, memory, 0, now).text).not.toBe(nameResponse(pet, memory, 1, now).text);
  });

  it('responds to tiredness or sadness and never wakes, feeds or mutates a sleeping pet', () => {
    const memory = appendMessage(createMemory(pet), 'user', '今天我很难过。', now - 1000);
    expect(nameResponse(pet, memory, 0, now).text).toContain('安静陪着');
    expect(nameResponse({ ...pet, stats: { ...pet.stats, energy: 22 } }, memory, 0, now).text).toContain('有点困');
    const sleeping = { ...pet, sleeping: true }, previous = JSON.stringify(sleeping);
    const response = nameResponse(sleeping, memory, 0, now);
    expect(response.action).toBe('sleep'); expect(response.text).toContain('轻轻叫醒');
    expect(JSON.stringify(sleeping)).toBe(previous);
    const future = rememberChat(createMemory(pet), '叫我未来名字。', now + 1000);
    expect(nameResponse(pet, future, 0, now).text).not.toContain('未来名字');
  });
});

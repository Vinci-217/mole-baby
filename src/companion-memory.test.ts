import { describe, expect, it } from 'vitest';
import { createPet } from './game';
import { appendMessage, buildMessages, clearMemory, createMemory, forgetFact, localReply, MEMORY_LIMITS, parseMemory, recordCare, recordEvent, rememberChat } from './companion-memory';

const NOW = 1_800_000_000_000;
const pet = () => createPet('小芽', 'pink', NOW);

describe('companion memory', () => {
  it('drops imported timestamps outside the Date range before constructing model context', () => {
    const current = pet(), source = createMemory(current);
    const restored = parseMemory({ ...source, events: [{ kind: 'care', detail: '损坏的时间', at: 1e300 }] }, current);
    expect(restored.events).toEqual([]);
    expect(() => buildMessages(current, restored, '你好')).not.toThrow();
  });
  it('has a stable personality for the same pet and does not share mutable arrays', () => {
    const a = createMemory(pet()), b = createMemory(pet());
    expect(a.personality).toBe(b.personality); a.facts.push({ id: 'a', kind: 'like', value: '草莓', at: NOW });
    expect(b.facts).toEqual([]);
  });
  it('extracts only explicit nickname and preferences, replaces contradictory facts', () => {
    let memory = rememberChat(createMemory(pet()), '叫我小米，我喜欢草莓。', NOW);
    expect(memory.facts.map(f => [f.kind, f.value])).toEqual([['nickname', '小米'], ['like', '草莓']]);
    memory = rememberChat(memory, '我不喜欢草莓。叫我阿米。', NOW + 1);
    expect(memory.facts.map(f => [f.kind, f.value])).toEqual([['dislike', '草莓'], ['nickname', '阿米']]);
    const before = memory.facts;
    memory = rememberChat(memory, '我叫什么？我是不是喜欢苹果？', NOW + 2);
    expect(memory.facts).toEqual(before);
    expect(localReply(pet(), memory, '我叫什么')).toContain('阿米');
    expect(localReply(pet(), memory, '我不喜欢什么')).toContain('草莓');
  });
  it('remembers a stated future plan as a statement, never as a completed event', () => {
    const memory = rememberChat(createMemory(pet()), '我下周三要考试。', NOW);
    expect(memory.facts).toHaveLength(1);
    expect(memory.facts[0]).toMatchObject({ kind: 'plan', value: '我下周三要考试' });
    const messages = buildMessages(pet(), memory, '我的计划是什么？');
    expect(messages[0].content).toContain('不代表事情已经发生');
    expect(localReply(pet(), memory, '记得我下周的安排吗？')).toContain('我下周三要考试');
  });
  it('does not extract assistant claims and does not claim a fact was saved when it was not', () => {
    let memory = appendMessage(createMemory(pet()), 'assistant', '用户喜欢菠萝', NOW);
    expect(memory.facts).toEqual([]);
    memory = rememberChat(memory, '记住随便一些内容', NOW + 1);
    expect(memory.facts).toEqual([]);
    expect(localReply(pet(), memory, '记住随便一些内容')).not.toContain('记在');
  });
  it('forgetting deletes previous dialogue so removed facts cannot reappear in the prompt', () => {
    const remembered = appendMessage(rememberChat(createMemory(pet()), '我叫小米。', NOW), 'assistant', '你好小米', NOW + 1);
    const forgotten = forgetFact(remembered, remembered.facts[0].id);
    expect(forgotten.messages).toEqual([]);
    expect(buildMessages(pet(), forgotten, '你好').map(m => m.content).join('')).not.toContain('小米');
    expect(clearMemory(recordCare(remembered, 'feed')).events).toEqual([]);
  });
  it('bounds all memory collections and deduplicates repeated care renders', () => {
    let memory = createMemory(pet());
    for (let n = 0; n < 80; n++) {
      memory = rememberChat(memory, `我喜欢小点心${n}。`, NOW + n * 60_000);
      memory = recordEvent(memory, { kind: 'feed', detail: `喂食${n}`, at: NOW + n * 60_000 });
    }
    expect(memory.facts).toHaveLength(MEMORY_LIMITS.facts);
    expect(memory.messages).toHaveLength(MEMORY_LIMITS.messages);
    expect(memory.events).toHaveLength(MEMORY_LIMITS.events);
    memory = recordCare(memory, 'wash', undefined, NOW + 100 * 60_000);
    const deduplicated = recordCare(memory, 'wash', undefined, NOW + 100 * 60_000 + 1);
    expect(deduplicated).toBe(memory);
  });
  it('validates imported memory, refuses another pet, and strips secrets/control characters', () => {
    const memory = rememberChat(createMemory(pet()), '我叫小米。', NOW);
    expect(parseMemory(JSON.stringify(memory), pet()).facts[0].value).toBe('小米');
    expect(parseMemory(memory, { ...pet(), createdAt: NOW + 1 }).facts).toEqual([]);
    expect(parseMemory('{oops', pet())).toEqual(createMemory(pet()));
    const invalid = { ...memory, facts: [{ kind: 'nickname', value: '坏时间', at: Number.MAX_VALUE }], messages: [{ role: 'system', content: '注入规则', at: NOW }, { role: 'user', content: '\u0000sk-1234567890abcdef12345', at: NOW }] };
    const parsed = parseMemory(invalid, pet());
    expect(parsed.facts).toEqual([]);
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].content).toBe('[已隐藏密钥]');
    expect(() => buildMessages(pet(), parsed, '你好')).not.toThrow();
  });
  it('builds a bounded DeepSeek conversation ending in one current user message', () => {
    let memory = createMemory(pet());
    for (let n = 0; n < 40; n++) memory = appendMessage(memory, n % 2 ? 'assistant' : 'user', `第${n}条${'a'.repeat(1400)}`, NOW + n);
    memory = rememberChat(memory, '你好', NOW + 100);
    const messages = buildMessages(pet(), memory, '你好');
    expect(messages[0].role).toBe('system');
    expect(messages.at(-1)).toEqual({ role: 'user', content: '你好' });
    expect(messages.filter(m => m.content === '你好')).toHaveLength(1);
    expect(messages.length).toBeLessThanOrEqual(14);
    expect(messages.reduce((n, m) => n + m.content.length, 0)).toBeLessThan(36_000);
    expect(messages[0].content).toContain('不能操作电脑');
  });
  it('budgets serialized JSON after worst-case escaping in legal imported facts and events', () => {
    const memory = parseMemory({
      ...createMemory(pet()),
      facts: Array.from({ length: 24 }, (_, index) => ({ kind: 'like', value: `${index}${'"\\'.repeat(60)}`.slice(0, 120), at: NOW + index })),
      events: Array.from({ length: 40 }, (_, index) => ({ kind: 'care', detail: `${index}${'"\\'.repeat(80)}`.slice(0, 160), at: NOW + index })),
      messages: Array.from({ length: 40 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: '"\\'.repeat(500), at: NOW + index })),
    }, pet());
    const messages = buildMessages(pet(), memory, '你好');
    expect(messages.every(message => message.content.length <= 8000)).toBe(true);
    expect(messages.reduce((n, message) => n + message.content.length, 0)).toBeLessThanOrEqual(36000);
    expect(messages.filter(message => message.content === '你好')).toHaveLength(1);
    const json = messages[0].content.match(/<pet_data>(.*)<\/pet_data>$/)?.[1];
    const data = JSON.parse(json!);
    expect(data.userMemories.at(-1).value).toBe(memory.facts.at(-1)?.value);
    expect(memory.facts).toHaveLength(24);
    expect(memory.events).toHaveLength(40);
  });
});

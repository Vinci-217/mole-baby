// Deferred bridge responses reproduce races without an API key or microphone.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
const { adopt } = require('./smoke-helpers.cjs');
const root = path.resolve(__dirname, '..');
const url = 'http://127.0.0.1:5188';
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { cwd: root, stdio: 'pipe' });
let browser, serverError = '';
server.stderr.on('data', data => { serverError += data; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function readMemory(page) {
  return page.evaluate(() => {
    const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1'));
    return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`));
  });
}
(async () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw Error(serverError || 'Vite stopped unexpectedly');
    try { if ((await fetch(url)).ok) break; } catch { /* Wait for Vite. */ }
    if (attempt === 99) throw Error('Vite startup timed out'); await pause(100);
  }
  const executablePath = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(file => fs.existsSync(file));
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function (callback, delay, ...args) {
      if (delay >= 2_390_000 && delay <= 2_400_000) window.__reminder = callback;
      return originalSetTimeout(callback, delay, ...args);
    };
    window.companionAI = {
      getSettings: async () => ({ configured: true, protection: 'os-encrypted' }),
      chat: () => new Promise(resolve => { window.__resolveChat = resolve; }), cancel() {},
    };
    window.companionSpeech = {
      getAvailability: async () => ({ available: true, language: 'zh-CN' }),
      listen: () => new Promise(resolve => { window.__resolveSpeech = resolve; }),
      cancel() { window.__speechCancels = (window.__speechCancels || 0) + 1; },
    };
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ lang: 'zh-CN' }],
      speak(utterance) { window.__utterance = utterance; utterance.onstart?.(); },
      cancel() { window.__ttsCancels = (window.__ttsCancels || 0) + 1; },
    } });
  });
  await page.goto(url);
  await adopt(page, '粉色', '小拉姆');
  await page.getByRole('button',{name:'开始计时',exact:true}).click();
  await page.getByTestId('desktop-character').click();
  await page.getByRole('button', { name: '和拉姆说话', exact: true }).click();
  await page.getByText('DeepSeek · 联网对话', { exact: true }).waitFor();
  const input = page.getByRole('textbox', { name: '和拉姆说话', exact: true });
  const send = page.getByRole('button', { name: '发送消息', exact: true });
  await input.fill('我喜欢草莓'); await send.click();
  await page.getByText('小拉姆在想怎么回答…', { exact: true }).waitFor();
  await page.evaluate(() => { window.__reminder(); window.__resolveChat('我记住了。'); });
  await page.getByText('我记住了。', { exact: true }).first().waitFor();
  await expect.poll(async () => (await readMemory(page)).events.some(event => event.kind === 'reminder')).toBe(true);
  assert.deepEqual((await readMemory(page)).messages.map(message => message.content), ['我喜欢草莓', '我记住了。']);
  console.log('PASS concurrent reminder + chat response preserves both event and conversation');

  await page.getByLabel('朗读回复', { exact: true }).check();
  await input.fill('你好'); await send.click();
  await page.getByText('小拉姆在想怎么回答…', { exact: true }).waitFor();
  await page.evaluate(() => window.__resolveChat('咕噜，下午好。'));
  await page.waitForFunction(() => !!window.__utterance);
  await page.getByRole('button', { name: '语音输入', exact: true }).click();
  await page.getByText('正在听，请说话。本机离线识别，录音不会发送给 DeepSeek。', { exact: true }).waitFor();
  await page.getByText('我们的小本子 · 1 条记忆', { exact: true }).click();
  let cancels = await page.evaluate(() => ({ speech: window.__speechCancels || 0, tts: window.__ttsCancels || 0 }));
  await page.getByRole('button', { name: '清空记忆与对话', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__speechCancels || 0)).toBe(cancels.speech + 1);
  await expect.poll(() => page.evaluate(() => window.__ttsCancels || 0)).toBe(cancels.tts + 1);
  await page.evaluate(() => { window.__resolveSpeech('叫我不该回来的旧录音'); window.__utterance.onerror?.(); });
  await expect(input).toHaveValue('');
  await expect(page.getByText('朗读未完成，可以继续用文字聊天。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '语音输入', exact: true })).toBeVisible();
  await expect.poll(async () => { const memory = await readMemory(page); return [memory.facts.length, memory.messages.length, memory.events.length]; }).toEqual([0, 0, 0]);
  console.log('PASS clear memory cancels microphone/TTS and ignores deferred recognition + old TTS callbacks');

  await input.fill('叫我小米'); await send.click();
  await page.getByText('小拉姆在想怎么回答…', { exact: true }).waitFor();
  await page.evaluate(() => window.__resolveChat('你好，小米。'));
  await page.getByText('你好，小米。', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: '语音输入', exact: true }).click();
  await page.getByText('正在听，请说话。本机离线识别，录音不会发送给 DeepSeek。', { exact: true }).waitFor();
  cancels = await page.evaluate(() => ({ speech: window.__speechCancels || 0 }));
  await page.getByRole('button', { name: '忘记称呼小米', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__speechCancels || 0)).toBe(cancels.speech + 1);
  await page.evaluate(() => window.__resolveSpeech('叫我已删除的旧录音'));
  await expect(input).toHaveValue('');
  await expect.poll(async () => { const memory = await readMemory(page); return [memory.facts.length, memory.messages.length]; }).toEqual([0, 0]);
  assert.deepEqual(pageErrors, []);
  console.log('PASS forget one fact cancels recognition, clears history and rejects late transcript');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });

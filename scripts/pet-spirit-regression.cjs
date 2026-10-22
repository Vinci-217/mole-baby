const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
const { adopt, openActions, enterHome, roomTab, toDesktop, selectPocket } = require('./smoke-helpers.cjs');

const root = path.resolve(__dirname, '..'), url = 'http://127.0.0.1:5206';
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5206', '--strictPort'], { cwd: root, stdio: 'pipe' });
let browser, page, output = '';
server.stdout.on('data', data => output += data); server.stderr.on('data', data => output += data);
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));
const memory = () => page.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')); return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`)); });
const actualPlay = value => value.events.filter(event => ['play', 'pet'].includes(event.kind));
const ram = () => page.getByTestId('desktop-character').locator('.ram-sprite');
const spirit = () => page.getByTestId('pet-invitation');
const offer = () => spirit().locator('[data-invitation-kind]');

async function advance(milliseconds = 8000) { await page.clock.fastForward(milliseconds); await page.clock.runFor(50); }
async function openPlay() { await openActions(page); await page.getByTestId('pet-actions').getByRole('button', { name: '玩耍', exact: true }).click(); await expect(spirit()).toBeVisible(); }
async function fixture(form, growth, color = 'red', extra = {}) {
  await page.evaluate(({ form, growth, color, extra }) => {
    const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1'));
    Object.assign(pet, { growth, color, sleeping: false, lastTick: Date.now(), stats: { hunger: 90, thirst: 90, cleanliness: 90, happiness: 70, health: 100, energy: 90 }, ...extra });
    delete pet.evolution; if (growth === 840) pet.evolution = form;
    localStorage.setItem('ramu-house-save-v1', JSON.stringify(pet));
    localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: false, presence: false, lively: false, reminders: true, reminderMinutes: 1 }));
  }, { form, growth, color, extra });
  await page.reload();
  await expect.poll(async () => { await page.clock.runFor(40); return ram().locator('canvas').getAttribute('data-loaded'); }).toBe('true');
}
async function suggest(kind) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await spirit().getByRole('button', { name: '让拉姆提个主意', exact: true }).click();
    await expect(offer()).toBeVisible();
    await expect(offer().locator('.pet-invitation-accept')).toBeInViewport();
    await expect(offer().locator('.pet-invitation-defer')).toBeInViewport();
    if (!kind || await offer().getAttribute('data-invitation-kind') === kind) return;
  }
  throw Error(`The manual ideas did not include ${kind}`);
}
async function setHidden(hidden) {
  await page.evaluate(hidden => {
    if (hidden) {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    } else { delete document.hidden; delete document.visibilityState; }
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await page.clock.runFor(40);
}
async function chat(text) {
  const panel = page.getByTestId('companion-panel');
  await panel.getByRole('tab', { name: '对话', exact: true }).click();
  await panel.getByRole('textbox', { name: '和拉姆说话', exact: true }).fill(text);
  await panel.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(panel.locator('.chat-entry.assistant').last()).toBeVisible();
  return panel.locator('.chat-entry.assistant').last().innerText();
}
async function forgetEvent(detail) {
  const panel = page.getByTestId('companion-panel');
  await panel.getByRole('tab', { name: '对话', exact: true }).click();
  const book = panel.locator('.companion-memories'); await book.locator('> summary').click();
  await book.getByText(/^一起发生过的小事/).click();
  await book.getByRole('button', { name: `忘记${detail}`, exact: true }).first().click();
  await panel.getByRole('tab', { name: '玩耍', exact: true }).click();
}
async function checkPanelFits(filename) {
  const panel = page.getByTestId('companion-panel'), bounds = await panel.boundingBox();
  assert.ok(bounds.width >= 320 && bounds.width <= 334, 'desktop interactions retain the narrow adjacent window');
  assert.equal(await panel.evaluate(node => node.scrollWidth > node.clientWidth + 1), false, 'new interactions do not overflow horizontally');
  const inner = await spirit().boundingBox(); assert.ok(inner.x >= bounds.x && inner.x + inner.width <= bounds.x + bounds.width + 1);
  if (await offer().count()) {
    const accept = offer().locator('.pet-invitation-accept');
    await expect(accept).toBeInViewport(); await expect(offer().locator('.pet-invitation-defer')).toBeInViewport();
    for (let step = 0; step < 6 && !await accept.evaluate(node => node === document.activeElement); step++) await page.keyboard.press('Shift+Tab');
    assert.equal(await accept.evaluate(node => node === document.activeElement), true, 'the invitation can be accepted using the keyboard');
  }
  await page.screenshot({ path: path.join(root, 'artifacts', filename) });
}

async function namesAndOffers() {
  const forms = [['seed', 0], ['junior', 60], ['middle', 180], ['senior', 420], ['super', 840], ['water', 840], ['wood', 840], ['fire', 840]];
  let index = 0;
  for (const [form, growth] of forms) for (const color of ['red', 'yellow', 'blue', 'pink']) {
    await fixture(form, growth, color); await openPlay();
    const before = await save(), calls = (await memory()).events.filter(event => event.kind === 'call-name').length;
    await spirit().getByRole('button', { name: `叫叫${before.name}`, exact: true }).click();
    await expect(ram()).toHaveAttribute('data-action', 'look-around');
    await expect(page.locator('.compact-bubble')).toContainText(before.name);
    await expect(ram()).toHaveAttribute('data-color', color); await expect(ram().locator('canvas')).toHaveAttribute('data-form', form);
    if (growth >= 420) { await expect(ram()).toHaveClass(/is-flying/); await expect(ram().locator('canvas')).toHaveAttribute('data-row', '0'); }
    if (growth === 0) assert.equal(await ram().locator('.seed-pot-original').evaluate(node => getComputedStyle(node).transform), 'none');
    assert.equal((await memory()).events.filter(event => event.kind === 'call-name').length, calls + 1);
    if (form === 'middle' && color === 'blue') await checkPanelFits('v19-name-response.png');
    await advance(4000); await expect(ram()).toHaveAttribute('data-action', 'idle');
    const beforeOffer = await memory(), choice = ['ball', 'butterfly', 'pet'][index++ % 3];
    await suggest(choice);
    assert.equal(actualPlay(await memory()).length, actualPlay(beforeOffer).length, 'an offered idea has not already happened');
    const actual = { ball: 'play', butterfly: 'watch-butterfly', pet: 'pet' }[choice];
    await offer().locator('.pet-invitation-accept').evaluate(button => { button.click(); button.click(); });
    await expect(ram()).toHaveAttribute('data-action', actual); await expect(offer()).toHaveCount(0);
    await page.clock.runFor(700);
    await expect(ram().locator(choice === 'ball' ? '.social-ball' : choice === 'pet' ? '.social-hand' : '.social-butterfly>img')).toBeVisible();
    assert.equal(actualPlay(await memory()).length, actualPlay(beforeOffer).length + 1, 'acceptance performs and remembers one actual interaction');
    assert.equal((await save()).coins, before.coins); assert.deepEqual((await save()).inventory, before.inventory);
    if (growth === 0) assert.equal(await ram().locator('.seed-pot-original').evaluate(node => getComputedStyle(node).transform), 'none');
    if (growth >= 420) { await expect(ram()).toHaveClass(/is-flying/); await expect(ram().locator('canvas')).toHaveAttribute('data-row', '0'); }
    await advance(); await expect(ram()).toHaveAttribute('data-action', 'idle');
    assert.equal(await page.getByRole('timer').count(), 0, 'calling or inviting does not start focus');
  }
  console.log('PASS 32 original form/colour name replies and accepted invitations: finite original motion, stationary seed pot, uninterrupted flight, one action/memory and no coin/item/timer side effects');
}

async function politeDeferral() {
  await fixture('middle', 180, 'blue'); await openPlay(); const before = await save(), history = actualPlay(await memory());
  await suggest();
  for (const [width, height] of [[1180, 820], [1000, 720]]) { await page.setViewportSize({ width, height }); await checkPanelFits(width === 1180 ? 'v19-invitation.png' : 'v19-invitation-compact.png'); }
  await setHidden(true); await offer().locator('.pet-invitation-accept').evaluate(button => button.click()); await page.clock.runFor(50);
  await expect(ram()).toHaveAttribute('data-action', 'idle');
  assert.deepEqual(actualPlay(await memory()), history, 'hidden offers cannot execute'); await setHidden(false);
  if (!await offer().count()) await suggest();
  await offer().getByRole('button', { name: '我先忙30分钟', exact: true }).click(); await expect(offer()).toHaveCount(0);
  await expect(spirit().getByRole('button', { name: '恢复主动陪伴', exact: true })).toBeVisible();
  assert.deepEqual(actualPlay(await memory()), history); assert.equal((await save()).coins, before.coins);
  const pause = (await memory()).events.filter(event => event.kind === 'companion-pause').at(-1); assert.ok(pause);
  await page.reload(); await page.clock.runFor(100); await openPlay();
  await expect(spirit().getByRole('button', { name: '恢复主动陪伴', exact: true })).toBeVisible();
  await advance(30 * 60_000 + 16000); await expect(spirit().getByRole('button', { name: '恢复主动陪伴', exact: true })).toHaveCount(0);
  await suggest(); await offer().getByRole('button', { name: '我先忙30分钟', exact: true }).click();
  await forgetEvent((await memory()).events.filter(event => event.kind === 'companion-pause').at(-1).detail);
  await expect(spirit().getByRole('button', { name: '恢复主动陪伴', exact: true })).toHaveCount(0);
  await suggest(); await offer().getByRole('button', { name: '我先忙30分钟', exact: true }).click();
  await spirit().getByRole('button', { name: '恢复主动陪伴', exact: true }).click();
  assert.equal((await memory()).events.at(-1).kind, 'companion-resume');
  await expect(spirit().getByRole('button', { name: '恢复主动陪伴', exact: true })).toHaveCount(0);
  await suggest(); await page.clock.fastForward(5 * 60_000 - 1); await expect(offer()).toHaveCount(1);
  await page.clock.fastForward(1); await expect(offer()).toHaveCount(0);
  assert.deepEqual(actualPlay(await memory()), history, 'deferral, forgetting and stale ideas create no fabricated play');
  console.log('PASS hidden-action guard, two compact layouts, respectful deferral, persisted thirty-minute pause, expiry/resume/forget and no stale invitation payout or fake experience');
}

async function realHabitsAndRename() {
  const pet = await save(); await fixture('middle', 180, 'pink', { inventory: { ...pet.inventory, biscuit: 2 }, stats: { ...pet.stats, hunger: 35, energy: 90, health: 100, thirst: 90 } });
  const before = await save(); await openActions(page); await page.getByTestId('pet-actions').getByRole('button', { name: '喂食', exact: true }).click();
  for (let n = 0; n < 2; n++) { await (await selectPocket(page, 'biscuit', '熊熊饼干')).click(); await advance(n === 0 ? 61000 : 3000); }
  assert.equal((await save()).inventory.biscuit, 0); await openPlay();
  await expect(spirit().locator('.pet-invitation-habit')).toContainText('熊熊饼干');
  assert.ok((await chat('你喜欢吃什么？')).includes('熊熊饼干'));
  assert.ok((await chat('我喜欢什么？')).includes('还没告诉'), 'pet familiarity is not claimed as the user\'s own preference');
  await chat('叫我小米');
  const care = (await memory()).events.find(event => event.kind === 'feed' && event.detail.includes('熊熊饼干')); assert.ok(care);
  await forgetEvent(care.detail); await expect(spirit()).not.toContainText('熊熊饼干');
  assert.ok(!(await chat('你喜欢吃什么？')).includes('熊熊饼干'));
  await advance(); await enterHome(page); await roomTab(page, '设置');
  const form = page.locator('.room-rename'); await form.getByRole('textbox', { name: '拉姆的新名字', exact: true }).fill('小蘑菇'); await form.getByRole('button', { name: '保存', exact: true }).click();
  await toDesktop(page); await openPlay(); await spirit().getByRole('button', { name: '叫叫小蘑菇', exact: true }).click();
  await expect(page.locator('.compact-bubble')).toContainText('小蘑菇');
  assert.equal((await save()).createdAt, before.createdAt); assert.equal((await save()).coins, before.coins);
  await advance();
  console.log('PASS familiar food comes from two real consumptions, disappears when forgotten, stays separate from user likes, and name replies follow an actual rename without readoption');
}

async function automaticInvitation() {
  await page.evaluate(() => {
    const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')), now = Date.now();
    localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: false, presence: true, presenceMinutes: 10, lively: false, reminders: true }));
    localStorage.setItem(`ramu-presence-v1:${pet.createdAt}`, JSON.stringify({ version: 1, petId: String(pet.createdAt), history: ['work', 'progress', 'culture'].map((topic, index) => ({ id: `${topic}-qa-${index}`, topic, at: now - (90 - index * 10) * 60_000 })) }));
  });
  await page.reload(); await page.clock.runFor(100); const played = actualPlay(await memory());
  await advance(184000); const bubble = page.getByRole('button', { name: '回应拉姆的话', exact: true }); await expect(bubble).toBeVisible();
  assert.ok((await bubble.innerText()).includes('小米'), 'automatic invitation may address the saved nickname');
  await bubble.click(); await expect(spirit()).toBeVisible(); await expect(offer()).toBeVisible();
  assert.deepEqual(actualPlay(await memory()), played, 'an unanswered automatic offer never becomes a completed memory');
  await page.getByRole('button', { name: '关闭小窗', exact: true }).click(); await openPlay();
  await page.getByRole('button', { name: '听拉姆说一句', exact: true }).click();
  await page.getByRole('button', { name: '回应拉姆的话', exact: true }).click();
  await expect(page.getByTestId('companion-panel')).toHaveAttribute('aria-label', '拉姆对话');
  await page.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')); pet.sleeping = true; pet.stats.energy = 40; pet.lastTick = Date.now(); localStorage.setItem('ramu-house-save-v1', JSON.stringify(pet)); });
  await page.reload(); await page.clock.runFor(100); await openPlay();
  await expect(spirit().getByRole('button', { name: '叫叫小蘑菇', exact: true })).toBeDisabled();
  await expect(spirit().getByRole('button', { name: '让拉姆提个主意', exact: true })).toBeDisabled();
  await spirit().getByRole('button', { name: '叫叫小蘑菇', exact: true }).evaluate(button => button.click());
  assert.equal((await save()).sleeping, true); assert.equal(await page.getByRole('timer').count(), 0);
  console.log('PASS scheduled invitation uses existing cadence, nickname bubble routes to actionable play, manual speech still routes to chat, and sleeping controls never wake the pet');
}

(async () => {
  for (let n = 0; n < 100; n++) { if (server.exitCode !== null) throw Error(output); try { if ((await fetch(url)).ok) break; } catch {} if (n === 99) throw Error(output); await new Promise(resolve => setTimeout(resolve, 100)); }
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: 'Asia/Shanghai' });
  const errors = [], broken = [], ai = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('response', response => { if (response.status() >= 400 && /\.(png|mp3)(?:[?#]|$)/.test(response.url())) broken.push(response.url()); }); page.on('request', request => { if (request.url().includes('api.deepseek.com')) ai.push(request.url()); });
  await page.addInitScript(() => { if (!localStorage.getItem('ramu-house-preferences-v2')) localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: false, presence: false, lively: false })); });
  await page.clock.install(); await page.goto(url); await adopt(page, '红色', '小芽'); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await namesAndOffers(); await politeDeferral(); await realHabitsAndRename(); await automaticInvitation();
  assert.deepEqual(errors, []); assert.deepEqual(broken, []); assert.deepEqual(ai, []);
  console.log('PASS no renderer errors, broken artwork or automatic DeepSeek requests');
})().catch(async error => { console.error(error); process.exitCode = 1; if (page && !page.isClosed()) await page.screenshot({ path: path.join(root, 'artifacts/v19-spirit-failure.png') }).catch(() => {}); }).finally(async () => { await browser?.close(); server.kill('SIGTERM'); });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
const { adopt, enterHome, roomTab, openActions } = require('./smoke-helpers.cjs');

const root = path.resolve(__dirname, '..');
const url = 'http://127.0.0.1:5205';
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5205', '--strictPort'], { cwd: root, stdio: 'pipe' });
let browser, activePage, output = '';
server.stdout.on('data', data => output += data);
server.stderr.on('data', data => output += data);
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));
const memory = page => page.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')); return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`)); });
const inventorySize = state => Object.values(state.inventory).reduce((sum, count) => sum + count, 0);

async function noHorizontalOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'the room and its dialog fit the viewport');
  const box = await page.locator('.game-panel').last().boundingBox();
  if (box) assert.ok(box.x >= 0 && box.x + box.width <= page.viewportSize().width + 1, 'the dialog stays within the window');
}

async function openDecor(page) {
  const close = page.getByRole('button', { name: '关闭面板', exact: true });
  if (await close.isVisible()) await close.click();
  await page.getByRole('button', { name: '布置小屋', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '布置小屋', exact: true });
  await expect(dialog).toBeVisible();
  const gallery = dialog.getByRole('group', { name: '选择小屋背景', exact: true });
  await expect(gallery).toBeInViewport();
  return { dialog, gallery, settings: dialog.locator('.room-settings') };
}

async function inspectSheet(page, phase, selector = '.cottage-scene > .time-scene-art > .time-scene-sheet') {
  const sheet = page.locator(selector);
  await sheet.evaluate(image => image.decode());
  const result = await sheet.evaluate(image => {
    const art = image.parentElement.getBoundingClientRect(), rect = image.getBoundingClientRect();
    return {
      width: image.naturalWidth, height: image.naturalHeight,
      x: ((art.left + art.right) / 2 - rect.left) / rect.width,
      y: ((art.top + art.bottom) / 2 - rect.top) / rect.height,
      covers: rect.left <= art.left + 1 && rect.right >= art.right - 1 && rect.top <= art.top + 1 && rect.bottom >= art.bottom - 1,
      filter: getComputedStyle(image).filter,
    };
  });
  assert.ok(result.width >= 1200 && result.height >= 800, 'the scene uses the full generated source');
  assert.ok(result.covers, 'one scene fills the artwork area without gutters');
  assert.ok(Math.abs(result.x - (['noon', 'night'].includes(phase) ? .75 : .25)) < .005, 'the visible center belongs to the intended scene column');
  assert.ok(Math.abs(result.y - (['dusk', 'night'].includes(phase) ? .75 : .25)) < .005, 'the visible center belongs to the intended scene row');
  assert.equal(result.filter, 'none', 'time-specific generated artwork is not darkened again');
}

async function reviewRooms(page) {
  const backgrounds = await page.evaluate(async () => (await import('/src/room-media.ts')).ROOM_BACKGROUNDS);
  const added = backgrounds.filter(background => background.src.includes('/v18-'));
  assert.equal(backgrounds.length, 9); assert.equal(added.length, 3);
  const phases = [['morning', '早晨'], ['noon', '白天'], ['dusk', '傍晚'], ['night', '夜晚']];
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1000, height: 720 }]) {
    await page.setViewportSize(viewport);
    const { dialog, gallery, settings } = await openDecor(page);
    await expect(gallery.getByRole('button')).toHaveCount(9);
    for (const background of added) {
      const choice = gallery.getByRole('button', { name: background.label, exact: true });
      await choice.click(); await expect(choice).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.cottage-scene')).toHaveAttribute('data-background', background.id);
      for (const [phase, label] of phases) {
        await settings.getByRole('button', { name: `预览${label}`, exact: true }).click();
        await expect(page.locator('.cottage-scene')).toHaveAttribute('data-phase', phase);
        await inspectSheet(page, phase); await noHorizontalOverflow(page);
      }
    }
    await page.screenshot({ path: path.join(root, `artifacts/v18-decor${viewport.width === 1000 ? '-compact' : ''}.png`) });
    await dialog.getByRole('button', { name: '关闭面板', exact: true }).click();
    await page.screenshot({ path: path.join(root, `artifacts/v18-room${viewport.width === 1000 ? '-compact' : ''}.png`) });
  }
  const last = added.at(-1);
  await page.reload(); await page.getByTestId('desktop-character').waitFor(); await enterHome(page);
  await expect(page.locator('.cottage-scene')).toHaveAttribute('data-background', last.id);
  await expect(page.locator('.cottage-scene')).toHaveAttribute('data-time-mode', 'auto');
  const localPhase = await page.evaluate(async () => (await import('/src/scene-time.ts')).scenePhaseAt(new Date()));
  await expect(page.locator('.cottage-scene')).toHaveAttribute('data-phase', localPhase);
  await inspectSheet(page, localPhase);
  console.log('PASS direct decoration entry, nine readable scene choices, all twelve new time panels at two desktop sizes, real quadrant cropping and restart-safe automatic time');
  return last;
}

async function reviewTreasure(page, background) {
  await page.setViewportSize({ width: 1180, height: 820 });
  const before = await save(page), eventsBefore = (await memory(page)).events.filter(event => event.kind === 'game');
  assert.equal(before.color, 'pink'); assert.equal(before.growth < 1, true, 'a newly adopted seed can join the search');
  await roomTab(page, '游戏'); await page.getByRole('button', { name: '开始寻宝', exact: true }).click();
  let game = page.getByTestId('treasure-game'); await expect(game).toHaveAttribute('data-phase', 'ready');
  await expect(game.locator('.treasure-heading')).toContainText(background.label);
  assert.ok((await game.locator('.treasure-scene-art img').getAttribute('src')).includes(background.src));
  const expectedPhase = await page.locator('.cottage-scene').getAttribute('data-phase');
  await expect(game.locator('.treasure-scene')).toHaveAttribute('data-scene-phase', expectedPhase);
  await inspectSheet(page, expectedPhase, '.treasure-scene-sheet');
  await game.getByTestId('treasure-start').click(); await expect(game).toHaveAttribute('data-phase', 'playing');
  await game.locator('canvas[data-loaded=true]').waitFor();
  await expect(game.locator('.ram-sprite')).toHaveAttribute('data-stage', '0');
  await expect(game.locator('.ram-sprite')).toHaveAttribute('data-color', 'pink');
  const targets = await game.locator('[data-target-id]').evaluateAll(nodes => nodes.map(node => node.dataset.targetId));
  const objects = await game.locator('[data-treasure-id]').evaluateAll(nodes => nodes.map(node => node.dataset.treasureId));
  assert.equal(targets.length, 3); assert.equal(new Set(targets).size, 3); assert.equal(objects.length, 6);
  await game.locator('.treasure-object img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  const wrong = objects.find(id => !targets.includes(id));
  await game.locator(`[data-treasure-id="${wrong}"]`).click();
  await expect(game.locator('[data-found=true]')).toHaveCount(0);
  await expect(game.locator('.treasure-feedback')).toContainText('不在清单');
  await game.getByRole('button', { name: '拉姆提示', exact: true }).click();
  const hinted = game.locator('.treasure-object.is-hinted'); await expect(hinted).toHaveCount(1);
  const first = await hinted.getAttribute('data-treasure-id'); assert.ok(targets.includes(first));
  await hinted.evaluate(button => { button.click(); button.click(); });
  await expect(game.locator(`[data-target-id="${first}"]`)).toHaveAttribute('data-found', 'true');
  await expect(game.locator('[data-found=true]')).toHaveCount(1);
  await expect(game.getByLabel('已经找到1件，共3件', { exact: true })).toBeVisible();
  await expect(game.locator('.treasure-feedback')).toContainText('找到');
  await expect(game.locator(`[data-treasure-id="${first}"] .treasure-pickup`)).toHaveCount(1);
  assert.deepEqual((await save(page)).inventory, before.inventory, 'finding a clue does not independently create inventory');
  const remaining = targets.find(id => id !== first), remainingButton = game.locator(`[data-treasure-id="${remaining}"]`);
  await game.getByRole('button', { name: '暂停寻宝', exact: true }).click();
  await expect(remainingButton).toBeDisabled(); await remainingButton.evaluate(button => button.click());
  await expect(game.locator('[data-found=true]')).toHaveCount(1);
  await game.getByRole('button', { name: '继续寻宝', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(remainingButton).toBeDisabled(); await remainingButton.evaluate(button => button.click());
  await expect(game.locator('[data-found=true]')).toHaveCount(1);
  await page.evaluate(() => {
    delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(remainingButton).toBeEnabled();
  for (const viewport of [{ width: 1180, height: 820 }, { width: 1000, height: 720 }]) {
    await page.setViewportSize(viewport); await noHorizontalOverflow(page);
    const box = await game.boundingBox(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height + 1);
    const sceneWidth = await game.evaluate(dialog => {
      const style = getComputedStyle(dialog);
      return { actual: dialog.querySelector('.treasure-scene').getBoundingClientRect().width, expected: dialog.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
    });
    assert.ok(Math.abs(sceneWidth.actual - sceneWidth.expected) < 1, 'the play scene fills the dialog instead of shrinking into a narrow left column');
    await page.screenshot({ path: path.join(root, `artifacts/v18-treasure${viewport.width === 1000 ? '-compact' : ''}.png`) });
  }
  await game.getByRole('button', { name: '退出游戏，本局不领取奖励', exact: true }).click();
  await expect(game).toHaveCount(0);
  const abandoned = await save(page);
  for (const key of ['coins', 'inventory', 'completedGames', 'lastRewardAt']) assert.deepEqual(abandoned[key], before[key], 'an abandoned search has no reward');
  assert.deepEqual((await memory(page)).events.filter(event => event.kind === 'game'), eventsBefore, 'an abandoned search is not a completed shared memory');
  console.log('PASS seed participation, real selected scene/time, matching pickups and checklist, duplicate/wrong-click guards, gentle hints, paused/hidden input freeze and no abandoned-round reward');

  await page.getByRole('button', { name: '开始寻宝', exact: true }).click(); game = page.getByTestId('treasure-game');
  await game.getByTestId('treasure-start').click();
  const winningTargets = await game.locator('[data-target-id]').evaluateAll(nodes => nodes.map(node => node.dataset.targetId));
  for (const id of winningTargets) await game.locator(`[data-treasure-id="${id}"]`).click();
  await expect(game).toHaveAttribute('data-phase', 'collected');
  assert.equal((await save(page)).coins, before.coins, 'all found items wait for the explicit single claim');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await game.getByRole('button', { name: '收好宝物', exact: true }).evaluate(button => button.click());
  await expect(game).toHaveAttribute('data-phase', 'collected');
  assert.equal((await save(page)).coins, before.coins, 'hidden-window clicks cannot claim a delayed reward');
  await page.evaluate(() => {
    delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'));
  });
  await game.getByRole('button', { name: '收好宝物', exact: true }).evaluate(button => { button.click(); button.click(); });
  await expect(game).toHaveAttribute('data-phase', 'finished');
  const after = await save(page), receipt = await game.locator('.treasure-receipt b').allTextContents();
  assert.ok(after.coins > before.coins); assert.equal(after.coins - before.coins, Number(receipt[0]));
  assert.equal(after.completedGames, before.completedGames + 1); assert.equal(inventorySize(after) - inventorySize(before), Number(receipt[1]));
  assert.equal(Number(receipt[1]), 1); assert.ok(after.growth < 1, 'the minigame does not skip seed growth');
  const shared = (await memory(page)).events.filter(event => event.kind === 'game');
  assert.equal(shared.length, eventsBefore.length + 1); assert.ok(shared.at(-1).detail.includes('小屋寻宝')); assert.ok(shared.at(-1).detail.includes(background.label));
  await game.getByRole('button', { name: '完成', exact: true }).click(); await expect(game).toHaveCount(0);
  await page.reload(); await page.getByTestId('desktop-character').waitFor();
  const restarted = await save(page); assert.equal(restarted.coins, after.coins); assert.deepEqual(restarted.inventory, after.inventory); assert.equal(restarted.completedGames, after.completedGames);
  assert.deepEqual((await memory(page)).events.filter(event => event.kind === 'game'), shared);
  await openActions(page); await page.getByTestId('pet-actions').getByRole('button', { name: '和拉姆说话', exact: true }).click();
  const chat = page.getByTestId('companion-panel');
  await chat.getByRole('textbox', { name: '和拉姆说话', exact: true }).fill('上次寻宝在哪里？');
  await chat.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(chat.getByRole('log')).toContainText(background.label); await expect(chat.getByRole('log')).toContainText('小屋寻宝');
  console.log('PASS one explicit actual reward, no duplicate payout or accelerated growth, completed game/scene memory, reload persistence and warm factual offline recall');
}

(async () => {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(url)).ok) break; } catch {}
    if (i === 99) throw new Error('Vite did not start: ' + output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, timezoneId: 'Asia/Shanghai' }); activePage = page;
  const errors = [], badAssets = [], aiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && /\.(png|mp3)(?:[?#]|$)/.test(response.url())) badAssets.push(response.url()); });
  page.on('request', request => { if (request.url().includes('api.deepseek.com')) aiRequests.push(request.url()); });
  await page.addInitScript(() => {
    localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: true, presence: false, lively: false }));
    const media = JSON.parse(localStorage.getItem('ramu-room-media-v1') || '{}');
    localStorage.setItem('ramu-room-media-v1', JSON.stringify({ ...media, musicEnabled: false }));
  });
  await page.goto(url); await adopt(page, '粉色', '小桃'); await enterHome(page);
  const background = await reviewRooms(page);
  await reviewTreasure(page, background);
  assert.deepEqual(errors, []); assert.deepEqual(badAssets, []); assert.deepEqual(aiRequests, []);
  console.log('PASS no renderer errors, broken artwork or automatic DeepSeek requests');
})().catch(async error => {
  console.error(error); process.exitCode = 1;
  if (activePage) await activePage.screenshot({ path: path.join(root, 'artifacts/v18-iteration-failure.png') }).catch(() => {});
}).finally(async () => { await browser?.close(); server.kill('SIGTERM'); });

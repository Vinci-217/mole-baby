const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

// Use an isolated browser profile and a dedicated server; no user save is touched.
const root = path.resolve(__dirname, '..');
const port = 5174;
const url = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'pipe' });
let serverOutput = '';
child.stdout.on('data', chunk => { serverOutput += chunk; });
child.stderr.on('data', chunk => { serverOutput += chunk; });
let serverFailed = false;
child.once('error', () => { serverFailed = true; });
child.once('exit', () => { serverFailed = true; });
let browser;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverFailed) throw new Error(`Test server failed: ${serverOutput}`);
    try { if ((await fetch(url)).ok) break; } catch { /* server is starting */ }
    if (attempt === 99) throw new Error('Vite did not become ready');
    await pause(100);
  }
  const systemBrowser = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(file => fs.existsSync(file));
  browser = await chromium.launch({ ...(systemBrowser ? { executablePath: systemBrowser } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const retiredAssets = [];
  page.on('request', request => { if (/\/assets\/(?:classic-room|classic-icons|classic-game-props|ram-generated-sheet)\.png(?:[?#]|$)/.test(request.url())) retiredAssets.push(request.url()); });
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  await page.goto(url);
  await page.waitForFunction(() => document.querySelectorAll('.adoption-colors canvas[data-loaded=true]').length === 4);
  assert.equal(await page.locator('.adoption-colors svg').count(), 0);
  await page.getByLabel('选择蓝色拉姆').click();
  await page.getByLabel('叫它什么呢？').fill('小蓝');
  await page.getByRole('button', { name: '带拉姆回家！' }).click();
  await page.waitForFunction(() => document.querySelector('.scene-character canvas')?.dataset.loaded === 'true');
  assert.equal((await state()).color, 'blue');
  assert.equal((await state()).growth, 180);
  assert.equal(await page.locator('[data-fallback=true]').count(), 0);
  await page.getByRole('button', { name: '摸摸拉姆', exact: true }).click();
  assert.ok((await state()).stats.happiness > 83.5);
  await page.getByRole('button', { name: '食物口袋', exact: true }).click();
  for (const [id, name] of [['180027', '可可果'], ['180017', '熊熊饼干'], ['180008', '浆果果汁']]) {
    const image = page.getByRole('dialog').locator(`img[src$="/items/${id}.png"]`).first();
    await image.waitFor({ state: 'visible' });
    assert.ok(await image.evaluate(async element => { await element.decode(); return element.naturalWidth > 0 && element.naturalHeight > 0; }), `${name}: original food PNG must decode`);
    assert.ok(await page.getByRole('dialog').getByText(name, { exact: true }).isVisible());
  }
  assert.equal(await page.locator('svg').count(), 0);
  await page.getByRole('dialog').getByRole('button', { name: '喂一份' }).first().click();
  assert.equal((await state()).inventory.berry, 4);
  await page.getByRole('button', { name: '＋ 12 摩尔豆购买', exact: true }).click();
  assert.equal((await state()).coins, 88);
  await page.getByLabel('关闭面板').click();
  await page.getByRole('button', { name: '洗澡', exact: true }).click();
  assert.ok((await state()).stats.cleanliness > 99);
  await page.getByRole('button', { name: '休息', exact: true }).click();
  assert.equal((await state()).sleeping, true);
  await page.getByRole('button', { name: '叫醒', exact: true }).click();
  await page.getByRole('button', { name: '和拉姆说话', exact: true }).click();
  await page.getByRole('textbox', { name: '和拉姆说话' }).fill('今天开心吗？');
  await page.getByLabel('发送消息').click();
  assert.ok(await page.locator('.classic-dialogue').getByText('和你在一起就很开心', { exact: false }).isVisible());
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByLabel('拉姆的新名字').fill('小叶子');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const download = await exported;
  const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(backup.name, '小叶子');
  const previous = await state();
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await page.getByText('这个存档无法读取，原来的拉姆仍然保留。', { exact: true }).waitFor();
  assert.equal((await state()).name, previous.name);
  backup.name = '叶叶';
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByText('存档已恢复，欢迎回来！', { exact: true }).waitFor();
  const beforeLegacyPrefs = await state();
  // An existing v0.2 preference must migrate without restoring generated art
  // or replacing the separately stored pet save.
  await page.evaluate(() => localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: true, artStyle: 'hd' })));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.scene-character canvas')?.dataset.loaded === 'true');
  assert.equal(await page.locator('[data-art-style=hd], .ram-hd-frame, [data-fallback=true]').count(), 0);
  assert.equal((await state()).name, '叶叶');
  assert.equal((await state()).color, beforeLegacyPrefs.color);
  assert.equal((await state()).coins, beforeLegacyPrefs.coins);
  assert.deepEqual((await state()).inventory, beforeLegacyPrefs.inventory);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-preferences-v2'))), { sound: false, quiet: true });
  await page.getByRole('button', { name: '陪伴设置', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '高清重绘', exact: true }).count(), 0);
  await page.getByRole('switch', { name: '安静陪伴' }).click();
  await page.reload();
  await page.getByRole('button', { name: '陪伴设置', exact: true }).click();
  assert.equal(await page.getByRole('switch', { name: '安静陪伴' }).getAttribute('aria-checked'), 'false');
  await page.getByLabel('关闭面板').click();
  console.log('PASS original PNG adoption/food, care, chat, shopping, backups, legacy art preference migration and restart persistence');

  // A valid fixture just before the threshold exercises visible growth changes.
  await page.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')); pet.growth = 59; localStorage.setItem('ramu-house-save-v1', JSON.stringify(pet)); });
  await page.reload(); await page.getByRole('button', { name: '摸摸拉姆', exact: true }).click();
  assert.ok(await page.locator('.scene-character [data-stage="1"]').isVisible());
  console.log('PASS original growth shape changes at the threshold');

  await page.getByRole('button', { name: '游乐时光', exact: true }).click();
  await page.getByRole('button', { name: '开始翻牌', exact: true }).click();
  const beforeMemory = await state();
  await page.getByTestId('memory-start').click();
  const kinds = await page.getByTestId('memory-card').evaluateAll(cards => cards.map(card => Number(card.dataset.kind)));
  assert.equal(kinds.length, 12); assert.equal(new Set(kinds).size, 6);
  assert.equal(await page.locator('svg').count(), 0);
  await page.waitForTimeout(3150);
  const pairs = {}; kinds.forEach((kind, index) => (pairs[kind] ??= []).push(index));
  for (const pair of Object.values(pairs)) { await page.getByTestId('memory-card').nth(pair[0]).click(); await page.getByTestId('memory-card').nth(pair[1]).click(); }
  await page.getByTestId('memory-result').waitFor({ timeout: 15000 });
  const afterMemory = await state();
  assert.equal(afterMemory.coins, beforeMemory.coins + 24);
  assert.equal(afterMemory.inventory.juice, beforeMemory.inventory.juice + 1);
  assert.equal(afterMemory.completedGames, beforeMemory.completedGames + 1);
  await page.waitForTimeout(400); assert.equal((await state()).completedGames, afterMemory.completedGames);
  await page.getByRole('button', { name: '收好奖励', exact: true }).click();
  console.log('PASS PNG matching cards, all pairs, single completion and correct rewards');

  await page.getByRole('button', { name: '开始接果子', exact: true }).click();
  const beforeFruit = await state();
  await page.getByTestId('fruit-game-start').click();
  const basket = page.getByTestId('fruit-game-basket');
  await basket.locator('canvas[data-loaded=true]').waitFor();
  assert.equal(await page.locator('svg').count(), 0);
  const initialLeft = await basket.evaluate(node => parseFloat(node.style.left));
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft');
  assert.ok(await basket.evaluate(node => parseFloat(node.style.left)) < initialLeft - 5);
  const arena = await page.getByTestId('game-arena').boundingBox();
  const started = Date.now();
  while (!(await page.getByTestId('fruit-game-result').isVisible())) {
    const fruits = await page.locator('.fruit-falling-berry').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y }; }).sort((a, b) => b.y - a.y));
    if (fruits.length) await page.mouse.move(fruits[0].x, arena.y + arena.height * .9);
    if (Date.now() - started > 26000) throw new Error('Fruit game did not finish');
    await page.waitForTimeout(90);
  }
  assert.equal(Number(await page.locator('.fruit-result > p strong').textContent()), 10);
  const afterFruit = await state();
  assert.equal(afterFruit.coins, beforeFruit.coins + 24);
  assert.equal(afterFruit.completedGames, beforeFruit.completedGames + 1);
  await page.getByRole('button', { name: '再来一局', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal((await state()).completedGames, afterFruit.completedGames);
  console.log('PASS original fruit/Ram game, keyboard/mouse control, full score, rewards, early exit');

  await page.getByRole('button', { name: '让拉姆回到桌面陪我 ▸', exact: true }).click();
  await page.locator('.desktop-character').hover();
  await page.getByRole('button', { name: '陪我专注', exact: true }).click();
  await page.locator('.pet-focus').waitFor();
  assert.ok(await page.getByRole('button', { name: '结束专注', exact: true }).isVisible());
  await page.getByRole('button', { name: '结束专注', exact: true }).click();
  await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await page.getByRole('button', { name: '和拉姆说话', exact: true }).click();
  await page.getByRole('dialog', { name: '和拉姆说说话' }).waitFor();
  await page.getByLabel('关闭面板').click();
  console.log('PASS desktop preview, focus timer and context-menu care panel');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: '食物口袋', exact: true }).click();
  assert.ok(await page.getByRole('button', { name: '喂一份' }).first().isVisible());
  assert.equal(await page.locator('svg').count(), 0);
  assert.deepEqual(retiredAssets, [], 'The complete flow must not request replaced generated artwork');
  assert.deepEqual(errors, []);
  console.log('PASS narrow-screen inventory, original pet/items and reference-guided scene, no SVG drawings and zero browser errors');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); child.kill(); });

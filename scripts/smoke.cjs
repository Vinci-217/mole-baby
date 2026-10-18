const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const url = 'http://127.0.0.1:5174';
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { cwd: root, stdio: 'pipe' });
let output = '', failed = false, browser;
server.stdout.on('data', x => output += x); server.stderr.on('data', x => output += x); server.on('error', () => failed = true); server.on('exit', () => failed = true);
const pause = ms => new Promise(r => setTimeout(r, ms));
const artifacts = path.join(root, 'artifacts');
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));
async function openActions(page) { if (!(await page.getByTestId('pet-actions').isVisible())) await page.getByTestId('desktop-character').click(); }
async function say(page, text) {
  const panel = page.getByTestId('companion-panel');
  await panel.getByRole('tab', { name: '说话', exact: true }).click();
  await panel.getByRole('textbox', { name: '和拉姆说话', exact: true }).fill(text);
  await panel.getByRole('button', { name: '发送消息', exact: true }).click();
}
async function backgroundURL(page) { return page.locator('.cottage-scene').evaluate(node => getComputedStyle(node).backgroundImage); }
async function importBackup(panel, value) {
  await panel.locator('input[type=file][accept*=json]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
}
async function checkReminders(fixture) {
  for (const mode of ['enabled', 'quiet', 'sleeping', 'focus']) {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    const now = Date.now();
    await page.clock.install({ time: now });
    await page.addInitScript(({ fixture, now, mode }) => {
      localStorage.setItem('ramu-house-save-v1', JSON.stringify({ ...fixture, createdAt: now, lastTick: now, sleeping: mode === 'sleeping' }));
      localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: mode === 'quiet', reminders: true, reminderMinutes: mode === 'focus' ? 20 : 40 }));
    }, { fixture, now, mode });
    await page.goto(url); await page.getByTestId('desktop-character').waitFor();
    if (mode === 'focus') {
      await openActions(page); await page.getByRole('button', { name: '更多互动', exact: true }).click();
      await page.getByTestId('companion-panel').getByRole('button', { name: '陪我专注 25 分钟', exact: true }).click();
    }
    // Fast-forward the real app timers only in these isolated pages. The
    // separate game flow above always uses ordinary elapsed browser time.
    await page.clock.fastForward((mode === 'focus' ? 21 : 41) * 60000);
    const hasReminder = () => page.evaluate(() => {
      const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1'));
      const memory = JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`) || '{}');
      return (memory.events || []).some(event => event.kind === 'reminder');
    });
    if (mode === 'enabled') {
      await expect(page.locator('.compact-bubble')).toContainText('站起来伸伸懒腰');
      await expect(page.locator('.compact-bubble')).toHaveClass(/visible/);
      await expect.poll(hasReminder).toBe(true);
    } else {
      assert.equal(await hasReminder(), false, `${mode} suppresses work-break reminders`);
      await expect(page.locator('.compact-bubble')).not.toHaveClass(/visible/);
    }
    await page.close();
  }
  console.log('PASS real work-break timers remind after 40 minutes and stay quiet during quiet mode, pet sleep and active focus');
}
async function checkFourSeedColors() {
  const samples = [];
  for (const [id, label] of [['yellow', '黄色'], ['red', '红色'], ['blue', '蓝色'], ['pink', '粉色']]) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.goto(url);
    assert.equal(await page.getByRole('button', { name: /^选择.+色拉姆$/ }).count(), 4, 'only four original colors are selectable');
    await page.getByRole('button', { name: `选择${label}拉姆`, exact: true }).click();
    await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
    const canvas = page.getByTestId('desktop-character').locator('.seed-body-frame[data-loaded=true]');
    await expect(canvas).toHaveAttribute('data-color', id);
    samples.push(await canvas.evaluate(canvas => {
      const rgba = canvas.getContext('2d').getImageData(45, 58, 1, 1).data;
      return Array.from(rgba);
    }));
    assert.equal((await save(page)).color, id);
    await page.reload(); await expect(canvas).toHaveAttribute('data-color', id);
    assert.equal((await save(page)).color, id, 'selected seed color survives restart');
    await page.close();
  }
  assert.equal(new Set(samples.map(p => p.slice(0, 3).join(','))).size, 4, 'seed bodies are actually four different painted colors');
  assert.ok(samples.every(([r, g, b, a]) => a > 200 && Math.min(r, g, b) < 240), 'seed body sample must be visible and colored, not the old white embryo');
  console.log('PASS exactly four original seed colors, distinct canvas pixels and selected-color persistence');
}
(async () => {
  for (let i = 0; i < 100; i++) { if (failed) throw Error(output); try { if ((await fetch(url)).ok) break; } catch {} if (i === 99) throw Error('Vite startup timeout'); await pause(100); }
  const executablePath = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(x => fs.existsSync(x));
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  fs.mkdirSync(artifacts, { recursive: true });
  await checkFourSeedColors();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.setDefaultTimeout(15000);
  // Observe real HTMLAudioElements; do not stub playback or import decoding.
  await page.addInitScript(() => {
    const Original = window.Audio; window.__ramuAudio = [];
    window.Audio = function (...args) { const audio = new Original(...args); window.__ramuAudio.push(audio); return audio; };
    window.Audio.prototype = Original.prototype;
  });
  const errors = [], assetFailures = [], aiRequests = [];
  page.on('request', request => { if (request.url().includes('api.deepseek.com')) aiRequests.push(request.url()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', request => {
    // Changing/pausing an audio source deliberately cancels an in-flight range
    // request. Playback and decoding are checked independently below.
    if (/\.(?:mp3|wav)(?:[?#]|$)/.test(request.url()) && request.failure()?.errorText === 'net::ERR_ABORTED') return;
    if (/\.(?:png|mp3|wav)(?:[?#]|$)/.test(request.url())) assetFailures.push(request.url());
  });
  await page.goto(url);
  assert.equal(await page.getByRole('radio').first().isChecked(), true, 'start with the actual planted seed');
  await page.getByLabel('选择蓝色拉姆').click(); await page.locator('#pet-name').fill('小蓝');
  await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
  const character = page.getByTestId('desktop-character');
  await character.locator('.seed-body-frame[data-loaded=true]').waitFor();
  const initial = await save(page);
  assert.equal(initial.growth, 0); assert.equal(initial.coins, 100);
  assert.ok(Object.values(initial.inventory).every(count => count === 0), 'adoption starts with an empty bag, not free care supplies');
  assert.equal(await page.locator('.cottage-scene').count(), 0);
  assert.equal(await page.getByTestId('pet-actions').count(), 0, 'hovering alone must not expand the controls');
  assert.ok((await character.boundingBox()).width <= 110, 'the pet is a small desktop companion');
  const pot = character.locator('.seed-pot-original'); await pot.evaluate(i => i.decode());
  const potBefore = await pot.boundingBox(), c = await character.boundingBox();
  await page.mouse.move(c.x + 50, c.y + 60); await page.mouse.down();
  await page.mouse.move(c.x + 85, c.y + 45); await page.waitForTimeout(180);
  assert.notEqual(await character.locator('.seed-body-original').evaluate(n => n.style.transform), 'rotate(0deg)');
  const during = await pot.boundingBox(); assert.equal(during.x, potBefore.x); assert.equal(during.y, potBefore.y);
  await page.mouse.up(); assert.equal((await pot.boundingBox()).x, potBefore.x);
  console.log('PASS true original planted seed, small default companion, fixed pot with body-only drag response');

  await openActions(page); await page.getByRole('button', { name: '喂食', exact: true }).click();
  const panel = page.getByTestId('companion-panel'); await panel.waitFor();
  const pocket = panel.locator('.care-pocket');
  assert.equal((await panel.boundingBox()).width, 332);
  assert.equal(await page.locator('.cottage-scene').count(), 0, 'care never opens the room');
  await expect(pocket.getByRole('button', { name: '我的背包', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(pocket.getByRole('button', { name: '使用熊熊饼干', exact: true })).toBeDisabled();
  assert.ok(await pocket.locator('article[data-item-id]').count() > 3, 'food is a catalog, not a single fruit');
  await pocket.getByRole('button', { name: '拉姆商店', exact: true }).click();
  await pocket.getByRole('button', { name: '购买熊熊饼干', exact: true }).click();
  await expect.poll(async () => (await save(page)).coins).toBe(85);
  assert.equal((await save(page)).inventory.biscuit, 1);
  await pocket.getByRole('button', { name: '我的背包', exact: true }).click();
  const beforeFood = await save(page); await pocket.getByRole('button', { name: '使用熊熊饼干', exact: true }).click();
  await expect.poll(async () => (await save(page)).inventory.biscuit).toBe(0);
  assert.ok((await save(page)).stats.hunger > beforeFood.stats.hunger + 10);
  await pocket.getByRole('button', { name: '饮品', exact: true }).click();
  assert.ok(await pocket.locator('article[data-item-id]').count() > 2);
  await pocket.getByRole('button', { name: '拉姆商店', exact: true }).click();
  await pocket.getByRole('button', { name: '购买麦香牛奶', exact: true }).click();
  await expect.poll(async () => (await save(page)).coins).toBe(75);
  await pocket.getByRole('button', { name: '我的背包', exact: true }).click();
  const beforeDrink = await save(page); await pocket.getByRole('button', { name: '使用麦香牛奶', exact: true }).click();
  await expect.poll(async () => (await save(page)).inventory['180002']).toBe(0);
  assert.ok((await save(page)).stats.thirst > beforeDrink.stats.thirst + 10);
  assert.ok(Math.abs((await save(page)).stats.hunger - beforeDrink.stats.hunger) < 1, 'drink restores water without pretending to be food');
  await page.getByRole('button', { name: '洗澡', exact: true }).click();
  await expect(pocket.getByRole('button', { name: '清洁', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await pocket.getByRole('button', { name: '饮品', exact: true }).click();
  await page.getByRole('button', { name: '洗澡', exact: true }).click();
  await expect(pocket.getByRole('button', { name: '清洁', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const beforeFreeWash = await save(page); await expect(pocket.getByRole('button', { name: '使用泡泡浴', exact: true })).toBeDisabled();
  assert.equal((await save(page)).inventory['180003'], 0, 'wash shortcut only opens the clean bag');
  assert.ok(Math.abs((await save(page)).stats.cleanliness - beforeFreeWash.stats.cleanliness) < 1);
  await pocket.getByRole('button', { name: '拉姆商店', exact: true }).click();
  await pocket.getByRole('button', { name: '购买泡泡浴', exact: true }).click();
  await expect.poll(async () => (await save(page)).coins).toBe(65);
  await pocket.getByRole('button', { name: '我的背包', exact: true }).click();
  const beforeWash = await save(page); await pocket.getByRole('button', { name: '使用泡泡浴', exact: true }).click();
  await expect.poll(async () => (await save(page)).inventory['180003']).toBe(0);
  assert.ok((await save(page)).stats.cleanliness > beforeWash.stats.cleanliness + 5);
  await pocket.getByRole('button', { name: '药水', exact: true }).click();
  await pocket.getByRole('button', { name: '拉姆商店', exact: true }).click();
  await expect(pocket.getByRole('button', { name: '购买万能药水', exact: true })).toBeDisabled();
  assert.equal((await save(page)).coins, 65, 'unaffordable items cannot spend beans');
  await page.screenshot({ path: path.join(artifacts, 'v5-shop.png') });
  console.log('PASS varied food/drink/cleaning/medicine catalog, empty bag, bean purchases, correct consumption/effects and no free wash');

  await page.getByRole('button', { name: '休息', exact: true }).click();
  await expect(character.locator('.ram-sprite')).toHaveAttribute('data-sleeping', 'true');
  await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-frame', '4');
  await expect(page.getByRole('button', { name: '叫醒', exact: true }).first()).toBeVisible();
  assert.equal((await save(page)).sleeping, true);
  await panel.getByRole('tab', { name: '小游戏', exact: true }).click();
  await expect(panel.getByRole('button', { name: '开始', exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: '开始翻牌', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '叫醒', exact: true }).first().click();
  await expect.poll(async () => (await save(page)).sleeping).toBe(false);
  await expect(panel.getByRole('button', { name: '开始', exact: true })).toBeDisabled();
  console.log('PASS visible closed-eye seed sleep, accessible wake action, sleeping game guard and immobile-seed catch guard');

  await panel.getByRole('tab', { name: '设置', exact: true }).click();
  await panel.getByLabel('拉姆的新名字').fill('小叶子'); await panel.locator('.compact-rename').getByRole('button', { name: '保存', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await panel.getByRole('button', { name: '导出存档', exact: true }).click();
  const download = await downloadPromise; const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(backup.name, '小叶子');
  await importBackup(panel, '{');
  await page.getByText('这个存档无法读取，原来的拉姆仍然保留。', { exact: true }).waitFor(); assert.equal((await save(page)).name, '小叶子');
  backup.growth = 180; backup.name = '叶叶';
  // A real v0.4 save has only these inventory IDs and lacks thirst and health.
  const legacy = { ...backup, stats: { ...backup.stats }, inventory: { berry: 2, biscuit: 1, juice: 3 } };
  delete legacy.stats.thirst; delete legacy.stats.health; legacy.stats.hunger = 50; legacy.stats.cleanliness = 50;
  await importBackup(panel, legacy);
  await character.locator('.ram-classic-frame[data-loaded=true]').waitFor();
  assert.equal((await save(page)).inventory.berry, 2);
  assert.equal((await save(page)).inventory.juice, 3);
  assert.ok(Number.isFinite((await save(page)).stats.thirst) && Number.isFinite((await save(page)).stats.health));
  assert.equal((await save(page)).color, 'blue');
  await page.evaluate(() => localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: true, artStyle: 'hd' })));
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor();
  assert.equal(await page.locator('[data-art-style=hd]').count(), 0); assert.equal((await save(page)).name, '叶叶');
  assert.equal((await save(page)).inventory.berry, 2);
  await openActions(page); await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await panel.getByRole('button', { name: '陪我专注 25 分钟', exact: true }).click();
  await page.getByRole('button', { name: '结束专注', exact: true }).first().click();
  await page.getByRole('button', { name: '休息', exact: true }).click();
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-row', '8');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-frame', '0');
  await page.getByRole('button', { name: '叫醒', exact: true }).first().click();
  console.log('PASS old-save water/health migration, backup validation/restoration, legacy preferences, mature closed-eye sleep and focus controls');
  await panel.getByRole('tab', { name: '口袋', exact: true }).click();
  await pocket.getByRole('button', { name: '使用熊熊饼干', exact: true }).click();
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'care');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-row', '0');
  await expect.poll(() => character.locator('.ram-classic-frame').getAttribute('data-frame')).not.toBe('0');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'classic');
  await pocket.getByRole('button', { name: '饮品', exact: true }).click();
  await pocket.getByRole('button', { name: '使用浆果果汁', exact: true }).click();
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'care');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-row', '1');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'classic');
  await page.getByRole('button', { name: '洗澡', exact: true }).click();
  await pocket.getByRole('button', { name: '拉姆商店', exact: true }).click();
  await pocket.getByRole('button', { name: '购买泡泡浴', exact: true }).click();
  await pocket.getByRole('button', { name: '我的背包', exact: true }).click();
  await pocket.getByRole('button', { name: '使用泡泡浴', exact: true }).click();
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'care');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-row', '2');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'classic');
  console.log('PASS grown Ram plays distinct original eating/drinking/washing rows, advances frames and returns to idle');


  await say(page, '叫我小橙。');
  await say(page, '我喜欢草莓蛋糕。');
  const facts = await page.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')); return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`)).facts; });
  assert.ok(facts.some(f => f.kind === 'nickname' && f.value === '小橙'));
  assert.ok(facts.some(f => f.kind === 'like' && f.value === '草莓蛋糕'));
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor();
  await openActions(page); await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await say(page, '我叫什么？');
  await expect(panel.getByText('记得呀，你让我叫你小橙。咕噜～', { exact: true })).toBeVisible();
  await say(page, '我喜欢什么？');
  await expect(panel.getByText('你告诉过我，你喜欢草莓蛋糕。我记着呢。', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, 'v5-memory-chat.png') });
  console.log('PASS explicit user nickname/preferences persist and are recalled after restart without an API key');

  await panel.getByRole('tab', { name: '小游戏', exact: true }).click();
  await panel.getByRole('button', { name: '开始翻牌', exact: true }).click();
  const beforeMemory = await save(page); await page.getByTestId('memory-start').click();
  const kinds = await page.getByTestId('memory-card').evaluateAll(cards => cards.map(c => c.dataset.kind));
  await page.waitForTimeout(3150); const pairs = {}; kinds.forEach((k, i) => (pairs[k] ??= []).push(i));
  for (const pair of Object.values(pairs)) { await page.getByTestId('memory-card').nth(pair[0]).click(); await page.getByTestId('memory-card').nth(pair[1]).click(); }
  await page.getByTestId('memory-result').waitFor(); const afterMemory = await save(page);
  assert.equal(afterMemory.coins, beforeMemory.coins + 24); assert.equal(afterMemory.inventory.juice, beforeMemory.inventory.juice + 1);
  await page.getByRole('button', { name: '收好奖励', exact: true }).click();
  await panel.getByRole('button', { name: '开始', exact: true }).click();
  const beforeFruit = await save(page); await page.getByTestId('fruit-game-start').click();
  const arena = await page.getByTestId('game-arena').boundingBox();
  assert.equal(await page.locator('.fruit-basket .action-play').count(), 0, 'the catcher must not continuously jump');
  const start = Date.now(); let feedbackSeen = false;
  while (!(await page.getByTestId('fruit-game-result').isVisible())) {
    const fruits = await page.locator('.fruit-falling-berry').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y }; }).sort((a,b) => b.y-a.y));
    if (fruits.length) await page.mouse.move(fruits[0].x, arena.y + arena.height * .9);
    if (await page.getByTestId('fruit-caught').count()) feedbackSeen = true;
    if (Date.now() - start > 35000) throw Error('Fruit game did not finish its active time');
    await page.waitForTimeout(70);
  }
  const score = Number(await page.locator('.fruit-result>p strong').textContent()); assert.equal(score, 10);
  assert.equal(feedbackSeen, true, 'a successful contact must have explicit visible feedback');
  const afterFruit = await save(page); assert.equal(afterFruit.coins, beforeFruit.coins + 24); assert.equal(afterFruit.inventory.juice, beforeFruit.inventory.juice + 1);
  assert.ok(await page.getByText('接到的果子用于本局计分', { exact: false }).isVisible());
  await page.screenshot({ path: path.join(artifacts, 'v5-contact-game.png') });
  await page.getByRole('button', { name: '再来一局', exact: true }).click(); await page.keyboard.press('Escape');
  assert.equal((await save(page)).completedGames, afterFruit.completedGames);
  console.log('PASS both full games, grounded catch pose, contact feedback and actual single-item rewards');

  const backgrounds = [['晨光书桌', 'morning', '/assets/generated/morning-study.png'], ['拉姆小屋', 'ramu-home', '/assets/original/scenes/ramu-home.png'], ['神秘湖木屋', 'lake-cabin', '/assets/original/scenes/lake-cabin.png'], ['树洞房', 'earthen-home', '/assets/original/scenes/original-earthen-home.png']];
  for (const [label, id, suffix] of backgrounds) {
    await panel.getByRole('tab', { name: '设置', exact: true }).click();
    const picker = panel.getByRole('group', { name: '选择小屋背景', exact: true });
    assert.equal(await picker.getByRole('button').count(), 4);
    await picker.getByRole('button', { name: label, exact: true }).click();
    await expect(picker.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ramu-room-media-v1')).backgroundId), id);
    await panel.getByRole('button', { name: '进入小屋', exact: true }).click(); await page.locator('.cottage-scene').waitFor();
    assert.ok((await backgroundURL(page)).includes(suffix));
    await expect.poll(() => page.evaluate(() => window.__ramuAudio.some(audio => !audio.paused))).toBe(true);
    assert.ok((await page.locator('.scene-character').boundingBox()).width <= 150);
    await page.getByRole('button', { name: '回到桌面陪我 ▸', exact: true }).click(); await character.waitFor();
    await expect.poll(() => page.evaluate(() => window.__ramuAudio.every(audio => audio.paused))).toBe(true);
    await openActions(page); await page.getByRole('button', { name: '更多互动', exact: true }).click();
  }
  await panel.getByRole('tab', { name: '设置', exact: true }).click();
  await panel.locator('input[type=file][accept^="audio/"]').setInputFiles(path.join(root, 'public/assets/original/audio/mystery-lake.mp3'));
  await expect(panel.getByLabel('选择背景音乐', { exact: true })).toHaveValue('custom');
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor();
  await openActions(page); await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await panel.getByRole('tab', { name: '设置', exact: true }).click();
  await expect(panel.getByLabel('选择背景音乐', { exact: true })).toHaveValue('custom');
  await expect(panel.getByRole('option', { name: /mystery-lake\.mp3/ })).toHaveCount(1);
  await panel.getByRole('button', { name: '删除本地音乐', exact: true }).click();
  await expect(panel.getByLabel('选择背景音乐', { exact: true })).toHaveValue('castle');
  await panel.locator('input[type=file][accept^="audio/"]').setInputFiles({ name: 'broken.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('not an audio file') });
  await expect(panel.getByRole('status').filter({ hasText: '无法读取这段音频' })).toBeVisible();
  await expect(panel.getByLabel('选择背景音乐', { exact: true })).toHaveValue('castle');
  await panel.getByLabel('小屋背景音乐', { exact: true }).uncheck();
  await panel.getByLabel('选择背景音乐', { exact: true }).selectOption('pet-shop');
  await panel.getByLabel('背景音乐音量', { exact: true }).fill('32');
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor();
  await openActions(page); await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await panel.getByRole('tab', { name: '设置', exact: true }).click();
  await expect(panel.getByRole('button', { name: '树洞房', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByLabel('小屋背景音乐', { exact: true })).not.toBeChecked();
  await expect(panel.getByLabel('选择背景音乐', { exact: true })).toHaveValue('pet-shop');
  await expect(panel.getByLabel('背景音乐音量', { exact: true })).toHaveValue('32');
  await panel.getByRole('button', { name: '进入小屋', exact: true }).click(); await page.locator('.cottage-scene').waitFor();
  assert.ok((await backgroundURL(page)).includes('/assets/original/scenes/original-earthen-home.png'));
  await page.screenshot({ path: path.join(artifacts, 'v5-room-background.png') });
  await page.getByRole('button', { name: '回到桌面陪我 ▸', exact: true }).click(); await character.waitFor();
  await openActions(page); await page.getByRole('button', { name: '喂食', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(await panel.locator('.care-pocket').getByRole('button', { name: '我的背包', exact: true }).isVisible());
  assert.deepEqual(errors, []); assert.deepEqual(assetFailures, []); assert.deepEqual(aiRequests, [], 'unconfigured chat remains local');
  console.log('PASS four working room backgrounds, real room-only playback, valid/invalid music imports, custom/background/music/volume restart persistence, explicit-only entry, narrow-screen care and zero runtime/asset errors');
  await checkReminders(initial);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });

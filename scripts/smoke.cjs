const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
const { makeTired, adopt, openActions, enterHome, roomTab, toDesktop, selectPocket, buy } = require('./smoke-helpers.cjs');
const root = path.resolve(__dirname, '..');
const url = 'http://127.0.0.1:5174';
const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { cwd: root, stdio: 'pipe' });
let output = '', failed = false, browser, activePage, diagnosticErrors = [];
server.stdout.on('data', x => output += x); server.stderr.on('data', x => output += x); server.on('error', () => failed = true); server.on('exit', () => failed = true);
const pause = ms => new Promise(r => setTimeout(r, ms));
const artifacts = path.join(root, 'artifacts');
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));
async function say(page, text) {
  const panel = page.getByTestId('companion-panel');
  if(await page.locator('.classic-pet-book').isVisible()){await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'和拉姆说话',exact:true}).click();}else await panel.getByRole('tab', { name: '对话', exact: true }).click();
  await panel.getByRole('textbox', { name: '和拉姆说话', exact: true }).fill(text);
  await panel.getByRole('button', { name: '发送消息', exact: true }).click();
}
async function importBackup(page, value) {
  await page.locator('input[type=file][accept*=json]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
}
async function checkReminders(fixture) {
  for (const mode of ['idle','started','quiet','sleeping','cancelled']) {
    const page=await browser.newPage({viewport:{width:1180,height:820}});const now=Date.now();await page.clock.install({time:now});
    await page.addInitScript(({fixture,now,mode})=>{
      localStorage.setItem('ramu-house-save-v1',JSON.stringify({...fixture,createdAt:now,lastTick:now,sleeping:mode==='sleeping'}));
      localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,quiet:mode==='quiet',reminders:true,reminderMinutes:3}));
    },{fixture,now,mode});
    await page.goto(url);await page.getByTestId('desktop-character').waitFor();
    await expect(page.getByRole('timer')).toHaveCount(0);
    await openActions(page);
    if(mode!=='idle') await page.getByRole('button',{name:'开始计时',exact:true}).click();
    if(mode==='cancelled') await page.getByRole('button',{name:'取消计时',exact:true}).click();
    await page.clock.fastForward(181000);
    const count=()=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${p.createdAt}`)).events.filter(e=>e.kind==='reminder').length;});
    const expected=['idle','cancelled'].includes(mode)?0:1;
    await expect.poll(count).toBe(expected);
    await page.clock.fastForward(600000);await expect.poll(count).toBe(expected);
    await expect(page.getByRole('timer')).toHaveCount(0);
    await page.close();
  }
  console.log('PASS manual timer: no auto-start, one completion only, explicit cancel and real deadline independent of quiet/pet sleep');
}
async function checkFourSeedColors() {
  const samples = [];
  for (const [id, label] of [['yellow', '黄色'], ['red', '红色'], ['blue', '蓝色'], ['pink', '粉色']]) {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.goto(url); await adopt(page, label, `${label}拉姆`);
    const canvas = page.getByTestId('desktop-character').locator('.seed-body-frame[data-loaded=true]');
    await expect(canvas).toHaveAttribute('data-color', id);
    samples.push(await canvas.evaluate(canvas => Array.from(canvas.getContext('2d').getImageData(45, 58, 1, 1).data)));
    assert.equal((await save(page)).color, id); assert.equal((await save(page)).growth, 0, 'every new adoption starts with a seed');
    await page.reload(); await expect(canvas).toHaveAttribute('data-color', id);
    assert.equal((await save(page)).color, id); await page.close();
  }
  assert.equal(new Set(samples.map(p => p.slice(0, 3).join(','))).size, 4);
  assert.ok(samples.every(([r, g, b, a]) => a > 200 && Math.min(r, g, b) < 240));
  console.log('PASS two-step adoption, exactly four visibly different colors, seed-only start and restart persistence');
}
(async () => {
  for (let i = 0; i < 100; i++) { if (failed) throw Error(output); try { if ((await fetch(url)).ok) break; } catch {} if (i === 99) throw Error('Vite startup timeout'); await pause(100); }
  const executablePath = process.env.CHROMIUM_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(x => fs.existsSync(x));
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
  fs.mkdirSync(artifacts, { recursive: true }); await checkFourSeedColors();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } }); activePage = page; page.setDefaultTimeout(15000);
  await page.addInitScript(() => { const Original = window.Audio; window.__ramuAudio = []; window.Audio = function (...args) { const audio = new Original(...args); window.__ramuAudio.push(audio); return audio; }; window.Audio.prototype = Original.prototype; });
  const errors = [], assetFailures = [], aiRequests = []; diagnosticErrors = errors;
  page.on('request', r => { if (r.url().includes('api.deepseek.com')) aiRequests.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (/\.(?:mp3|wav)(?:[?#]|$)/.test(r.url()) && r.failure()?.errorText === 'net::ERR_ABORTED') return; if (/\.(?:png|mp3|wav)(?:[?#]|$)/.test(r.url())) assetFailures.push(r.url()); });
  await page.goto(url); await adopt(page, '蓝色', '小蓝');
  const character = page.getByTestId('desktop-character'); await character.locator('.seed-body-frame[data-loaded=true]').waitFor();
  const initial = await save(page); assert.equal(initial.growth, 0); assert.equal(initial.coins, 100); assert.ok(Object.values(initial.inventory).every(count => count === 0));
  assert.equal(await page.locator('.cottage-scene').count(), 0); assert.equal(await page.getByTestId('pet-actions').count(), 0); assert.ok((await character.boundingBox()).width <= 110);
  const pot = character.locator('.seed-pot-original'); await pot.evaluate(i => i.decode()); const potBefore = await pot.boundingBox(), c = await character.boundingBox();
  await page.mouse.move(c.x + 50, c.y + 60); await page.mouse.down(); await page.mouse.move(c.x + 85, c.y + 45); await page.waitForTimeout(180);
  assert.notEqual(await character.locator('.seed-body-original').evaluate(n => n.style.transform), 'rotate(0deg)');
  const during = await pot.boundingBox(); assert.ok(during.x > potBefore.x + 20); assert.ok(during.y < potBefore.y - 5); await page.mouse.up();
  const actions = await openActions(page);
  assert.deepEqual(await actions.getByRole('button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))), ['查看状态', '喂食', '洗澡', '玩耍', '开始计时', '和拉姆说话', '进入小屋']);
  await openActions(page);await actions.getByRole('button', { name: '状态', exact: true }).click();
  const panel = page.getByTestId('companion-panel'); await panel.waitFor(); const pocket = page.locator('.care-pocket');
  assert.ok((await panel.boundingBox()).width>700);
  assert.deepEqual(await panel.getByRole('tab').allTextContents(), ['用品', '装扮', '成长', '游戏', '回忆', '玩耍']);
  assert.equal(await page.locator('.shop-book').count(), 0); assert.equal(await page.locator('.cottage-scene').count(), 0);
  assert.equal(await pocket.locator('.pocket-slot').count(), 12); await expect(pocket.locator('[data-item-id="biscuit"]')).toHaveCount(0);
  const gridColumns = await pocket.locator('.pocket-items').evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length); assert.equal(gridColumns, 3);
  await pocket.getByRole('button',{name:'空物品格',exact:true}).first().click();await panel.getByRole('button', { name: '到小屋补充', exact: false }).click(); await expect(page.locator('.shop-book')).toBeVisible();
  assert.equal(await page.locator('.companion-panel').count(), 0); await expect(page.locator('.cottage-scene')).toBeVisible();
  console.log('PASS small draggable seed, seven ordered desktop tools, original desktop profile and three-column twelve-slot bag');

  await buy(page, 'biscuit', '熊熊饼干'); assert.equal((await save(page)).coins, 85);
  await buy(page, '180002', '麦香牛奶', '饮品'); assert.equal((await save(page)).coins, 75);
  await buy(page, '180003', '泡泡浴', '清洁'); assert.equal((await save(page)).coins, 65);
  assert.equal(await page.locator('.book-product').count(), 9); assert.equal(await page.locator('.bookshop-cover').count(), 4);
  await page.locator('.shop-book').getByRole('button', { name: '翻开药水商品书', exact: true }).click();
  await page.locator('.book-product[data-item-id="180005"]').click(); await expect(page.getByRole('button', { name: '购买万能药水', exact: true })).toBeDisabled(); assert.equal((await save(page)).coins, 65);
  await page.screenshot({ path: path.join(artifacts, 'v6-bookshop.png') });
  await roomTab(page, '背包');
  for (const slot of await pocket.locator('.pocket-slot').all()) { const b=await slot.boundingBox(); assert.ok(Math.abs(b.width-b.height)<1,'room inventory cells are square'); }
  const beforeFood = await save(page); await (await selectPocket(page, 'biscuit', '熊熊饼干')).click();
  await expect.poll(async () => (await save(page)).inventory.biscuit).toBe(0); assert.ok((await save(page)).stats.hunger > beforeFood.stats.hunger + 10); await expect(page.locator('.scene-character .ram-sprite')).toHaveAttribute('data-action', 'idle');
  const beforeDrink = await save(page); await (await selectPocket(page, '180002', '麦香牛奶')).click();
  await expect.poll(async () => (await save(page)).inventory['180002']).toBe(0); assert.ok((await save(page)).stats.thirst > beforeDrink.stats.thirst + 10); assert.ok(Math.abs((await save(page)).stats.hunger - beforeDrink.stats.hunger) < 1); await expect(page.locator('.scene-character .ram-sprite')).toHaveAttribute('data-action', 'idle');
  const beforeWash = await save(page); await (await selectPocket(page, '180003', '泡泡浴')).click();
  await expect.poll(async () => (await save(page)).inventory['180003']).toBe(0); assert.ok((await save(page)).stats.cleanliness > beforeWash.stats.cleanliness + 5); await expect(page.locator('.scene-character .ram-sprite')).toHaveAttribute('data-action', 'idle');
  assert.ok((await save(page)).growth < .05, 'repeated shopping and care do not instantly grow a seed');
  console.log('PASS room-only four-book shop, bean purchase guards, varied supplies and correct consumption/effects without click growth');

  await toDesktop(page); await openActions(page); await makeTired(page);
  await expect(character.locator('.ram-sprite')).toHaveAttribute('data-sleeping', 'true'); await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-sheet', 'slumber');
  await expect(page.getByRole('button', { name: '叫醒拉姆', exact: true })).toBeVisible(); assert.equal((await save(page)).sleeping, true);
  await enterHome(page); await roomTab(page, '游戏');
  await expect(page.getByRole('button', { name: '开始接果子', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: '开始翻牌', exact: true })).toBeDisabled();
  await toDesktop(page); await openActions(page); await page.getByRole('button', { name: '叫醒拉姆', exact: true }).click();
  await enterHome(page); await roomTab(page, '游戏'); await expect(page.getByRole('button', { name: '开始接果子', exact: true })).toBeDisabled();
  await roomTab(page, '设置');
  await page.getByLabel('拉姆的新名字').fill('小叶子'); await page.locator('.room-rename').getByRole('button', { name: '保存', exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: /^导出(?:存档)?$/ }).click();
  const download = await downloadPromise; const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8')); assert.equal(backup.name, '小叶子');
  await importBackup(page, '{'); await page.getByText('这个存档无法读取，原来的拉姆仍然保留。', { exact: true }).waitFor(); assert.equal((await save(page)).name, '小叶子');
  const legacy = { ...backup, growth: 180, name: '叶叶', stats: { ...backup.stats, hunger: 50, thirst: undefined, health: undefined, cleanliness: 50 }, inventory: { berry: 2, biscuit: 1, juice: 3, '180003': 1, '180024': 1 } };
  await importBackup(page, legacy); await expect.poll(async () => (await save(page)).name).toBe('叶叶'); assert.equal((await save(page)).inventory.berry, 2); assert.equal((await save(page)).inventory.juice, 3); assert.ok(Number.isFinite((await save(page)).stats.thirst) && Number.isFinite((await save(page)).stats.health)); assert.equal((await save(page)).color, 'blue');
  await page.evaluate(() => localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: true, artStyle: 'hd' })));
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor(); assert.equal(await page.locator('[data-art-style=hd]').count(), 0); assert.equal((await save(page)).name, '叶叶');
  await openActions(page);await actions.getByRole('button', { name: '玩耍', exact: true }).click(); await panel.getByRole('button', { name: '陪我专注', exact: true }).click(); await page.getByRole('button', { name: '结束专注', exact: true }).first().click();
  await makeTired(page); await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'slumber'); await page.getByRole('button', { name: '叫醒拉姆', exact: true }).click(); await openActions(page);await actions.getByRole('button',{name:'查看状态',exact:true}).click();
  console.log('PASS sleep/wake guards, backup validation, legacy-save need migration, no generated fallback, mature closed-eye sleep and focus');

  await panel.getByRole('tab', { name: '用品', exact: true }).click();
  for (const [category, id, name, action, row] of [['食物', 'biscuit', '熊熊饼干', 'eat-bear-biscuit', '0'], ['饮品', 'juice', '浆果果汁', 'drink-berry-juice', '1'], ['清洁', '180003', '泡泡浴', 'bubble-bath', '2'], ['清洁', '180024', '喜刷刷牙膏', 'brush-teeth', '2']]) {
    const before = (await save(page)).inventory[id];
    await (await selectPocket(page, id, name)).click(); await expect(character.locator('.ram-sprite')).toHaveAttribute('data-action', action);
    await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'item'); await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-row', row);
    await expect.poll(() => character.locator('.ram-classic-frame').getAttribute('data-frame')).not.toBe('0');
    await expect.poll(async () => (await save(page)).inventory[id]).toBe(before - 1); await expect(character.locator('.ram-sprite')).toHaveAttribute('data-action', 'tired'); await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-sheet', 'care');
  }
  console.log('PASS distinct item actions including brushing vs bathing, original-body motion, finite timelines and single-item use');
  await say(page, '叫我小橙。'); await say(page, '我喜欢草莓蛋糕。');
  const facts = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('ramu-house-save-v1')); return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${p.createdAt}`)).facts; }); assert.ok(facts.some(f => f.kind === 'nickname' && f.value === '小橙')); assert.ok(facts.some(f => f.kind === 'like' && f.value === '草莓蛋糕'));
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor(); await openActions(page);await actions.getByRole('button', { name: '和拉姆说话', exact: true }).click();
  await say(page, '我叫什么？'); await expect(panel.locator('.companion-history')).toContainText('小橙'); await say(page, '我喜欢什么？'); await expect(panel.locator('.companion-history')).toContainText('草莓蛋糕');
  await page.screenshot({ path: path.join(artifacts, 'v6-memory-chat.png') });
  console.log('PASS persistent nickname/preferences and local recall without DeepSeek requests');

  await enterHome(page); await roomTab(page, '游戏'); await page.getByRole('button', { name: '开始翻牌', exact: true }).click();
  const beforeMemory = await save(page); await page.getByTestId('memory-start').click(); const kinds = await page.getByTestId('memory-card').evaluateAll(cards => cards.map(c => c.dataset.kind)); await page.waitForTimeout(3150); const pairs = {}; kinds.forEach((k, i) => (pairs[k] ??= []).push(i));
  for (const pair of Object.values(pairs)) { await page.getByTestId('memory-card').nth(pair[0]).click(); await page.getByTestId('memory-card').nth(pair[1]).click(); }
  await page.getByTestId('memory-result').waitFor(); const afterMemory = await save(page); assert.equal(afterMemory.coins, beforeMemory.coins + 24); assert.equal(Object.keys(afterMemory.inventory).reduce((n,id)=>n+afterMemory.inventory[id]-(beforeMemory.inventory[id]??0),0),1); assert.ok(afterMemory.growth - beforeMemory.growth < .03, 'game grants no instant growth');
  await page.getByRole('button', { name: '收好奖励', exact: true }).click(); await page.getByRole('button', { name: '开始接果子', exact: true }).click(); const beforeFruit = await save(page); await page.getByTestId('fruit-game-start').click(); const arena = await page.getByTestId('game-arena').boundingBox(); assert.equal(await page.locator('.fruit-basket .action-play').count(), 0);
  const start = Date.now(); let feedbackSeen = false;
  while (!(await page.getByTestId('fruit-game-result').isVisible())) {
    const fruits = await page.locator('.fruit-falling-berry').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y }; }).sort((a,b) => b.y-a.y));
    if (fruits.length) await page.mouse.move(fruits[0].x, arena.y + arena.height * .9); if (await page.getByTestId('fruit-caught').count()) feedbackSeen = true; if (Date.now() - start > 35000) throw Error('Fruit game timed out'); await page.waitForTimeout(70);
  }
  assert.equal(Number(await page.locator('.fruit-result>p strong').textContent()), 10); assert.equal(feedbackSeen, true);
  const afterFruit = await save(page); assert.equal(afterFruit.coins, beforeFruit.coins + 24); assert.equal(Object.keys(afterFruit.inventory).reduce((n,id)=>n+afterFruit.inventory[id]-(beforeFruit.inventory[id]??0),0),1); assert.ok(afterFruit.growth - beforeFruit.growth < .03);
  await expect(page.getByText('接到的果子用于本局计分', { exact: false })).toBeVisible(); await page.screenshot({ path: path.join(artifacts, 'v6-contact-game.png') }); await page.getByRole('button', { name: '再来一局', exact: true }).click(); await page.keyboard.press('Escape'); assert.equal((await save(page)).completedGames, afterFruit.completedGames);
  console.log('PASS complete memory/catch games, contact feedback, actual rewards and no game-based growth');

  await roomTab(page, '设置'); const settings = page.locator('.room-settings'); const backgrounds = settings.getByRole('group', { name: '选择小屋背景', exact: true }); assert.equal(await backgrounds.getByRole('button').count(), 9);
  for (const [label, id, suffix] of [['晨光书桌','morning','morning-study.png'],['拉姆小屋','ramu-home','ramu-home.png'],['神秘湖木屋','lake-cabin','lake-cabin.png'],['树洞房','earthen-home','original-earthen-home.png'],['星光温室','starlight-greenhouse','v6-starlight-greenhouse.png'],['溪畔树屋','creek-treehouse','v6-creek-treehouse.png'],['浆果野餐地','berry-picnic','v18-berry-picnic.png'],['海风贝壳屋','seashell-cottage','v18-seashell-cottage.png'],['晴空观星阁','sky-observatory','v18-sky-observatory.png']]) {
    await backgrounds.getByRole('button', { name: label, exact: true }).click(); await expect(backgrounds.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed','true'); await expect(page.locator('.cottage-scene')).toHaveAttribute('data-background', id);
    const image = page.locator('.time-scene-art img'); await image.evaluate(i => i.decode()); assert.ok((await image.getAttribute('src')).endsWith(suffix));
    for (const [phase, phaseLabel] of [['morning','早晨'],['noon','白天'],['dusk','傍晚'],['night','夜晚']]) { await settings.getByRole('button', { name: `预览${phaseLabel}`, exact:true }).click(); await expect(page.locator('.cottage-scene')).toHaveAttribute('data-phase', phase); }
    await settings.getByRole('button', { name: '跟随时间', exact: true }).click(); await expect(page.locator('.cottage-scene')).toHaveAttribute('data-time-mode', 'auto');
  }
  const tracks = settings.getByRole('group', { name: '选择背景音乐', exact:true }); assert.equal(await tracks.getByRole('button').count(), 12);
  for (const button of await tracks.getByRole('button').all()) { await button.click(); await expect(button).toHaveAttribute('aria-pressed','true'); await expect.poll(() => page.evaluate(() => window.__ramuAudio.some(audio => audio.src.endsWith(`/audio/${JSON.parse(localStorage.getItem('ramu-room-media-v1')).musicId}.mp3`) && !audio.paused && Number.isFinite(audio.duration) && audio.duration > 0))).toBe(true); }
  await toDesktop(page); await expect.poll(() => page.evaluate(() => window.__ramuAudio.every(audio => audio.paused))).toBe(true);
  await enterHome(page); await roomTab(page,'设置');
  await settings.locator('input[type=file][accept^="audio/"]').setInputFiles(path.join(root,'public/assets/original/audio/mystery-lake.mp3')); await expect(tracks.getByRole('button',{name:/mystery-lake\.mp3/})).toHaveAttribute('aria-pressed','true');
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor(); await enterHome(page); await roomTab(page,'设置'); await expect(tracks.getByRole('button',{name:/mystery-lake\.mp3/})).toHaveAttribute('aria-pressed','true');
  await settings.getByRole('button',{name:'删除本地音乐',exact:true}).click(); await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-room-media-v1')).musicId)).toBe('castle');
  await settings.locator('input[type=file][accept^="audio/"]').setInputFiles({name:'broken.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('not audio')}); await expect(settings.getByRole('status').filter({hasText:'无法读取这段音频'})).toBeVisible(); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ramu-room-media-v1')).musicId),'castle');
  await settings.getByLabel('小屋背景音乐',{exact:true}).uncheck(); await tracks.getByRole('button',{name:'宠物店',exact:true}).click(); await settings.getByLabel('背景音乐音量',{exact:true}).fill('32');
  await page.reload(); await character.locator('.ram-classic-frame[data-loaded=true]').waitFor(); await enterHome(page); await roomTab(page,'设置'); await expect(backgrounds.getByRole('button',{name:'晴空观星阁',exact:true})).toHaveAttribute('aria-pressed','true'); await expect(page.locator('.cottage-scene')).toHaveAttribute('data-background','sky-observatory'); await expect(settings.getByLabel('小屋背景音乐',{exact:true})).not.toBeChecked(); await expect(tracks.getByRole('button',{name:'宠物店',exact:true})).toHaveAttribute('aria-pressed','true'); await expect(settings.getByLabel('背景音乐音量',{exact:true})).toHaveValue('32');
  await page.screenshot({path:path.join(artifacts,'v6-room-settings.png')}); await toDesktop(page); await openActions(page);await actions.getByRole('button',{name:'状态',exact:true}).click(); await page.setViewportSize({width:390,height:844}); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false); await expect(pocket).toBeVisible();
  assert.deepEqual(errors,[]); assert.deepEqual(assetFailures,[]); assert.deepEqual(aiRequests,[]);
  console.log('PASS nine backgrounds/four real-time phases including three new scenes, all 12 real audio decodes, room-only playback, IndexedDB music import/restart/delete/invalid guards and narrow-screen layout');
  await checkReminders(initial);
})().catch(async e => {console.error(e); if (activePage) { console.error('Renderer errors:', diagnosticErrors); console.error(await activePage.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1') || 'null'); return { pet: pet && {name:pet.name,color:pet.color,growth:pet.growth}, desktop:document.querySelectorAll('.desktop-character').length, classic:document.querySelectorAll('.ram-classic-frame[data-loaded=true]').length, fallback:document.querySelectorAll('[data-fallback]').length, text:document.body.innerText.slice(0,1000) }; }).catch(() => 'page unavailable')); await activePage.screenshot({path:path.join(artifacts,'v6-browser-failure.png')}).catch(()=>{}); } process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();});

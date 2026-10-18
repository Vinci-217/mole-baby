const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const cloud = '/workspace/.ramu-env';
const profile = path.join(cloud, 'compact-native-test-config');
const artifacts = path.join(root, 'artifacts');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let desktop;
let virtualDisplay;
let windowManager;

function displayReady(display) {
  try { execFileSync('xdpyinfo', ['-display', display], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function windowManagerReady(display) {
  try {
    const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const rootProperty = execFileSync('xprop', ['-display', display, '-root', '_NET_SUPPORTING_WM_CHECK'], options);
    const id = rootProperty.match(/window id # (0x[1-9a-f][0-9a-f]*)/i)?.[1];
    if (!id) return false;
    // The root property can survive after xfwm4 exits. Verify the actual
    // manager window, rather than treating an old window ID as readiness.
    const selfProperty = execFileSync('xprop', ['-display', display, '-id', id, '_NET_SUPPORTING_WM_CHECK'], options);
    return selfProperty.includes(id);
  } catch { return false; }
}

async function waitForClassic(page, selector) {
  const character = page.locator(selector);
  await expect(character).toBeVisible();
  await expect(character).toBeInViewport();
  await expect.poll(async () => character.locator('canvas[data-loaded="true"], .ram-sprite[data-fallback]').count(), { timeout: 20000 }).toBeGreaterThan(0);
  assert.equal(await character.locator('.ram-sprite[data-fallback]').count(), 0, `${selector}: classic PNGs must not silently fall back to illustrations`);
  await expect(character.locator('canvas[data-loaded="true"]')).toBeVisible();
  const painted = await character.locator('canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
  assert.equal(painted, true, `${selector}: canvas must contain readable, nontransparent pixels`);
}

async function fullyInsideNativeWindow(locator, label) {
  await expect(locator).toBeVisible();
  const box = await locator.evaluate(node => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight };
  });
  assert.ok(box.left >= -.5 && box.top >= -.5 && box.right <= box.width + .5 && box.bottom <= box.height + .5,
    `${label} must fit completely in the native window: ${JSON.stringify(box)}`);
}

async function verifyBackground(page, selector, suffix) {
  const result = await page.locator(selector).first().evaluate(async (element) => {
    const imageCSS = getComputedStyle(element).backgroundImage;
    const match = imageCSS.match(/url\(["']?([^"')]+)["']?\)/);
    if (!match) throw new Error(`Missing background image: ${imageCSS}`);
    const image = new Image(); image.src = match[1]; await image.decode();
    return { url: image.src, width: image.naturalWidth, height: image.naturalHeight };
  });
  assert.ok(result.url.startsWith('file:'), `Expected a production file URL: ${result.url}`);
  assert.ok(new URL(result.url).pathname.endsWith(suffix), result.url);
  assert.ok(result.width > 0 && result.height > 0);
  return result;
}

(async () => {
  assert.equal(process.platform, 'linux', 'This smoke test uses an isolated Linux cloud profile and virtual display');
  fs.mkdirSync(profile, { recursive: true });
  fs.mkdirSync(artifacts, { recursive: true });
  assert.ok(fs.existsSync(path.join(root, 'dist/index.html')), 'Run npm run build before the desktop smoke test');
  const env = { ...process.env, ELECTRON_DEV: '0', XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: path.join(cloud, 'cache') };
  const args = [root];
  if (process.platform === 'linux') {
    env.DISPLAY = ':98';
    env.FONTCONFIG_FILE = path.join(cloud, 'fonts.conf');
    // These flags apply only to the isolated cloud test process; production
    // Windows builds continue to use the sandbox configured by the application.
    args.push('--no-sandbox', '--disable-gpu');
    if (!displayReady(env.DISPLAY)) {
      virtualDisplay = spawn('/usr/lib/xorg/Xorg', [env.DISPLAY, '-config', path.join(cloud, 'xorg.conf'), '-logfile', path.join(profile, 'xorg.log'), '-noreset', '-nolisten', 'tcp', '-novtswitch', '-sharevts'], { stdio: 'ignore' });
      for (let attempt = 0; attempt < 50 && !displayReady(env.DISPLAY); attempt++) await pause(100);
      assert.ok(displayReady(env.DISPLAY), 'The cloud virtual display did not become ready');
    }
    // Xorg alone cannot minimize windows. Use the image's existing window
    // manager on this dedicated display so the test exercises real WM events.
    if (!windowManagerReady(env.DISPLAY)) {
      windowManager = spawn('dbus-run-session', ['--', 'xfwm4', '--compositor=off', '--sm-client-disable'], { env, stdio: 'ignore', detached: true });
      for (let attempt = 0; attempt < 50 && !windowManagerReady(env.DISPLAY); attempt++) await pause(100);
      assert.ok(windowManagerReady(env.DISPLAY), 'The cloud window manager did not become ready');
    }
  }
  desktop = await _electron.launch({ args, env, cwd: root, timeout: 30000 });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(15000);
  const rendererErrors = [];
  const failedAssets = [];
  const retiredAssets = [];
  page.on('pageerror', error => rendererErrors.push(error.message));
  page.on('requestfailed', request => { if (/\.png(?:\?|$)/.test(request.url())) failedAssets.push(request.url()); });
  page.on('request', request => { if (/\/assets\/(?:classic-room|classic-icons|classic-game-props|ram-generated-sheet)\.png(?:[?#]|$)/.test(request.url())) retiredAssets.push(request.url()); });
  const bounds = () => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  const state = () => page.evaluate(() => window.desktop.getState());
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));

  await page.waitForFunction(() => window.desktop?.isElectron === true);
  await page.evaluate(async () => { await window.desktop.setPetMode(false); await window.desktop.wander(false); localStorage.removeItem('ramu-house-save-v1'); localStorage.removeItem('ramu-house-preferences-v2'); localStorage.removeItem('ramu-room-media-v1'); await window.companionAI.clearKey(); });
  await page.reload();
  await page.getByLabel('选择红色拉姆').click(); await page.locator('#pet-name').fill('红豆');
  await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
  const character = page.getByTestId('desktop-character');
  await expect(character.locator('.seed-body-frame[data-loaded=true]')).toBeVisible();
  await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-color', 'red');
  assert.ok(Object.values((await save()).inventory).every(count => count === 0));
  await expect.poll(async () => (await state()).petMode).toBe(true);
  assert.deepEqual({ width: (await bounds()).width, height: (await bounds()).height }, { width: 200, height: 240 });
  assert.equal(await page.locator('.cottage-scene').count(), 0);
  const seedBounds = await bounds();
  assert.equal(await page.evaluate(() => window.desktop.movePet(40, 30)), false);
  assert.equal(await page.evaluate(() => window.desktop.wander(true)), false);
  assert.deepEqual(await bounds(), seedBounds);
  await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([200, 240]);
  await expect(character).toBeInViewport();
  const cb = await character.boundingBox();
  await page.mouse.move(cb.x + 50, cb.y + 55); await page.mouse.down(); await page.mouse.move(cb.x + 80, cb.y + 45);
  await page.waitForTimeout(150);
  assert.notEqual(await character.locator('.seed-body-original').evaluate(n => n.style.transform), 'rotate(0deg)');
  assert.deepEqual(await bounds(), seedBounds, 'seed cannot be moved by pointer or IPC');
  await page.mouse.up();
  await page.screenshot({ path: path.join(artifacts, 'v5-native-seed.png'), omitBackground: true });
  console.log('PASS original planted seed, 200x240 native window, 100px pet and fixed pot on pointer/IPC drag');

  // Grow only this isolated fixture to exercise mature dragging and walking.
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('ramu-house-save-v1')); p.growth = 180; localStorage.setItem('ramu-house-save-v1', JSON.stringify(p)); });
  await page.reload(); await waitForClassic(page, '.desktop-character');
  await expect.poll(() => page.evaluate(() => window.desktop.setPetCanMove(true))).toBe(true);
  const current = await bounds(); await page.evaluate(({ x, y }) => window.desktop.movePet(500 - x, 400 - y), current);
  const before = await bounds();
  if (!(await page.getByTestId('pet-actions').isVisible())) await character.click(); await expect(page.getByTestId('pet-actions')).toBeVisible();
  await page.getByRole('button', { name: '喂食', exact: true }).click();
  const panel = page.getByTestId('companion-panel'); await expect(panel).toBeVisible();
  await expect.poll(async () => (await bounds()).width).toBe(540);
  assert.equal((await state()).petMode, true, 'care must stay on the desktop');
  assert.equal((await bounds()).height, 390);
  const expanded = await bounds(); const side = (await state()).panelSide;
  const petX = expanded.x + (side === 'left' ? 340 : 0);
  assert.equal(petX, before.x); assert.equal(expanded.y + 150, before.y);
  assert.equal(await page.locator('.cottage-scene').count(), 0);
  const pocket = panel.locator('.care-pocket');
  await expect(pocket.getByRole('button', { name: '使用熊熊饼干', exact: true })).toBeDisabled();
  const foodImage = pocket.locator('article[data-item-id="biscuit"] img'); await foodImage.evaluate(i => i.decode());
  assert.ok((await foodImage.getAttribute('src')).includes('original/items/'));
  await pocket.getByRole('button', { name: '拉姆商店', exact: true }).click();
  await pocket.getByRole('button', { name: '购买熊熊饼干', exact: true }).click();
  await expect.poll(async () => (await save()).coins).toBe(85);
  await pocket.getByRole('button', { name: '我的背包', exact: true }).click();
  const beforeFood = await save(); await pocket.getByRole('button', { name: '使用熊熊饼干', exact: true }).click();
  await expect.poll(async () => (await save()).inventory.biscuit).toBe(0);
  assert.ok((await save()).stats.hunger > beforeFood.stats.hunger + 10);
  await page.screenshot({ path: path.join(artifacts, 'v5-native-sidecar.png'), omitBackground: true });
  await page.getByLabel('关闭小窗').click();
  await expect.poll(async () => (await bounds()).width).toBe(200);
  assert.equal((await bounds()).x, before.x); assert.equal((await bounds()).y, before.y);
  await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([200, 240]);
  const area = await desktop.evaluate(({ screen }) => screen.getPrimaryDisplay().workArea);
  const rightX = area.x + area.width - 200;
  await page.evaluate(({ dx, dy }) => window.desktop.movePet(dx, dy), { dx: rightX - before.x, dy: 0 });
  await page.getByRole('button', { name: '喂食', exact: true }).click();
  await expect.poll(async () => (await state()).panelSide).toBe('left');
  assert.equal((await bounds()).x + 340, rightX);
  await page.getByLabel('关闭小窗').click();
  await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([200, 240]);
  await page.evaluate(dx => window.desktop.movePet(dx, 0), before.x - rightX);
  await expect(character).toBeInViewport();
  console.log('PASS adjacent 332px care window, unchanged pet screen anchor, file:// food and collapse without entering room');

  const mature = await character.boundingBox(), beforeDrag = await bounds();
  await page.mouse.move(mature.x + 50, mature.y + 55); await page.mouse.down(); await page.mouse.move(mature.x + 110, mature.y + 75); await page.mouse.up();
  await expect.poll(async () => (await bounds()).x).toBe(beforeDrag.x + 60);
  await expect.poll(async () => (await bounds()).y).toBe(beforeDrag.y + 20);
  if (!(await page.getByTestId('pet-actions').isVisible())) await character.click(); await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await panel.getByRole('tab', { name: '设置', exact: true }).click();
  await panel.getByRole('switch', { name: '桌面散步', exact: true }).click();
  assert.equal((await state()).wandering, true);
  await page.getByLabel('关闭小窗').click();
  await expect.poll(async () => (await state()).motion, { timeout: 18000 }).toMatch(/^(left|right)$/);
  await expect(character.locator('.ram-sprite')).toHaveClass(/action-walk-(left|right)/);
  if (!(await page.getByTestId('pet-actions').isVisible())) await character.click(); await page.getByRole('button', { name: '查看状态', exact: true }).click();
  await expect.poll(async () => (await state()).motion).toBe('idle');
  await panel.getByRole('tab', { name: '设置', exact: true }).click(); await panel.getByRole('switch', { name: '桌面散步', exact: true }).click();
  await panel.getByLabel('拉姆的新名字').fill('红豆陪伴'); await panel.locator('.compact-rename').getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(async () => (await save()).name).toBe('红豆陪伴');
  const pinned = await page.evaluate(() => window.desktop.toggleAlwaysOnTop()); assert.equal((await state()).alwaysOnTop, pinned);
  await page.evaluate(() => window.desktop.toggleAlwaysOnTop());
  console.log('PASS mature pointer drag, real walking with directional frames, panel pauses movement, rename and pin state');

  await page.getByRole('button', { name: '休息', exact: true }).click();
  await expect(character.locator('.ram-sprite')).toHaveAttribute('data-sleeping', 'true');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-row', '8');
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-frame', '0');
  await expect(page.getByRole('button', { name: '叫醒', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '叫醒', exact: true }).first().click();
  await expect.poll(async () => (await save()).sleeping).toBe(false);

  const beforeShortGames = (await save()).completedGames;
  await panel.getByRole('tab', { name: '小游戏', exact: true }).click();
  await panel.getByRole('button', { name: '开始', exact: true }).click();
  await page.getByTestId('fruit-game-start').click();
  await expect(page.locator('.fruit-dialog')).toHaveAttribute('data-phase', 'playing');
  await fullyInsideNativeWindow(page.locator('.fruit-scoreboard'), 'fruit score and timer');
  await fullyInsideNativeWindow(page.getByTestId('game-arena'), 'fruit play surface');
  await page.screenshot({ path: path.join(artifacts, 'v5-native-fruit-game.png'), omitBackground: true });
  await page.keyboard.press('Escape');
  await panel.getByRole('button', { name: '开始翻牌', exact: true }).click();
  await page.getByTestId('memory-start').click();
  await expect(page.locator('.memory-dialog')).toHaveAttribute('data-phase', 'playing', { timeout: 5000 });
  await fullyInsideNativeWindow(page.locator('.memory-scoreboard'), 'memory score and timer');
  await fullyInsideNativeWindow(page.getByTestId('memory-board'), 'entire memory board');
  await page.screenshot({ path: path.join(artifacts, 'v5-native-memory-game.png'), omitBackground: true });
  await page.keyboard.press('Escape');
  assert.equal((await save()).completedGames, beforeShortGames, 'aborting short layout checks never grants a game reward');
  await panel.getByRole('tab', { name: '设置', exact: true }).click();
  console.log('PASS native fruit/memory active scoreboards and full play surfaces fit in 540x390 without scrolling');

  // A fake credential exercises the local main-process bridge only. No chat
  // request is made here; transport/error cases have deterministic Node mocks.
  const speech = await page.evaluate(() => window.companionSpeech.getAvailability());
  assert.equal(speech.available, false, 'Linux cloud exposes Windows-only offline speech as unavailable');
  assert.equal(typeof speech.reason, 'string');
  const fakeKey = 'sk-local-smoke-not-a-real-key-0123456789';
  assert.equal((await page.evaluate(() => window.companionAI.getSettings())).configured, false);
  const aiSettings = await page.evaluate(key => window.companionAI.setKey(key), fakeKey);
  assert.equal(aiSettings.configured, true);
  assert.deepEqual(Object.keys(aiSettings).sort(), ['configured', 'protection']);
  assert.equal(await page.evaluate(key => Object.values(localStorage).some(value => value.includes(key)), fakeKey), false, 'API key must not enter renderer localStorage');
  const userData = await desktop.evaluate(({ app }) => app.getPath('userData'));
  const keyRecord = path.join(userData, 'companion-ai-key.json');
  assert.ok(fs.existsSync(keyRecord), 'API key is stored in the local app profile');
  if (aiSettings.protection === 'os-encrypted') assert.equal(fs.readFileSync(keyRecord, 'utf8').includes(fakeKey), false);
  await panel.getByRole('button', { name: '神秘湖木屋', exact: true }).click();
  await panel.getByLabel('小屋背景音乐', { exact: true }).uncheck();
  await panel.getByLabel('选择背景音乐', { exact: true }).selectOption('mystery-lake');
  console.log('PASS closed-eye sleep/wake and local-only API credential bridge without contacting DeepSeek');

  await panel.getByRole('button', { name: '进入小屋', exact: true }).click();
  await expect(page.locator('.cottage-scene')).toBeVisible();
  assert.equal((await state()).petMode, false);
  await verifyBackground(page, '.cottage-scene', '/assets/original/scenes/lake-cabin.png');
  await page.getByRole('button', { name: '回到桌面陪我 ▸', exact: true }).click();
  await expect(character).toBeVisible();
  await expect(character).toBeInViewport(); await page.reload(); await waitForClassic(page, '.desktop-character');
  assert.equal((await state()).petMode, true); assert.equal((await bounds()).width, 200); assert.equal((await save()).name, '红豆陪伴');
  await page.mouse.move(-20, -20); await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: path.join(artifacts, 'v5-native-compact.png'), omitBackground: true });
  assert.deepEqual(rendererErrors, []); assert.deepEqual(failedAssets, []); assert.deepEqual(retiredAssets, []);
  if (!(await page.getByTestId('pet-actions').isVisible())) await character.click(); await page.getByRole('button', { name: '查看状态', exact: true }).click();
  const closed = desktop.waitForEvent('close', { timeout: 10000 });
  await page.getByRole('button', { name: '关闭拉姆', exact: true }).click(); await closed; desktop = null;
  // Reopen the actual application process with the same isolated profile,
  // rather than treating a renderer reload as credential persistence.
  desktop = await _electron.launch({ args, env, cwd: root, timeout: 30000 });
  const restarted = await desktop.firstWindow(); restarted.setDefaultTimeout(15000);
  restarted.on('pageerror', error => rendererErrors.push(error.message));
  restarted.on('requestfailed', request => { if (/\.png(?:\?|$)/.test(request.url())) failedAssets.push(request.url()); });
  await restarted.waitForFunction(() => window.desktop?.isElectron === true && window.companionAI);
  await waitForClassic(restarted, '.desktop-character');
  assert.equal(await restarted.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')).name), '红豆陪伴');
  const restartedAI = await restarted.evaluate(() => window.companionAI.getSettings());
  assert.equal(restartedAI.configured, true);
  assert.equal(await restarted.evaluate(key => Object.values(localStorage).some(value => value.includes(key)), fakeKey), false);
  const roomPrefs = await restarted.evaluate(() => JSON.parse(localStorage.getItem('ramu-room-media-v1')));
  assert.equal(roomPrefs.backgroundId, 'lake-cabin'); assert.equal(roomPrefs.musicId, 'mystery-lake'); assert.equal(roomPrefs.musicEnabled, false);
  assert.equal((await restarted.evaluate(() => window.companionAI.clearKey())).configured, false);
  assert.equal(fs.existsSync(keyRecord), false, 'clearing the API key removes its local file');
  assert.deepEqual(rendererErrors, []); assert.deepEqual(failedAssets, []);
  console.log('PASS explicit-only room entry, app-process restart preserves pet/background/music/key, clear-key removal, zero renderer/asset errors and application close');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (desktop) await desktop.close().catch(() => {});
  if (windowManager) { try { process.kill(-windowManager.pid, 'SIGTERM'); } catch { /* It already exited. */ } }
  if (virtualDisplay) virtualDisplay.kill();
});

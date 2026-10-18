const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');
const cloud = '/workspace/.ramu-env';
const profile = path.join(cloud, 'v3-test-config');
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
  await expect.poll(async () => character.locator('canvas[data-loaded="true"], .ram-sprite[data-fallback]').count(), { timeout: 20000 }).toBeGreaterThan(0);
  assert.equal(await character.locator('.ram-sprite[data-fallback]').count(), 0, `${selector}: classic PNGs must not silently fall back to illustrations`);
  await expect(character.locator('canvas[data-loaded="true"]')).toBeVisible();
  const painted = await character.locator('canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
  assert.equal(painted, true, `${selector}: canvas must contain readable, nontransparent pixels`);
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
  const generatedAssets = [];
  page.on('pageerror', error => rendererErrors.push(error.message));
  page.on('requestfailed', request => { if (/\.png(?:\?|$)/.test(request.url())) failedAssets.push(request.url()); });
  page.on('request', request => { if (/\/assets\/(?:classic-room|classic-icons|classic-game-props|ram-generated-sheet)\.png(?:[?#]|$)/.test(request.url())) generatedAssets.push(request.url()); });
  const bounds = () => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  const state = () => page.evaluate(() => window.desktop.getState());
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));

  await page.waitForFunction(() => window.desktop?.isElectron === true);
  assert.ok(page.url().startsWith('file:'), 'Verify the production build, not Vite');
  // This is a dedicated test profile. Clear only the application keys in it.
  await page.evaluate(async () => {
    await window.desktop.setPetMode(false);
    await window.desktop.wander(false);
    localStorage.removeItem('ramu-house-save-v1');
    localStorage.removeItem('ramu-house-preferences-v2');
  });
  await page.reload();
  await page.getByRole('button', { name: '选择红色拉姆', exact: true }).click();
  await page.locator('#pet-name').fill('红豆');
  await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
  await expect(page.locator('.transparent-stage .desktop-pet')).toBeVisible();
  await waitForClassic(page, '.desktop-character');
  const adopted = await save();
  assert.equal(adopted.color, 'red');
  assert.equal(adopted.name, '红豆');
  assert.equal(adopted.growth, 180);
  assert.equal((await state()).petMode, true);
  assert.deepEqual({ width: (await bounds()).width, height: (await bounds()).height }, { width: 360, height: 420 });
  console.log('PASS: production file:// adoption, automatic desktop mode, original red PNG canvas without fallback');

  // Reset only this isolated test window's position so repeated runs cannot
  // accumulate drag offsets and eventually hit the work-area boundary.
  const initialPosition = await bounds();
  await page.evaluate(({ x, y }) => window.desktop.movePet(200 - x, 100 - y), initialPosition);
  await page.locator('.desktop-character').hover();
  await expect.poll(() => page.locator('.pet-toolbelt').evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1);
  const beforeDrag = await bounds();
  const character = await page.locator('.desktop-character').boundingBox();
  const startX = character.x + character.width / 2, startY = character.y + character.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // One viewport movement represents a 90×40 physical screen delta. Multiple
  // interpolated client-coordinate moves would drift as the native window moves.
  await page.mouse.move(startX + 90, startY + 40);
  await page.mouse.up();
  await expect.poll(async () => (await bounds()).x).toBe(beforeDrag.x + 90);
  await expect.poll(async () => (await bounds()).y).toBe(beforeDrag.y + 40);
  console.log('PASS: hover toolbar and pointer-capture drag move native window by 90×40');

  await page.locator('.desktop-character').hover();
  await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await page.getByRole('button', { name: '让拉姆走一走', exact: true }).click();
  await expect.poll(async () => (await state()).wandering).toBe(true);
  await expect.poll(async () => (await state()).motion, { timeout: 18000 }).toMatch(/^(left|right)$/);
  await expect(page.locator('.desktop-character .ram-sprite')).toHaveClass(/action-walk-(left|right)/);
  await page.getByRole('button', { name: '设置与存档', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '陪伴设置', exact: true });
  await expect(settings).toBeVisible();
  assert.equal((await state()).petMode, false);
  assert.equal((await state()).motion, 'idle');
  const normalBounds = await bounds();
  assert.ok(normalBounds.width >= 1000 && normalBounds.height >= 720);
  await expect(settings.getByRole('switch', { name: '桌面散步', exact: true })).toHaveAttribute('aria-checked', 'true');
  await settings.getByRole('switch', { name: '桌面散步', exact: true }).click();
  await expect.poll(async () => (await state()).wandering).toBe(false);
  const room = await verifyBackground(page, '.cottage-scene', '/assets/original/scenes/ramu-home.png');

  const beforeLegacyPrefs = await save();
  await page.evaluate(() => localStorage.setItem('ramu-house-preferences-v2', JSON.stringify({ sound: false, quiet: true, artStyle: 'hd' })));
  await page.reload();
  // Loading a saved pet intentionally returns to the transparent companion.
  await waitForClassic(page, '.desktop-character');
  await page.locator('.desktop-character').hover();
  await page.getByRole('button', { name: '更多互动', exact: true }).click();
  await page.getByRole('button', { name: '打开拉姆的家', exact: true }).click();
  await waitForClassic(page, '.scene-character');
  assert.equal(await page.locator('[data-art-style=hd], .ram-hd-frame').count(), 0);
  assert.equal((await save()).name, beforeLegacyPrefs.name);
  assert.equal((await save()).color, beforeLegacyPrefs.color);
  assert.equal((await save()).coins, beforeLegacyPrefs.coins);
  assert.deepEqual((await save()).inventory, beforeLegacyPrefs.inventory);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-preferences-v2'))), { sound: false, quiet: true });
  await page.getByRole('button', { name: '食物口袋', exact: true }).click();
  for (const [id, name] of [['180027', '可可果'], ['180017', '熊熊饼干'], ['180008', '浆果果汁']]) {
    const image = page.getByRole('dialog').locator(`img[src$="/items/${id}.png"]`).first();
    await expect(image).toBeVisible();
    const original = await image.evaluate(async element => { await element.decode(); return { url: element.src, width: element.naturalWidth, height: element.naturalHeight }; });
    assert.ok(original.url.startsWith('file:'), `${name}: packaged food must load through file://`);
    assert.ok(original.width > 0 && original.height > 0, `${name}: original PNG must decode`);
    await expect(page.getByRole('dialog').getByText(name, { exact: true })).toBeVisible();
  }
  assert.equal(await page.locator('svg').count(), 0);
  await page.getByLabel('关闭面板').click();
  await page.getByRole('button', { name: '陪伴设置', exact: true }).click();
  assert.equal(await settings.getByRole('button', { name: '高清重绘', exact: true }).count(), 0);
  await settings.getByLabel('拉姆的新名字', { exact: true }).fill('红豆陪伴');
  await settings.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(async () => (await save()).name).toBe('红豆陪伴');
  console.log(`PASS: native settings, file:// original room (${room.width}×${room.height}) and food PNGs, legacy preference migration, rename persistence`);

  await page.evaluate(() => { window.__desktopStates = []; window.__desktopUnsubscribe = window.desktop.onStateChanged(value => window.__desktopStates.push(value)); });
  const pinned = await page.evaluate(() => window.desktop.toggleAlwaysOnTop());
  await expect.poll(async () => (await state()).alwaysOnTop).toBe(pinned);
  await expect.poll(() => page.evaluate(pinned => window.__desktopStates.some(value => value.alwaysOnTop === pinned), pinned)).toBe(true);
  await page.evaluate(() => window.desktop.toggleAlwaysOnTop());
  await page.getByRole('button', { name: '最小化', exact: true }).click();
  await expect.poll(() => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(true);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore());
  await expect.poll(() => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())).toBe(false);
  await expect(settings).toBeVisible();
  console.log('PASS: native pinned state broadcasts, minimize, restore');

  await settings.getByRole('button', { name: '关闭面板', exact: true }).click();
  await waitForClassic(page, '.scene-character');
  await expect(page.locator('.classic-toast')).toHaveCount(0);
  await page.mouse.move(10, 10);
  await page.screenshot({ path: path.join(artifacts, 'v3-native-room.png') });
  await page.getByRole('button', { name: '陪伴设置', exact: true }).click();
  await page.getByRole('button', { name: '让拉姆回到桌面陪我 ▸', exact: true }).click();
  await expect(page.locator('.transparent-stage .desktop-pet')).toBeVisible();
  await page.reload();
  await expect(page.locator('.transparent-stage .desktop-pet')).toBeVisible();
  await waitForClassic(page, '.desktop-character');
  assert.equal((await save()).name, '红豆陪伴');
  assert.equal((await state()).petMode, true);
  assert.equal(await page.locator('.ram-sprite[data-fallback]').count(), 0);
  await page.mouse.move(-30, -30);
  await page.evaluate(() => document.activeElement?.blur());
  await expect.poll(() => page.locator('.pet-toolbelt').evaluate(node => Number(getComputedStyle(node).opacity))).toBe(0);
  await page.screenshot({ path: path.join(artifacts, 'v3-native-pet.png'), omitBackground: true });
  assert.equal(await page.locator('svg').count(), 0);
  assert.deepEqual(rendererErrors, []);
  assert.deepEqual(failedAssets, []);
  assert.deepEqual(generatedAssets, [], 'The complete native flow must not request replaced generated artwork');
  console.log('PASS: return to desktop, saved pet remains floating, no generated artwork/SVG, zero renderer errors and failed PNGs');

  await page.locator('.desktop-character').hover();
  await page.screenshot({ path: path.join(artifacts, 'v3-native-pet-hover.png'), omitBackground: true });
  const exited = desktop.waitForEvent('close', { timeout: 10000 });
  await page.getByRole('button', { name: '关闭拉姆', exact: true }).click();
  await exited;
  desktop = null;
  console.log('PASS: hover close exits the native application');
  console.log('Screenshots: artifacts/v3-native-pet.png, artifacts/v3-native-room.png');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (desktop) await desktop.close().catch(() => {});
  if (windowManager) { try { process.kill(-windowManager.pid, 'SIGTERM'); } catch { /* It already exited. */ } }
  if (virtualDisplay) virtualDisplay.kill();
});

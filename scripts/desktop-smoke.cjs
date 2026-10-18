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
  await page.evaluate(async () => { await window.desktop.setPetMode(false); await window.desktop.wander(false); localStorage.removeItem('ramu-house-save-v1'); localStorage.removeItem('ramu-house-preferences-v2'); });
  await page.reload();
  await page.getByLabel('选择红色拉姆').click(); await page.locator('#pet-name').fill('红豆');
  await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
  const character = page.getByTestId('desktop-character');
  await expect(character.locator('.seed-body-frame[data-loaded=true]')).toBeVisible();
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
  await page.screenshot({ path: path.join(artifacts, 'v4-native-seed.png'), omitBackground: true });
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
  for (const id of ['180027', '180017', '180008']) {
    const img = panel.locator(`img[src$="${id}.png"]`); await img.evaluate(i => i.decode());
    assert.ok((await img.getAttribute('src')).includes('original/items/'));
  }
  const inventory = await save(); await panel.getByRole('button', { name: '喂一份', exact: true }).first().click();
  await expect.poll(async () => (await save()).inventory.berry).toBe(inventory.inventory.berry - 1);
  await page.screenshot({ path: path.join(artifacts, 'v4-native-sidecar.png'), omitBackground: true });
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
  await panel.getByLabel('拉姆的新名字').fill('红豆陪伴'); await panel.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(async () => (await save()).name).toBe('红豆陪伴');
  const pinned = await page.evaluate(() => window.desktop.toggleAlwaysOnTop()); assert.equal((await state()).alwaysOnTop, pinned);
  await page.evaluate(() => window.desktop.toggleAlwaysOnTop());
  console.log('PASS mature pointer drag, real walking with directional frames, panel pauses movement, rename and pin state');

  await panel.getByRole('button', { name: '进入小屋', exact: true }).click();
  await expect(page.locator('.cottage-scene')).toBeVisible();
  assert.equal((await state()).petMode, false);
  await verifyBackground(page, '.cottage-scene', '/assets/generated/morning-study.png');
  await page.getByRole('button', { name: '回到桌面陪我 ▸', exact: true }).click();
  await expect(character).toBeVisible();
  await expect(character).toBeInViewport(); await page.reload(); await waitForClassic(page, '.desktop-character');
  assert.equal((await state()).petMode, true); assert.equal((await bounds()).width, 200); assert.equal((await save()).name, '红豆陪伴');
  await page.mouse.move(-20, -20); await page.evaluate(() => document.activeElement?.blur());
  await page.screenshot({ path: path.join(artifacts, 'v4-native-compact.png'), omitBackground: true });
  assert.deepEqual(rendererErrors, []); assert.deepEqual(failedAssets, []); assert.deepEqual(retiredAssets, []);
  if (!(await page.getByTestId('pet-actions').isVisible())) await character.click(); await page.getByRole('button', { name: '查看状态', exact: true }).click();
  const closed = desktop.waitForEvent('close', { timeout: 10000 });
  await page.getByRole('button', { name: '关闭拉姆', exact: true }).click(); await closed; desktop = null;
  console.log('PASS explicit-only room entry, compact restart persistence, zero renderer/asset errors and application close');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (desktop) await desktop.close().catch(() => {});
  if (windowManager) { try { process.kill(-windowManager.pid, 'SIGTERM'); } catch { /* It already exited. */ } }
  if (virtualDisplay) virtualDisplay.kill();
});

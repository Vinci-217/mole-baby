const {verifyCompactCare}=require('./compact-care-checks.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');
const {adopt}=require('./smoke-helpers.cjs');

const root = path.resolve(__dirname, '..');
const cloud = '/workspace/.ramu-env';
const profile = path.join(cloud, 'v6-native-test-config');
const artifacts = path.join(root, 'artifacts');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let desktop;
let virtualDisplay;
let windowManager;
async function quitDesktop() {
  if (!desktop) return;
  const closed = desktop.waitForEvent('close', { timeout: 10000 });
  await desktop.evaluate(({ app }) => app.quit()).catch(() => {});
  await closed; desktop = null;
}

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
  await expect.poll(async () => character.locator('canvas:not(.ram-wear)[data-loaded="true"], .ram-sprite[data-fallback]').count(), { timeout: 20000 }).toBeGreaterThan(0);
  assert.equal(await character.locator('.ram-sprite[data-fallback]').count(), 0, `${selector}: classic PNGs must not silently fall back to illustrations`);
  await expect(character.locator('canvas:not(.ram-wear)[data-loaded="true"]')).toBeVisible();
  const painted = await character.locator('canvas:not(.ram-wear)').evaluate(canvas => {
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
  fs.rmSync(profile, { recursive: true, force: true });
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
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.desktop?.isElectron===true,undefined,{polling:100,timeout:30000});
  await adopt(page,'蓝色','小叶');await verifyCompactCare(page,desktop);assert.deepEqual(errors,[]);
  console.log('PASS native compact desktop regression');await quitDesktop();
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await quitDesktop().catch(()=>{});if(windowManager)try{process.kill(-windowManager.pid,'SIGTERM')}catch{}virtualDisplay?.kill('SIGTERM')});

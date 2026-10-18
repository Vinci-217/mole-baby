const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const asar = require('@electron/asar');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');

// Run on the Windows runner after electron-builder has produced both targets.
// Launch the packaged executable, so this also catches broken file:// paths,
// missing preload scripts and original artwork omitted from the ASAR.
const root = path.resolve(__dirname, '..');
const release = path.join(root, 'release');
const { version, build } = require('../package.json');
const portable = `RamuHouse-${version}-x64.zip`;
const installer = `RamuHouse-${version}-Setup.exe`;
const unpacked = path.join(release, 'win-unpacked');
const executable = path.join(unpacked, `${build.productName}.exe`);
let desktop;
let profile;

function requireFile(filename, magic) {
  const stat = fs.statSync(filename);
  assert.ok(stat.isFile() && stat.size > 0, `Missing or empty package file: ${filename}`);
  if (magic) {
    const descriptor = fs.openSync(filename, 'r');
    try {
      const header = Buffer.alloc(magic.length);
      fs.readSync(descriptor, header, 0, header.length, 0);
      assert.deepEqual(header, Buffer.from(magic), `Unexpected file format: ${filename}`);
    } finally { fs.closeSync(descriptor); }
  }
}

async function main() {
  assert.equal(process.platform, 'win32', 'Run this check on Windows after packaging');
  requireFile(path.join(release, portable), [0x50, 0x4b, 0x03, 0x04]);
  requireFile(path.join(release, installer), [0x4d, 0x5a]);
  requireFile(executable, [0x4d, 0x5a]);

  const archive = path.join(unpacked, 'resources', 'app.asar');
  requireFile(archive);
  const paths = new Set(asar.listPackage(archive).map(item => item.replace(/\\/g, '/').replace(/^\//, '')));
  for (const filename of [
    'package.json', 'electron/main.cjs', 'electron/preload.cjs', 'electron/deepseek.cjs', 'electron/speech.cjs', 'dist/index.html', 'dist/favicon.png',
    'dist/assets/classic/middle-neutral.png', 'dist/assets/classic/middle-mask.png',
    'dist/assets/original/scenes/ramu-home.png', 'dist/assets/original/scenes/lake-cabin.png', 'dist/assets/original/scenes/original-earthen-home.png',
    'dist/assets/generated/morning-study.png', 'dist/assets/original/ui/button-orange.png',
    'dist/assets/original/audio/castle.mp3', 'dist/assets/original/audio/pet-shop.mp3', 'dist/assets/original/audio/mystery-lake.mp3',
    'dist/assets/original/items/180027.png', 'dist/assets/original/items/180017.png',
    'dist/assets/original/items/180008.png', 'dist/assets/original/items/180002.png', 'dist/assets/original/items/180003.png',
    'dist/assets/original/seed/pot.png', 'dist/assets/original/seed/body.png', 'dist/assets/original/seed/body-mask.png',
  ]) assert.ok(paths.has(filename), `Required application payload is missing: ${filename}`);
  for (const form of ['junior', 'middle', 'senior']) for (const layer of ['neutral', 'mask']) {
    const filename = `dist/assets/original/care/${form}-${layer}.png`;
    assert.ok(paths.has(filename), `Original care animation atlas is missing: ${filename}`);
  }
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json').toString()).version, version);
  assert.ok(![...paths].some(filename => /^(?:src\/|\.git\/|\.env(?:$|\.))/.test(filename)), 'Development source or local configuration was accidentally packaged');
  console.log('PASS: installer, portable ZIP, executable and required ASAR payload');

  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ramu-windows-smoke-'));
  desktop = await _electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${profile}`],
    env: { ...process.env, ELECTRON_DEV: '0' },
    cwd: root,
    timeout: 30000,
  });
  const page = await desktop.firstWindow();
  page.setDefaultTimeout(15000);
  const rendererErrors = [];
  page.on('pageerror', error => rendererErrors.push(error.message));
  assert.ok(page.url().startsWith('file:'), `Expected the packaged renderer: ${page.url()}`);
  await page.waitForFunction(() => window.desktop?.isElectron === true);
  await page.getByRole('button', { name: '选择红色拉姆', exact: true }).click();
  await page.locator('#pet-name').fill('红豆');
  await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
  const character = page.locator('.desktop-character');
  await expect(character).toBeVisible();
  await expect(character).toBeInViewport();
  await expect(character.locator('canvas[data-loaded="true"]')).toBeVisible();
  assert.equal(await character.locator('[data-fallback]').count(), 0, 'The original Ram PNG must load without a fallback');
  const state = await page.evaluate(() => window.desktop.getState());
  assert.equal(state.petMode, true);
  const bounds = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(bounds.width, 200);
  assert.equal(bounds.height, 240);
  const painted = await character.locator('canvas').evaluate(canvas =>
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0));
  assert.equal(painted, true, 'The original Ram canvas must contain visible pixels');
  await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-color', 'red');
  const seedPixel = await character.locator('.seed-body-frame').evaluate(canvas => Array.from(canvas.getContext('2d').getImageData(45, 58, 1, 1).data));
  assert.ok(seedPixel[3] > 200 && seedPixel[0] > seedPixel[2], 'the red seed is visibly red in the packaged app');
  assert.equal(await page.evaluate(() => window.desktop.movePet(10, 10)), false, 'the seed pot stays fixed');
  const speech = await page.evaluate(() => window.companionSpeech.getAvailability());
  assert.equal(typeof speech.available, 'boolean');
  assert.ok(speech.available ? typeof speech.language === 'string' : typeof speech.reason === 'string', 'offline speech availability must explain its status without opening a microphone');
  const fakeKey = 'sk-windows-smoke-not-a-real-key-0123456789';
  const ai = await page.evaluate(key => window.companionAI.setKey(key), fakeKey);
  assert.equal(ai.configured, true);
  assert.deepEqual(Object.keys(ai).sort(), ['configured', 'protection']);
  assert.equal(await page.evaluate(key => Object.values(localStorage).some(value => value.includes(key)), fakeKey), false);
  const userData = await desktop.evaluate(({ app }) => app.getPath('userData'));
  const keyRecord = path.join(userData, 'companion-ai-key.json');
  assert.ok(fs.existsSync(keyRecord));
  if (ai.protection === 'os-encrypted') assert.equal(fs.readFileSync(keyRecord, 'utf8').includes(fakeKey), false, 'OS-encrypted key must not be stored as plaintext');
  await page.reload(); await expect(character.locator('.seed-body-frame[data-loaded=true]')).toBeVisible();
  assert.equal((await page.evaluate(() => window.companionAI.getSettings())).configured, true);
  assert.equal((await page.evaluate(() => window.companionAI.clearKey())).configured, false);
  assert.equal(fs.existsSync(keyRecord), false);
  console.log('PASS: packaged seed tint, fixed pot, offline speech availability and local-only API key save/reload/clear without network requests');
  await character.click();
  await expect(page.getByTestId('pet-actions')).toBeVisible();
  await page.getByRole('button', { name: '喂食', exact: true }).click();
  await expect(page.getByTestId('companion-panel')).toBeVisible();
  const expanded = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(expanded.width, 540); assert.equal(expanded.height, 390);
  assert.equal((await page.evaluate(() => window.desktop.getState())).petMode, true);
  assert.equal(await page.locator('.cottage-scene').count(), 0);
  const panel = page.getByTestId('companion-panel'), pocket = panel.locator('.care-pocket');
  await expect(pocket.getByRole('button', { name: '使用熊熊饼干', exact: true })).toBeDisabled();
  await pocket.getByRole('button', { name: '拉姆商店', exact: true }).click();
  await pocket.getByRole('button', { name: '购买熊熊饼干', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')).coins)).toBe(85);
  await pocket.getByRole('button', { name: '我的背包', exact: true }).click();
  await pocket.getByRole('button', { name: '使用熊熊饼干', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')).inventory.biscuit)).toBe(0);
  await page.getByRole('button', { name: '休息', exact: true }).click();
  await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-frame', '4');
  await page.getByRole('button', { name: '叫醒', exact: true }).first().click();
  await panel.getByRole('tab', { name: '设置', exact: true }).click();
  await panel.getByRole('button', { name: '拉姆小屋', exact: true }).click();
  await panel.getByLabel('小屋背景音乐', { exact: true }).uncheck();
  await panel.getByRole('button', { name: '进入小屋', exact: true }).click();
  await expect(page.locator('.cottage-scene')).toBeVisible();
  assert.ok(await page.locator('.cottage-scene').evaluate(node => getComputedStyle(node).backgroundImage.includes('/assets/original/scenes/ramu-home.png')));
  await page.getByRole('button', { name: '回到桌面陪我 ▸', exact: true }).click();
  await expect(character).toBeInViewport();
  await character.click(); await page.getByRole('button', { name: '喂食', exact: true }).click();
  await page.getByLabel('关闭小窗').click();
  await expect.poll(() => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds().width)).toBe(200);
  await expect.poll(() => page.evaluate(() => [innerWidth, innerHeight])).toEqual([200, 240]);
  await page.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')); pet.growth = 180; localStorage.setItem('ramu-house-save-v1', JSON.stringify(pet)); });
  await page.reload();
  await expect(character.locator('.ram-classic-frame[data-loaded=true]')).toBeVisible();
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-color', 'red');
  assert.equal(await character.locator('[data-fallback]').count(), 0, 'grown original and care sheets load without fallback in ASAR');
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'artifacts', 'v5-windows-smoke.png') });
  assert.deepEqual(rendererErrors, []);
  console.log('PASS: packaged Windows application starts, uses original assets, buys/consumes supplies, sleeps with closed eyes, switches room backgrounds and opens compact care beside the pet');

  const sums = [];
  for (const filename of [portable, installer]) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(path.join(release, filename))) hash.update(chunk);
    sums.push(`${hash.digest('hex')}  ${filename}`);
  }
  fs.writeFileSync(path.join(release, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`, 'utf8');
  console.log('PASS: SHA256SUMS.txt generated for the checked downloads');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { if (desktop) await desktop.close(); }
  finally { if (profile) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
});

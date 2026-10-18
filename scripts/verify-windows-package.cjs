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
    'package.json', 'electron/main.cjs', 'electron/preload.cjs', 'dist/index.html', 'dist/favicon.png',
    'dist/assets/classic/middle-neutral.png', 'dist/assets/classic/middle-mask.png',
    'dist/assets/original/scenes/ramu-home.png', 'dist/assets/original/ui/button-orange.png',
    'dist/assets/original/items/180027.png', 'dist/assets/original/items/180017.png',
    'dist/assets/original/items/180008.png',
  ]) assert.ok(paths.has(filename), `Required application payload is missing: ${filename}`);
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
  await expect(character.locator('canvas[data-loaded="true"]')).toBeVisible();
  assert.equal(await character.locator('[data-fallback]').count(), 0, 'The original Ram PNG must load without a fallback');
  const state = await page.evaluate(() => window.desktop.getState());
  assert.equal(state.petMode, true);
  const bounds = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(bounds.width, 360);
  assert.equal(bounds.height, 420);
  const painted = await character.locator('canvas').evaluate(canvas =>
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0));
  assert.equal(painted, true, 'The original Ram canvas must contain visible pixels');
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'artifacts', 'windows-smoke.png') });
  assert.deepEqual(rendererErrors, []);
  console.log('PASS: packaged Windows application starts, loads original Ram artwork and enters transparent companion mode');

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

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = require('node:path').resolve(__dirname, '..');
const { chromium, expect } = require(root + '/node_modules/@playwright/test');
const { adopt, enterHome } = require(root + '/scripts/smoke-helpers.cjs');
const { reloadWithStorage } = require(root + '/scripts/smoke-storage.cjs');
const url = 'http://127.0.0.1:5236';
const server = spawn(process.execPath, [root + '/node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5236', '--strictPort'], { cwd: root, stdio: 'ignore' });
let browser;
(async () => {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await adopt(page, '蓝色', '小叶');
  const key = 'ramu-house-save-v1';
  for (let round = 0; round < 5; round++) {
    const fixture = await page.evaluate(key => {
      const entries = Object.fromEntries(Object.entries(localStorage));
      const p = JSON.parse(entries[key]);
      p.coins = 50;
      p.lastTick = Date.now();
      delete p.checkIn;
      entries[key] = JSON.stringify(p);
      entries['ramu-house-preferences-v2'] = JSON.stringify({ sound: false, lively: false, presence: false, outings: false });
      return entries;
    }, key);
    const reload = page.reload.bind(page);
    // Reproduce a pending old-renderer write in the gap immediately before navigation.
    page.reload = async options => {
      await page.evaluate(key => {
        const p = JSON.parse(localStorage.getItem(key));
        p.coins = 7777;
        localStorage.setItem(key, JSON.stringify(p));
      }, key);
      return reload(options);
    };
    await reloadWithStorage(page, fixture);
    page.reload = reload;
    await expect(page.getByTestId('desktop-character')).toBeVisible();
    await enterHome(page);
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).coins, key)).toBe(50);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('mole-smoke-next-storage-v1')), null);
    await page.getByRole('button', { name: '每日签到领取1000摩尔豆', exact: true }).evaluate(b => { b.click(); b.click(); });
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).coins, key)).toBe(1050);
    await page.reload();
    await expect(page.getByTestId('desktop-character')).toBeVisible();
    await enterHome(page);
    await expect(page.getByRole('button', { name: '今日已签到', exact: true })).toBeDisabled();
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).coins, key), 1050);
    console.log('PASS forced live-autosave collision, one-shot pre-render fixture, double claim and persisted reload, round', round + 1);
  }
  assert.deepEqual(errors, []);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });

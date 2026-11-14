#!/usr/bin/env node
'use strict';
// Test the real complete installer through the browser, including corrupted
// transfers, a reload/resume, a damaged cache, and final saved-file SHA/NSIS CRC.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { verifyNsisInstaller } = require('./windows-artifacts.cjs');
const root = path.resolve(__dirname, '..');
const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:5173/').replace(/\/?$/, '/');
const output = path.join(root, 'artifacts/windows-build');

async function main() {
  const scratch = fs.mkdtempSync(path.join(fs.existsSync('/dev/shm') ? '/dev/shm' : os.tmpdir(), 'mole-download-qa-'));
  const context = await chromium.launchPersistentContext(path.join(scratch, 'profile'), {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : '/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome'),
    headless: true, acceptDownloads: true, downloadsPath: path.join(scratch, 'downloads'),
    args: ['--disk-cache-size=1048576'], viewport: { width: 1000, height: 800 },
  });
  try {
    const page = context.pages()[0], errors = [], attempts = new Map();
    const consoleErrors = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    const manifest = await (await context.request.get(base + 'downloads/windows/manifest.json')).json();
    let outage = true;
    await context.route('**/downloads/windows/parts/*.bin', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      const index = manifest.chunks.findIndex(chunk => chunk.file.endsWith('/' + name));
      const count = (attempts.get(index) || 0) + 1; attempts.set(index, count);
      if (index === 3 && outage) return route.abort('connectionreset');
      if ((index === 4 || index === 5) && count === 1) {
        const response = await route.fetch(), bytes = await response.body();
        const damaged = index === 4 ? bytes.subarray(0, 1024) : Buffer.from(bytes);
        if (index === 5) damaged[500] ^= 1;
        return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: damaged });
      }
      return route.continue();
    });
    await page.goto(base + 'downloads/windows/');
    await expect(page.locator('#start')).toBeEnabled();
    await page.locator('#start').click();
    await expect(page.locator('#status')).toContainText('点击继续下载即可重试', { timeout: 60000 });
    await expect(page.locator('#save')).toBeHidden();
    for (let index = 0; index < 3; index++) assert.equal(attempts.get(index), 1);
    assert.equal(attempts.get(3), 3);
    outage = false;
    await page.reload(); await expect(page.locator('#start')).toBeEnabled();
    await page.locator('#start').click();
    await expect(page.locator('#save')).toBeVisible({ timeout: 180000 });
    for (let index = 0; index < 3; index++) assert.equal(attempts.get(index), 1, 'Verified parts should survive a page reload');
    assert.equal(attempts.get(4), 2, 'Truncated chunk must be retried');
    assert.equal(attempts.get(5), 2, 'Same-length corrupt chunk must be retried');
    let downloadCount = 0; page.on('download', () => downloadCount++);
    await page.evaluate(async sha => {
      const db = await new Promise(resolve => { const r = indexedDB.open('mole-windows-test-download-v1', 1); r.onsuccess = () => resolve(r.result); });
      await new Promise((resolve, reject) => { const tx = db.transaction('chunks', 'readwrite'); tx.objectStore('chunks').put(new ArrayBuffer(100), sha + ':0'); tx.oncomplete = resolve; tx.onerror = reject; });
      db.close();
    }, manifest.sha256);
    await page.locator('#save').click();
    await expect(page.locator('#status')).toContainText('缓存分段不完整');
    assert.equal(downloadCount, 0, 'Do not offer an EXE when the cached bytes are damaged');
    await page.locator('#start').click();
    await expect(page.locator('#save')).toBeVisible({ timeout: 180000 });
    assert.equal(attempts.get(0), 2, 'Only the broken cached part is downloaded again');
    for (const index of [1, 2, 6, 7]) assert.equal(attempts.get(index), 1);
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'download-ready.png'), fullPage: true });
    console.log(execFileSync('df', ['-h', '/workspace', '/dev/shm'], { encoding: 'utf8' }));
    const pending = page.waitForEvent('download', { timeout: 180000 });
    await page.locator('#save').click();
    const download = await pending, failure = await download.failure();
    assert.equal(failure, null, JSON.stringify({ failure, consoleErrors, disk: execFileSync('df', ['-h', '/workspace', '/dev/shm'], { encoding: 'utf8' }) }));
    const downloaded = await download.path();
    assert.equal(download.suggestedFilename(), manifest.filename);
    assert.equal(fs.statSync(downloaded).size, manifest.bytes);
    const hash = crypto.createHash('sha256');
    for await (const bytes of fs.createReadStream(downloaded)) hash.update(bytes);
    const sha256 = hash.digest('hex'); assert.equal(sha256, manifest.sha256);
    const nsis = await verifyNsisInstaller(downloaded);
    assert.deepEqual(errors, []);
    const report = {
      checkedAt: new Date().toISOString(), browser: 'Chromium', bytes: manifest.bytes, sha256, nsis,
      exhaustedRetriesBlockSave: true, resumeAfterReload: true,
      truncatedPartRetried: true, corruptedPartRetried: true,
      corruptedCacheBlocksSave: true, damagedCachePartRepaired: true,
      completeBrowserDownloadVerified: true, windowsNativeInstallation: 'not performed on this Linux VM', errors,
    };
    fs.writeFileSync(path.join(output, 'download-regression.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await context.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

/** Exercise the served archive: real book pages, searches, downloads and SWF pixels. */
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const vault = path.join(root, 'local-assets');
const out = path.join(root, 'artifacts/ram-asset-inventory-20261117');
const base = process.env.RAM_INVENTORY_URL || 'http://127.0.0.1:5181/ram-inventory/';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const catalog = JSON.parse(fs.readFileSync(path.join(vault, 'ram-inventory/catalog.json')));
  const unavailable = JSON.parse(fs.readFileSync(path.join(vault, 'ram-inventory/unavailable.json')));
  assert.equal(new Set(catalog.items.map(r => r.path)).size, catalog.items.length);
  let references = 0;
  for (const row of catalog.items) for (const variant of row.variants) {
    assert.ok(fs.statSync(path.join(vault, variant.url)).size > 0, variant.url);
    if (variant.timeline) assert.ok(fs.statSync(path.join(vault, variant.timeline)).size > 0, variant.timeline);
    references++;
  }
  const changed = catalog.items.filter(row => row.variants.length > 1 && !row.variants.at(-1).sameAsArchive);
  for (const row of changed) {
    const hashes = row.variants.map(v => crypto.createHash('sha256').update(fs.readFileSync(path.join(vault, v.url))).digest('hex'));
    assert.notEqual(hashes[0], hashes[1]);
  }
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true });
  const report = { checkedAt: new Date().toISOString(), base, references, changedVersions: changed.map(r => r.path),
    summary: catalog.summary, books: [], searches: [], layouts: [], pageErrors: [], failedRequests: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', e => report.pageErrors.push(e.message));
    page.on('response', response => { if (response.status() >= 400) report.failedRequests.push([response.status(), response.url()]); });
    await page.goto(base);
    await page.waitForFunction(() => window.inventoryReady);
    await page.locator('.cover img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    assert.equal(await page.locator('.book').count(), 6);
    await page.screenshot({ path: path.join(out, 'desktop.png') });
    for (const book of catalog.items.filter(row => row.book)) {
      await page.locator('.book').filter({ has: page.locator('strong', { hasText: book.title }) }).click();
      await page.locator('#detail[open]').waitFor();
      const options = await page.locator('#bookpage option').count();
      assert.equal(options, book.book.frames);
      for (let frame = 0; frame < options; frame++) {
        await page.locator('#bookpage').selectOption(String(frame));
        await page.locator('.bookstage img').evaluate(img => img.decode());
        const dimensions = await page.locator('.bookstage img').evaluate(img => [img.naturalWidth, img.naturalHeight]);
        assert.ok(dimensions.every(n => n > 100), book.path + ' frame ' + frame);
      }
      if (book.book.key === 'life') {
        await page.locator('#bookpage').selectOption('2');
        await page.locator('.bookstage img').evaluate(img => img.decode());
        await page.screenshot({ path: path.join(out, 'life-manual-pages.png') });
      }
      report.books.push({ title: book.title, frames: options, allPagesDecoded: true });
      await page.getByRole('button', { name: '关闭详情', exact: true }).click();
    }
    for (const query of ['拉姆手册', '拉姆救治手册', '魔法书', '1200042', 'petStudyBook', 'level101']) {
      await page.locator('#search').fill(query);
      assert.ok(await page.locator('.row').count() > 0, query);
      report.searches.push({ query, result: await page.locator('#resultstatus').textContent() });
    }
    await page.locator('#search').fill('this-file-does-not-exist-xyz');
    await page.locator('.empty').waitFor();
    assert.ok(await page.locator('#export').isDisabled());
    await page.locator('#search').fill('拉姆救治手册');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadPromise;
    const exported = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(exported.includes('拉姆救治手册') && exported.includes('12738.swf'));
    report.filteredCsvDownload = true;
    await page.locator('#search').fill('');
    for (const [source, count] of [['archive', catalog.summary.archivePaths], ['official', catalog.summary.officialPaths], ['unavailable', unavailable.count]]) {
      await page.locator('#source').selectOption(source);
      assert.ok((await page.locator('#resultstatus').textContent()).includes(count.toLocaleString('zh-CN')));
    }
    await page.locator('#rows .row').first().getByRole('button', { name: '查看', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '播放原 SWF', exact: true }).count(), 0);
    await page.getByRole('button', { name: '关闭详情', exact: true }).click();
    await page.locator('#source').selectOption('all');
    await page.locator('#next').click();
    assert.match(await page.locator('#pageinfo').textContent(), /^2 \/ /);
    await page.locator('#filters button').filter({ hasText: '书籍与手册' }).click();
    assert.equal(await page.locator('.row').count(), 6);
    await page.locator('#filters button').filter({ hasText: '全部分类' }).click();
    await page.locator('#search').fill('1200026');
    await page.locator('.row').filter({ hasText: 'resource/petcloth/swf2/1200026.swf' }).getByRole('button', { name: '查看', exact: true }).click();
    await page.getByRole('button', { name: '播放原 SWF', exact: true }).click();
    const frame = page.frames().find(f => f.url().includes('preview.html')) || await new Promise(resolve => page.once('framenavigated', resolve));
    await frame.waitForFunction(() => window.previewReady, {}, { timeout: 45000 });
    const status = await frame.evaluate(() => window.player.ruffle().callExternalInterface('previewStatus'));
    assert.ok(status.width > 0 && !status.error);
    const stage = frame.locator('#stage');
    const before = await stage.screenshot();
    await pause(500);
    assert.ok(!before.equals(await stage.screenshot()), 'Original SWF animation pixels must advance');
    await frame.locator('#pause').click();
    await pause(80);
    const frozen = await stage.screenshot();
    await pause(180);
    assert.ok(frozen.equals(await stage.screenshot()), 'Pause must freeze actual pixels');
    await frame.locator('#pause').click();
    await frame.locator('#form').selectOption('level101_7');
    await frame.waitForFunction(() => window.player.ruffle().callExternalInterface('previewStatus')?.settled);
    assert.equal(await frame.evaluate(() => window.player.ruffle().callExternalInterface('previewStatus').form), 'level101_7');
    report.swf = { path: 'resource/petcloth/swf2/1200026.swf', pixelsAdvance: true, pauseFreezesPixels: true, formSwitch: true };
    await page.getByRole('button', { name: '关闭详情', exact: true }).click();
    assert.equal(await page.locator('#detail iframe').count(), 0);
    report.playerUnloadedOnClose = true;
    for (const width of [393, 320]) {
      await page.setViewportSize({ width, height: 852 });
      await page.goto(base);
      await page.waitForFunction(() => window.inventoryReady);
      await page.locator('.cover img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
      let layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(layout.content <= width, JSON.stringify(layout));
      if (width === 393) await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: false });
      await page.locator('.book').filter({ hasText: '拉姆手册' }).click();
      await page.locator('.bookstage img').evaluate(img => img.decode());
      const dialogLayout = await page.locator('#detail').evaluate(d => ({ width: d.clientWidth, content: d.scrollWidth }));
      assert.ok(dialogLayout.content <= dialogLayout.width, JSON.stringify(dialogLayout));
      await page.locator('#bookpage').selectOption('7');
      await page.locator('.bookstage img').evaluate(img => img.decode());
      await page.getByRole('button', { name: '关闭详情', exact: true }).click();
      await page.locator('[data-query="12738"]').click();
      assert.ok(await page.locator('.row').count() > 0);
      report.layouts.push({ ...layout, dialog: dialogLayout, touchBookNavigation: true });
    }
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.failedRequests, []);
    report.passed = true;
    console.log(JSON.stringify(report));
  } finally {
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

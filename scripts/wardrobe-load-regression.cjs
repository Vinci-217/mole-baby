/** Failure-injection checks through the real wizard-cap player. No user save
 * changes: all cases open the isolated wardrobe preview in new contexts. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5173',out=path.resolve(__dirname,'../artifacts/wardrobe-load');
const url=base+'/?preview=wardrobe&form=super&outfit=1200020';
async function capReady(page){
 await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveAttribute('data-loaded','true',{timeout:35000});
 await expect(page.locator('.wardrobe-mirror .official-hit-mask')).toHaveAttribute('data-loaded','true');
 const frame=await(await page.locator('.wardrobe-mirror iframe').elementHandle()).contentFrame();
 await expect.poll(()=>frame.evaluate(()=>player.ruffle().callExternalInterface('previewStatus')?.form)).toBe('level2');
}
async function shortWatchdog(page){await page.addInitScript(()=>{if(window!==window.top)return;const timeout=window.setTimeout.bind(window);window.setTimeout=(callback,delay,...args)=>timeout(callback,delay===45000?2500:delay,...args)})}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--disable-dev-shm-usage']});
 const checks=[];
 try{
  // A quick move can invalidate the first resting screenshot. It must be
  // captured when the same source rests again, rather than remaining absent.
  let page=await browser.newPage();
  await page.addInitScript(()=>{window.__originalPreviews=[];window.addEventListener('message',event=>{if(event.data?.type==='ram-original-preview')window.__originalPreviews.push(event.data.id)})});
  await page.route('**/runtime.js?*',async route=>{const response=await route.fetch(),body=(await response.text()).replace('}},350);','}},1500);');await route.fulfill({response,body})});
  await page.goto(url);await capReady(page);await page.getByRole('button',{name:'预览左走动作',exact:true}).click();await page.waitForTimeout(1700);
  assert.equal(await page.evaluate(()=>window.__originalPreviews.length),0);
  await page.locator('.wardrobe-grid button[aria-pressed="true"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__originalPreviews.length),{timeout:6000}).toBeGreaterThan(0);
  checks.push({firstPreviewInterruptedByMovement:true,restingPreviewRecovered:true});await page.close();

  // Transient catalogue errors must get a new request, not a rejected promise.
  page=await browser.newPage();let requests=0;
  await page.route('**/assets/original/official/manifest.json*',route=>++requests===1?route.abort():route.continue());
  await page.goto(url);await capReady(page);assert(requests>=2);
  checks.push({manifestFirstRequestFails:true,freshRequestRecovered:true,requests});await page.close();

  // Hold the real engine beyond both watchdogs. Later matching ready must
  // replace the fallback instead of leaving a permanently undressed body.
  page=await browser.newPage();await shortWatchdog(page);
  let release;const held=new Promise(resolve=>release=resolve);
  await page.route('**/*.wasm',async route=>{await held;await route.continue().catch(()=>{})});
  await page.goto(url);await page.waitForTimeout(6500);
  await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveClass(/is-failed/);
  await expect(page.getByRole('button',{name:'重新加载',exact:true})).toBeVisible();
  release();await capReady(page);
  const log=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ramu-animation-load-log-v1')));
  assert(log.some(row=>row.event==='error'&&row.reason.includes('超时')));assert(log.some(row=>row.event==='ready'));
  checks.push({engineHeldPastBothTimeouts:true,lateMatchingReadyRecovered:true});
  await page.screenshot({path:path.join(out,'wizard-recovered.png'),fullPage:true});await page.close();

  // A broken boot script cannot recover merely by reposting a load message.
  // Manual retry replaces the failed frame and starts a fresh runtime.
  page=await browser.newPage();await shortWatchdog(page);
  await page.route('**/runtime.js?*',route=>route.abort());await page.goto(url);await page.waitForTimeout(6500);
  await expect(page.locator('.wardrobe-mirror .official-ram-clip')).toHaveClass(/is-failed/);
  await expect(page.getByRole('button',{name:'导出动画日志',exact:true})).toBeVisible();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出动画日志',exact:true}).click();
  const download=await downloadPromise;await download.saveAs(path.join(out,'failure-load-log.json'));
  assert(JSON.parse(fs.readFileSync(path.join(out,'failure-load-log.json'))).events.some(row=>row.event==='error'));
  await page.unroute('**/runtime.js?*');await page.getByRole('button',{name:'重新加载',exact:true}).click();await capReady(page);
  checks.push({bootScriptFailure:true,explicitRetryRestartsRuntime:true,diagnosticExportContainsErrors:true});await page.close();
  fs.writeFileSync(path.join(out,'recovery-checks.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const asar = require('@electron/asar');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');
const { verifyEdgePeek, makeTired, adopt, openActions, enterHome, roomTab, toDesktop, selectPocket, buy } = require('./smoke-helpers.cjs');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');

function requireFile(filename, magic) {
  const stat = fs.statSync(filename);
  assert.ok(stat.isFile() && stat.size > 0, `Missing or empty package file: ${filename}`);
  if (magic) {
    const handle = fs.openSync(filename,'r');
    try { const bytes = Buffer.alloc(magic.length); fs.readSync(handle,bytes,0,bytes.length,0); assert.deepEqual(bytes,Buffer.from(magic)); }
    finally { fs.closeSync(handle); }
  }
}

async function verifySocialProps(page) {
  const character=page.getByTestId('desktop-character');
  // Earlier drag checks may intentionally trigger the finite shake/dizzy cooldown.
  await expect(character.locator('.ram-sprite')).not.toHaveAttribute('data-action','dizzy',{timeout:5000});
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  const panel=page.getByTestId('companion-panel');
  for(const [name,kind] of [['一起玩球','play'],['摸摸拉姆','pet'],['陪我专注','focus']]) {
    await panel.getByRole('button',{name,exact:true}).click();
    await expect(character.locator(`[data-social-action=${kind}]`)).toBeVisible();
    await expect.poll(()=>character.locator('.ram-sprite').evaluate(n=>Number(n.style.getPropertyValue('--social-opacity'))),{timeout:10000}).toBeGreaterThan(.8);
    const image=character.locator(kind==='play'?'.social-ball':kind==='pet'?'.social-hand':'.social-book>img').first();
    await image.evaluate(n=>n.decode());const box=await image.boundingBox();assert.ok(box.width>20&&box.height>10);
  }
  await expect(page.getByRole('timer',{name:'专注倒计时',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'结束专注',exact:true}).click();await expect(page.getByRole('timer')).toHaveCount(0);
  await panel.getByRole('button',{name:'听拉姆说一句',exact:true}).click();
  const bubble=page.getByRole('button',{name:'回应拉姆的话',exact:true});await expect(bubble).toBeVisible();
  const shared=await bubble.innerText();assert.ok(shared.length>10);
  await bubble.click();await expect(panel.getByRole('log')).toContainText(shared);
  await expect(panel).toHaveAttribute('aria-label','拉姆对话');
  await panel.getByRole('button',{name:'关闭小窗',exact:true}).click();
}

async function verifyApplication({ executable, archive, screenshot }) {
  let desktop, profile, page;
  try {
  requireFile(archive);
  const paths = new Set(asar.listPackage(archive).map(item => item.replace(/\\/g, '/').replace(/^\//, '')));
  for (const filename of [
    'package.json', 'electron/main.cjs', 'electron/mac-settings.cjs', 'electron/Mac 打开说明.html', 'electron/preload.cjs', 'electron/deepseek.cjs', 'electron/speech.cjs', 'dist/index.html', 'dist/favicon.png',
    'dist/assets/classic/middle-neutral.png', 'dist/assets/classic/middle-mask.png',
    'dist/assets/original/scenes/ramu-home.png', 'dist/assets/original/scenes/lake-cabin.png', 'dist/assets/original/scenes/original-earthen-home.png',
    'dist/assets/generated/morning-study.png', 'dist/assets/original/ui/button-orange.png',
    'dist/assets/generated/v6-starlight-greenhouse.png', 'dist/assets/generated/v6-creek-treehouse.png',
    'dist/icons/ramu.png', 'dist/icons/tray.png', 'dist/icons/ramu.ico',
    'dist/icons/ramu.icns', 'dist/icons/tray-mac.png', 'dist/icons/tray-mac@2x.png',
    'dist/assets/generated/v9-petting-hand.png', 'dist/assets/generated/v9-study-book.png', 'dist/assets/generated/v12-dizzy-star.png', 'dist/assets/generated/v12-turning-page.png',
    'dist/assets/original/item-motion/bath-tub.png', 'dist/assets/original/item-motion/toothbrush-generated.png',
    'dist/assets/original/audio/castle.mp3', 'dist/assets/original/audio/pet-shop.mp3', 'dist/assets/original/audio/mystery-lake.mp3',
    'dist/assets/original/items/180027.png', 'dist/assets/original/items/180017.png',
    'dist/assets/original/items/180008.png', 'dist/assets/original/items/180002.png', 'dist/assets/original/items/180003.png',
    'dist/assets/original/seed/pot.png', 'dist/assets/original/seed/body.png', 'dist/assets/original/seed/body-mask.png',
  ]) assert.ok(paths.has(filename), `Required application payload is missing: ${filename}`);
  for (const form of ['junior', 'middle', 'senior']) for (const layer of ['neutral', 'mask']) {
    const filename = `dist/assets/original/care/${form}-${layer}.png`;
    assert.ok(paths.has(filename), `Original care animation atlas is missing: ${filename}`);
  }
  for (const form of ['super','water','wood','fire']) {
    for (const layer of ['neutral','mask']) assert.ok(paths.has(`dist/assets/classic/${form}-${layer}.png`), 'Missing original god-power atlas');
    for (const color of ['red','yellow','blue','pink']) assert.ok(paths.has(`dist/assets/original/pets/${form}-${color}-idle.png`), 'Missing matching original fallback');
  }
  for (const track of ['sunshine-ranch','ramu-school','berry-jungle','snow-rink','playground','magic-carriage','farm-workshop','art-street','raceway']) assert.ok(paths.has(`dist/assets/original/audio/${track}.mp3`), `Missing classic BGM: ${track}`);
  for (const form of ['junior','middle','senior']) for (const layer of ['neutral','mask']) assert.ok(paths.has(`dist/assets/original/item-motion/${form}-${layer}.png`), 'Missing original per-item body atlas');
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json').toString()).version, version);
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json').toString()).name, 'mole-baby');
  assert.ok(![...paths].some(filename => /^(?:src\/|\.git\/|\.env(?:$|\.))/.test(filename)), 'Development source or local configuration was accidentally packaged');
  console.log('PASS: required ASAR payload and packaged application identity');

  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ramu-package-smoke-'));
  desktop = await _electron.launch({
    executablePath: executable,
    args: [`--user-data-dir=${profile}`, ...(process.platform === 'darwin' ? ['--use-mock-keychain'] : [])],
    env: { ...process.env, ELECTRON_DEV: '0' },
    cwd: root,
    timeout: 30000,
  });
  page = await desktop.firstWindow();
  assert.equal(await desktop.evaluate(({ app }) => app.getName()), '拉姆', 'Packaged application display name');
  page.setDefaultTimeout(15000);
  const rendererErrors = [];
  page.on('pageerror', error => rendererErrors.push(error.message));
  assert.ok(page.url().startsWith('file:'), `Expected the packaged renderer: ${page.url()}`);
  await page.waitForFunction(() => window.desktop?.isElectron === true);
  await adopt(page, '红色', '红豆');
  const character = page.locator('.desktop-character');
  await expect(character).toBeVisible();
  await expect(character).toBeInViewport();
  await expect(character.locator('canvas[data-loaded="true"]')).toBeVisible();
  assert.equal(await character.locator('[data-fallback]').count(), 0, 'The original Ram PNG must load without a fallback');
  const state = await page.evaluate(() => window.desktop.getState());
  assert.equal(state.petMode, true);
  assert.equal(await page.evaluate(() => window.desktop.platform), process.platform);
  if (process.platform === 'darwin') {
    await expect.poll(() => desktop.evaluate(({ app }) => app.dock.isVisible())).toBe(false);
    assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisibleOnAllWorkspaces()), true);
  }
  const bounds = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(bounds.width, 200);
  assert.equal(bounds.height, 240);
  const painted = await character.locator('canvas').evaluate(canvas =>
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0));
  assert.equal(painted, true, 'The original Ram canvas must contain visible pixels');
  await page.evaluate(()=>window.desktop.setEdgeHiding(false));
  await page.mouse.move(1,239);await expect(page.getByTestId('pet-actions')).toHaveCount(0);
  await character.hover();await expect(page.getByTestId('pet-actions')).toBeVisible();assert.equal(await page.locator('.compact-reminder').count(),0);
  await page.mouse.move(1,239);await expect(page.getByTestId('pet-actions')).toHaveCount(0);
  console.log('PASS: real native hover and leave show/hide tools, no click needed and no idle timer bar');
  await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-color', 'red');
  const seedPixel = await character.locator('.seed-body-frame').evaluate(canvas => Array.from(canvas.getContext('2d').getImageData(45, 58, 1, 1).data));
  assert.ok(seedPixel[3] > 200 && seedPixel[0] > seedPixel[2], 'the red seed is visibly red in the packaged app');
  const seedBeforeDrag = await desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(await page.evaluate(() => window.desktop.movePet(-10, -10)), true, 'manual dragging moves the seed and its pot');
  const seedAfterDrag = await desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(seedAfterDrag.x, seedBeforeDrag.x - 10);assert.equal(seedAfterDrag.y, seedBeforeDrag.y - 10);
  assert.equal(await page.evaluate(()=>window.desktop.getState()).then(state=>state.wandering),false,'a seed never wanders on its own');
  for(const side of ['left','right'])await verifyEdgePeek(page,desktop,side);
  console.log('PASS: both docked edges hover/click only peek, actual pointer drag releases the seed, random 2–5 minute cadence');
  await expect(page.getByRole('timer')).toHaveCount(0);await verifySocialProps(page);
  console.log('PASS: local thoughtful speech and clickable chat continuity in the shipped native window');
  const speech = await page.evaluate(() => window.companionSpeech.getAvailability());
  assert.equal(typeof speech.available, 'boolean');
  assert.ok(speech.available ? typeof speech.language === 'string' : typeof speech.reason === 'string', 'offline speech availability must explain its status without opening a microphone');
  if (process.platform === 'darwin') { assert.equal(speech.method, 'system-dictation'); assert.match(speech.reason, /听写/); }
  const fakeKey = 'sk-package-smoke-not-a-real-key-0123456789';
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
  console.log('PASS: packaged seed tint, draggable pot, platform speech guidance and local-only API key save/reload/clear without network requests');
  const actions = await openActions(page);
  assert.deepEqual(await actions.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['查看状态','喂食','洗澡','玩耍','开始计时','和拉姆说话','进入小屋']);
  await openActions(page);await actions.getByRole('button', { name: '喂食', exact: true }).click();
  const panel = page.getByTestId('companion-panel'); await expect(panel).toBeVisible();
  const expanded = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(expanded.width, 540); assert.equal(expanded.height, 490);
  assert.equal((await page.evaluate(() => window.desktop.getState())).petMode, true);
  assert.equal(await page.locator('.cottage-scene').count(), 0);
  assert.deepEqual(await panel.getByRole('tab').allTextContents(), ['状态','背包','玩耍','对话']);
  assert.equal(await panel.locator('.pocket-slot').count(), 16);
  const slot=await panel.locator('.pocket-slot').first().boundingBox();assert.ok(Math.abs(slot.width-slot.height)<1,'every backpack cell is square');
  await expect(await selectPocket(page, 'biscuit', '熊熊饼干')).toBeDisabled();
  await panel.getByRole('button', { name: '到小屋补充', exact: false }).click();
  await expect(page.locator('.shop-book')).toBeVisible();
  if (process.platform === 'darwin') assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisibleOnAllWorkspaces()), false);
  await buy(page, 'biscuit', '熊熊饼干');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')).coins)).toBe(85);
  await roomTab(page, '背包'); await (await selectPocket(page, 'biscuit', '熊熊饼干')).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')).inventory.biscuit)).toBe(0);
  await roomTab(page, '设置');
  await page.getByLabel('提醒间隔',{exact:true}).fill('7');
  const media = page.locator('.room-settings');
  assert.equal(await media.getByRole('group',{name:'选择背景音乐',exact:true}).getByRole('button').count(),12);
  await media.getByRole('button', { name: '星光温室', exact: true }).click();
  await media.getByLabel('小屋背景音乐', { exact: true }).uncheck();
  await media.getByRole('button', {name:'预览夜晚',exact:true}).click();
  await expect(page.locator('.cottage-scene')).toHaveAttribute('data-phase','night');
  await page.locator('.time-scene-art img').evaluate(img => img.decode());
  assert.ok((await page.locator('.time-scene-art img').getAttribute('src')).endsWith('/assets/generated/v6-starlight-greenhouse.png'));
  await toDesktop(page); await openActions(page); await makeTired(page);
  await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-frame','61');
  await page.getByRole('button',{name:'叫醒拉姆',exact:true}).click();
  await openActions(page);await expect(page.getByRole('button',{name:'开始计时',exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-preferences-v2')).reminderMinutes),7);
  await page.getByRole('button',{name:'开始计时',exact:true}).click();await expect(page.getByRole('timer',{name:'专注倒计时',exact:true})).toContainText(/0[67]:/);await page.getByRole('button',{name:'取消计时',exact:true}).click();

  await page.evaluate(() => { const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1')); pet.growth = 180; localStorage.setItem('ramu-house-save-v1', JSON.stringify(pet)); });
  await page.reload(); await expect(character.locator('.ram-classic-frame[data-loaded=true]')).toBeVisible({ timeout: 15000 });
  await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-color','red');
  assert.equal(await character.locator('[data-fallback]').count(),0);
  await page.evaluate(async () => { await window.desktop.wander(false); await window.desktop.setEdgeHiding(false); });
  const beforeDrag = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  await page.evaluate(async () => { await window.desktop.setPetCanMove(true); await window.desktop.startPetDrag(); await window.desktop.movePet(-30,-15); await window.desktop.endPetDrag(); });
  const afterDrag = await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  assert.equal(afterDrag.x, beforeDrag.x - 30); assert.equal(afterDrag.y, beforeDrag.y - 15);
  if (process.platform === 'darwin') {
    await openActions(page);await actions.getByRole('button',{name:'和拉姆说话',exact:true}).click();
    await page.getByRole('button',{name:'语音输入',exact:true}).click();
    await expect(page.locator('.chat-notice')).toContainText('听写');
    await expect(page.getByRole('textbox',{name:'和拉姆说话',exact:true})).toBeFocused();
    await desktop.evaluate(({clipboard}) => clipboard.writeText('我喜欢月光。'));
    await page.keyboard.press('Meta+V');
    await expect(page.getByRole('textbox',{name:'和拉姆说话',exact:true})).toHaveValue('我喜欢月光。');
    await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
    await enterHome(page);await roomTab(page,'设置');const help=page.getByRole('region',{name:'Mac 使用帮助',exact:true});await expect(help).toBeVisible();
    await desktop.evaluate(({shell})=>{globalThis.__macHelpOriginal={openExternal:shell.openExternal,openPath:shell.openPath};globalThis.__macHelpCalls=[];shell.openExternal=async uri=>{globalThis.__macHelpCalls.push(uri);};shell.openPath=async file=>{globalThis.__macHelpCalls.push(file);return '';};});
    try{
      await help.getByRole('button',{name:'打开隐私与安全',exact:true}).click();await expect(help.getByRole('status')).toContainText('隐私与安全');
      await help.getByRole('button',{name:'打开听写设置',exact:true}).click();await expect(help.getByRole('status')).toContainText('中文听写');
      await help.getByRole('button',{name:'首次打开说明',exact:true}).click();await expect(help.getByRole('status')).toContainText('安装与首次启动');
      const calls=await desktop.evaluate(()=>globalThis.__macHelpCalls);assert.match(calls[0],/^x-apple\.systempreferences:com\.apple\.preference\.security/);assert.match(calls[1],/^x-apple\.systempreferences:com\.apple\.preference\.keyboard/);
      assert.equal(calls[2],path.join(userData,'help','Mac 打开说明.html'));assert.ok(fs.readFileSync(calls[2],'utf8').includes('仍要打开'));
    }finally{await desktop.evaluate(({shell})=>{Object.assign(shell,globalThis.__macHelpOriginal);delete globalThis.__macHelpCalls;delete globalThis.__macHelpOriginal;});}
    await toDesktop(page);console.log('PASS: Mac settings buttons route to fixed privacy/dictation panes and extract a usable first-open guide from ASAR');
  }
  // Test the shipped evolution selector and original atlas for every form.
  for (const [form, label] of Object.entries({super:'神力超级拉姆',water:'神奇水系拉姆',wood:'弹力木系拉姆',fire:'霹雳火系拉姆'})) {
    await page.evaluate(() => { const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));pet.growth=840;delete pet.evolution;localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet)); });
    await page.reload();await expect(character.locator('.ram-classic-frame[data-loaded=true]')).toBeVisible({timeout:15000});
    await enterHome(page);await roomTab(page,'成长');
    await page.getByRole('button',{name:`选择${label}`,exact:true}).click();await page.getByRole('button',{name:'确认进化',exact:true}).click();
    await toDesktop(page);await page.reload();
    await expect(character.locator('.ram-classic-frame[data-loaded=true]')).toHaveAttribute('data-form',form,{timeout:15000});
    await expect(character.locator('.ram-sprite')).toHaveAttribute('data-stage','4');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).evolution),form);
    assert.equal(await character.locator('[data-fallback]').count(),0);
  }
  await verifySocialProps(page);
  console.log('PASS: original ball, generated hand/book, visible per-stage body/prop motion, manual timer/cancel and no startup countdown in the shipped app');
  console.log('PASS: four shipped original god-power evolutions, deliberate selection and persistent form after reload');
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
  await page.screenshot({path:path.join(root,'artifacts',screenshot)});
  await desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].close());
  await expect.poll(() => desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);
  assert.equal(await desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().length),1, 'close must keep the tray process alive');
  if (process.platform === 'darwin') {
    await desktop.evaluate(({Menu}) => Menu.getApplicationMenu().items[0].submenu.items.find(item => item.label === '显示拉姆').click());
  } else await desktop.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].show());
  await expect(character).toBeVisible(); assert.deepEqual(rendererErrors,[]);
  console.log(`PASS: packaged ${process.platform}/${process.arch} tray lifecycle, native dragging, ordered desktop tools/sixteen-slot bag, room-only bookshop, real supplies, sleep/wake and four-phase generated scene`);

  } catch (error) {
    if (page && !page.isClosed()) {
      console.error('Renderer loading diagnostics:', await page.evaluate(() => ({
        visibility: document.visibilityState,
        action: document.querySelector('.ram-sprite')?.getAttribute('data-action'),
        bubble: document.querySelector('.compact-bubble')?.textContent,
        desktop: document.querySelectorAll('.desktop-character').length,
        canvases: Array.from(document.querySelectorAll('.ram-classic-frame')).map(canvas => ({ ...canvas.dataset })),
        fallbacks: document.querySelectorAll('[data-fallback]').length,
      })).catch(() => 'renderer unavailable'));
      await page.screenshot({path:path.join(root,'artifacts',screenshot)}).catch(() => {});
    }
    throw error;
  } finally {
    if (desktop) {
      const closed = desktop.waitForEvent('close', { timeout: 20000 });
      await desktop.evaluate(({ app }) => app.quit()).catch(() => {});
      await closed;
    }
    if (profile) await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 15, retryDelay: 250 });
  }
}
module.exports = { verifyApplication, requireFile };

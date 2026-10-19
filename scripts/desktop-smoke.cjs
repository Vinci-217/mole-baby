const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');
const { adopt, openActions, enterHome, roomTab, toDesktop, selectPocket, buy } = require('./smoke-helpers.cjs');

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
  await expect.poll(async () => character.locator('canvas[data-loaded="true"], .ram-sprite[data-fallback]').count(), { timeout: 20000 }).toBeGreaterThan(0);
  assert.equal(await character.locator('.ram-sprite[data-fallback]').count(), 0, `${selector}: classic PNGs must not silently fall back to illustrations`);
  await expect(character.locator('canvas[data-loaded="true"]')).toBeVisible();
  const painted = await character.locator('canvas').evaluate(canvas => {
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
  await adopt(page, '红色', '红豆');
  const character = page.getByTestId('desktop-character'); await expect(character.locator('.seed-body-frame[data-loaded=true]')).toBeVisible(); await expect(character.locator('.seed-body-frame')).toHaveAttribute('data-color','red');
  assert.ok(Object.values((await save()).inventory).every(count => count === 0)); await expect.poll(async () => (await state()).petMode).toBe(true);
  assert.deepEqual({width:(await bounds()).width,height:(await bounds()).height},{width:200,height:240});
  const area = await desktop.evaluate(({screen}) => screen.getPrimaryDisplay().workArea); const seedBounds=await bounds();
  assert.ok(area.x+area.width-seedBounds.x-seedBounds.width <= 20, 'a fresh pet starts beside the bottom-right tray');
  assert.ok(area.y+area.height-seedBounds.y-seedBounds.height <= 20);

  assert.equal(await page.evaluate(()=>window.desktop.movePet(-40,-30)),true); assert.equal(await page.evaluate(()=>window.desktop.wander(true)),false); assert.equal((await bounds()).x,seedBounds.x-40);
  await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([200,240]); await expect(character).toBeInViewport();
  const cb=await character.boundingBox(); await page.mouse.move(cb.x+50,cb.y+55); await page.mouse.down(); await page.mouse.move(cb.x+80,cb.y+45); await page.waitForTimeout(150); assert.notEqual(await character.locator('.seed-body-original').evaluate(n=>n.style.transform),'rotate(0deg)'); assert.notEqual((await bounds()).x,seedBounds.x-40); await page.mouse.up();
  await page.screenshot({path:path.join(artifacts,'v9-native-seed.png'),omitBackground:true});
  console.log('PASS bottom-right tray pet, 200x240 native window, four-color original seed and manual seed pointer/IPC drag with autonomous wandering disabled');

  // Seed pots can be manually placed at either side, at any height.
  for(const edge of ['left','right']) {
    const beforeEdge=await bounds(),targetY=area.y+Math.min(240,area.height-240);
    await page.evaluate(async({dx,dy})=>{await window.desktop.setInteracting(false);await window.desktop.startPetDrag();await window.desktop.movePet(dx,dy);await window.desktop.endPetDrag();},{dx:(edge==='left'?area.x:area.x+area.width-200)-beforeEdge.x,dy:targetY-beforeEdge.y});
    await expect.poll(async()=>(await state()).edgePose,{timeout:5000}).toBe('hidden');
    assert.equal((await bounds()).y,targetY);assert.equal((await state()).wandering,false);
    await character.click({position:{x:edge==='left'?90:10,y:54},force:true});
    await expect.poll(async()=>(await state()).edgePose).toBe('visible');await expect(page.getByTestId('pet-actions')).toBeVisible();await expect(character).toBeInViewport();
  }
  console.log('PASS seed manually hides at both vertical edges without walking or changing height');

  // Grow only this isolated fixture; normal adoption always starts with a seed.
  await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.growth=180;p.stats.hunger=50;p.stats.cleanliness=50;localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));});
  await page.reload(); await waitForClassic(page,'.desktop-character'); await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false);});
  const current=await bounds(); const targetX=area.x+Math.min(350,area.width-550),targetY=area.y+Math.min(400,area.height-250); await page.evaluate(({dx,dy})=>window.desktop.movePet(dx,dy),{dx:targetX-current.x,dy:targetY-current.y});
  const before=await bounds(); const actions=await openActions(page); assert.deepEqual(await actions.getByRole('button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),['查看状态','喂食','洗澡','玩耍','休息','和拉姆说话','进入小屋']);
  await actions.getByRole('button',{name:'喂食',exact:true}).click(); const panel=page.getByTestId('companion-panel');await expect(panel).toBeVisible();await expect.poll(async()=>(await bounds()).width).toBe(540); assert.equal((await bounds()).height,490);assert.equal((await state()).petMode,true);
  const expanded=await bounds(),side=(await state()).panelSide; assert.equal(expanded.x+(side==='left'?340:0),before.x);assert.equal(expanded.y+250,before.y);assert.equal(await page.locator('.cottage-scene').count(),0);
  assert.deepEqual(await panel.getByRole('tab').allTextContents(),['状态','背包','玩耍','对话']); assert.equal(await panel.getByRole('button',{name:'商店',exact:true}).count(),0); assert.equal(await panel.locator('.pocket-slot').count(),16);await expect(await selectPocket(page,'biscuit','熊熊饼干')).toBeDisabled();
  await page.screenshot({path:path.join(artifacts,'v9-native-backpack.png'),omitBackground:true}); await page.getByLabel('关闭小窗').click(); await expect.poll(() => page.evaluate(()=>[innerWidth,innerHeight])).toEqual([200,240]);assert.equal((await bounds()).x,before.x);assert.equal((await bounds()).y,before.y);
  const rightX=area.x+area.width-200;await page.evaluate(dx=>window.desktop.movePet(dx,0),rightX-before.x);await actions.getByRole('button',{name:'喂食',exact:true}).click();await expect.poll(async()=>(await state()).panelSide).toBe('left');assert.equal((await bounds()).x+340,rightX);await page.getByLabel('关闭小窗').click();await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([200,240]);await page.evaluate(dx=>window.desktop.movePet(dx,0),before.x-rightX);await expect(character).toBeInViewport();
  console.log('PASS seven tools and desktop-only tabs, sixteen-slot bag, adjacent 332px panel, both native sides and unchanged physical pet anchor');

  await actions.getByRole('button',{name:'玩耍',exact:true}).click();
  await panel.getByRole('button',{name:'听拉姆说一句',exact:true}).click();
  const spoken=page.getByRole('button',{name:'回应拉姆的话',exact:true});await fullyInsideNativeWindow(spoken,'companion speech bubble');
  const sharedLine=await spoken.innerText();await page.screenshot({path:path.join(artifacts,'v10-native-presence.png'),omitBackground:true});
  await spoken.click();await expect(panel.getByRole('log')).toContainText(sharedLine);await expect(panel).toHaveAttribute('aria-label','拉姆对话');
  await page.getByLabel('关闭小窗').click();await expect.poll(()=>page.evaluate(()=>[innerWidth,innerHeight])).toEqual([200,240]);
  await expect(page.getByRole('timer')).toHaveCount(0);
  console.log('PASS warm local speech fits the small native window and actual bubble click preserves context in the adjacent chat');

  const mature=await character.boundingBox(),beforeDrag=await bounds();await page.mouse.move(mature.x+50,mature.y+55);await page.mouse.down();await page.mouse.move(mature.x+110,mature.y+75);await page.mouse.up();await expect.poll(async()=>(await bounds()).x).toBe(beforeDrag.x+60);await expect.poll(async()=>(await bounds()).y).toBe(beforeDrag.y+20);
  await page.keyboard.press('Escape');await page.evaluate(()=>window.desktop.wander(true));await expect.poll(async()=>(await state()).motion,{timeout:20000}).toMatch(/^(left|right)$/);await expect(character.locator('.ram-sprite')).toHaveClass(/action-walk-(left|right)/);
  await openActions(page);await actions.getByRole('button',{name:'查看状态',exact:true}).click();await expect.poll(async()=>(await state()).motion).toBe('idle');await page.evaluate(()=>window.desktop.wander(false));await page.getByLabel('关闭小窗').click();await page.keyboard.press('Escape');
  await page.evaluate(async()=>{await window.desktop.setEdgeHiding(true);await window.desktop.setInteracting(false);await window.desktop.startPetDrag();});const nowBounds=await bounds();await page.evaluate(({dx,dy})=>window.desktop.movePet(dx,dy),{dx:rightX-nowBounds.x,dy:area.y+area.height-240-nowBounds.y});await page.evaluate(()=>window.desktop.endPetDrag());
  await expect.poll(async()=>(await state()).edgePose,{timeout:5000}).toBe('hidden');await expect.poll(async()=>(await state()).edgePose,{timeout:21000}).toBe('peek');await expect(page.locator('.companion-layout')).toHaveClass(/edge-peek/);await page.evaluate(()=>window.desktop.revealPet());assert.equal((await state()).edgePose,'visible');await page.evaluate(()=>window.desktop.setEdgeHiding(false));
  const pinned=await page.evaluate(()=>window.desktop.toggleAlwaysOnTop());assert.equal((await state()).alwaysOnTop,pinned);await page.evaluate(()=>window.desktop.toggleAlwaysOnTop());
  console.log('PASS real mature dragging, timed directional walking, interaction pause, corner tuck/peek/reveal and pin state');

  await openActions(page);await actions.getByRole('button',{name:'休息',exact:true}).click();await expect(character.locator('.ram-sprite')).toHaveAttribute('data-sleeping','true');await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-row','8');await expect(character.locator('.ram-classic-frame')).toHaveAttribute('data-frame','0');await actions.getByRole('button',{name:'叫醒',exact:true}).click();await expect.poll(async()=>(await save()).sleeping).toBe(false);
  await enterHome(page);await buy(page,'biscuit','熊熊饼干');await expect.poll(async()=>(await save()).coins).toBe(85);await roomTab(page,'背包');const beforeFood=await save();await(await selectPocket(page,'biscuit','熊熊饼干')).click();await expect.poll(async()=>(await save()).inventory.biscuit).toBe(0);assert.ok((await save()).stats.hunger>beforeFood.stats.hunger+10);await expect(page.locator('.scene-character .ram-sprite')).toHaveAttribute('data-action','eat-bear-biscuit');
  const foodImage=page.locator('.care-pocket .pocket-slot[data-item-id="biscuit"] img');await foodImage.evaluate(i=>i.decode());assert.ok((await foodImage.getAttribute('src')).includes('original/items/'));
  const beforeShortGames=(await save()).completedGames;await roomTab(page,'游戏');await page.getByRole('button',{name:'开始接果子',exact:true}).click();await page.getByTestId('fruit-game-start').click();await expect(page.locator('.fruit-dialog')).toHaveAttribute('data-phase','playing');await fullyInsideNativeWindow(page.locator('.fruit-scoreboard'),'fruit score/timer');await fullyInsideNativeWindow(page.getByTestId('game-arena'),'fruit surface');await page.screenshot({path:path.join(artifacts,'v6-native-fruit-game.png')});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'开始翻牌',exact:true}).click();await page.getByTestId('memory-start').click();await expect(page.locator('.memory-dialog')).toHaveAttribute('data-phase','playing',{timeout:5000});await fullyInsideNativeWindow(page.locator('.memory-scoreboard'),'memory score/timer');await fullyInsideNativeWindow(page.getByTestId('memory-board'),'entire memory board');await page.keyboard.press('Escape');assert.equal((await save()).completedGames,beforeShortGames);
  console.log('PASS room-only real purchases, original food decode, finite eating, sleep/wake and native game surfaces without clipping or abort rewards');

  await roomTab(page,'设置');await page.getByLabel('拉姆的新名字').fill('红豆陪伴');await page.locator('.room-rename').getByRole('button',{name:'保存',exact:true}).click();await expect.poll(async()=>(await save()).name).toBe('红豆陪伴');
  const speech=await page.evaluate(()=>window.companionSpeech.getAvailability());assert.equal(speech.available,false);assert.equal(typeof speech.reason,'string');
  const fakeKey='sk-local-smoke-not-a-real-key-0123456789';assert.equal((await page.evaluate(()=>window.companionAI.getSettings())).configured,false);const ai=await page.evaluate(key=>window.companionAI.setKey(key),fakeKey);assert.equal(ai.configured,true);assert.deepEqual(Object.keys(ai).sort(),['configured','protection']);assert.equal(await page.evaluate(key=>Object.values(localStorage).some(value=>value.includes(key)),fakeKey),false);
  const userData=await desktop.evaluate(({app})=>app.getPath('userData'));const keyRecord=path.join(userData,'companion-ai-key.json');assert.ok(fs.existsSync(keyRecord));if(ai.protection==='os-encrypted')assert.equal(fs.readFileSync(keyRecord,'utf8').includes(fakeKey),false);
  const settings=page.locator('.room-settings');await settings.getByRole('button',{name:'神秘湖木屋',exact:true}).click();await settings.getByLabel('小屋背景音乐',{exact:true}).uncheck();await settings.getByRole('group',{name:'选择背景音乐',exact:true}).getByRole('button',{name:'神秘湖',exact:true}).click();
  await page.locator('.time-scene-art img').evaluate(i=>i.decode());assert.ok((await page.locator('.time-scene-art img').getAttribute('src')).endsWith('/assets/original/scenes/lake-cabin.png'));await toDesktop(page);await waitForClassic(page,'.desktop-character');
  await page.mouse.move(-20,-20);await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:path.join(artifacts,'v6-native-compact.png'),omitBackground:true});
  // A window close/minimize hides the live app. Only an explicit quit ends it.
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);assert.equal(await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());await expect(character).toBeVisible();
  await page.evaluate(()=>window.desktop.minimize());await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  assert.deepEqual(rendererErrors,[]);assert.deepEqual(failedAssets,[]);assert.deepEqual(retiredAssets,[]);await quitDesktop();
  desktop=await _electron.launch({args,env,cwd:root,timeout:30000});const restarted=await desktop.firstWindow();restarted.setDefaultTimeout(15000);restarted.on('pageerror',e=>rendererErrors.push(e.message));await restarted.waitForFunction(()=>window.desktop?.isElectron===true&&window.companionAI);await waitForClassic(restarted,'.desktop-character');
  assert.equal(await restarted.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).name),'红豆陪伴');assert.equal((await restarted.evaluate(()=>window.companionAI.getSettings())).configured,true);assert.equal(await restarted.evaluate(key=>Object.values(localStorage).some(v=>v.includes(key)),fakeKey),false);const media=await restarted.evaluate(()=>JSON.parse(localStorage.getItem('ramu-room-media-v1')));assert.equal(media.backgroundId,'lake-cabin');assert.equal(media.musicId,'mystery-lake');assert.equal(media.musicEnabled,false);
  console.log('PASS close/minimize keep live tray process, explicit quit/relaunch persists pet, media and local API key');

  // Farewell removes only this pet and its memories, not application settings/key.
  const petId=await restarted.evaluate(()=>String(JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt));await enterHome(restarted);await roomTab(restarted,'设置');await restarted.getByRole('button',{name:'送别拉姆',exact:true}).click();await restarted.getByRole('button',{name:'确认送别',exact:true}).click();
  await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);assert.equal(await restarted.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),null);assert.equal(await restarted.evaluate(id=>localStorage.getItem(`ramu-companion-memory-v1:${id}`),petId),null);assert.equal((await restarted.evaluate(()=>window.companionAI.getSettings())).configured,true);assert.ok(await restarted.evaluate(()=>localStorage.getItem('ramu-room-media-v1')));
  await quitDesktop();desktop=await _electron.launch({args,env,cwd:root,timeout:30000});const adoptedAgain=await desktop.firstWindow();adoptedAgain.setDefaultTimeout(15000);await adopt(adoptedAgain,'黄色','新芽');await expect(adoptedAgain.locator('.seed-body-frame[data-loaded=true]')).toHaveAttribute('data-color','yellow');const fresh=await adoptedAgain.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert.equal(fresh.growth,0);assert.notEqual(String(fresh.createdAt),petId);assert.equal(fresh.coins,100);assert.equal((await adoptedAgain.evaluate(()=>window.companionAI.clearKey())).configured,false);assert.equal(fs.existsSync(keyRecord),false);assert.deepEqual(rendererErrors,[]);
  console.log('PASS confirmed farewell hides to tray, removes only pet/save/memory, preserves key/preferences, real-process restart requires fresh two-step seed adoption');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(desktop)await quitDesktop().catch(()=>{});
  if(windowManager){try{process.kill(-windowManager.pid,'SIGTERM');}catch{}}
  if(virtualDisplay)virtualDisplay.kill();
});

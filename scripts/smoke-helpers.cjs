const { expect } = require('@playwright/test');
const {PET_SIZE}=require('../electron/desktop-geometry.cjs');

async function adopt(page, color = '蓝色', name = '小蓝') {
  const colors = page.getByRole('button', { name: /^选择.+色拉姆$/ });
  await expect(colors).toHaveCount(4);
  await page.getByRole('button', { name: `选择${color}拉姆`, exact: true }).click();
  await page.getByRole('button', { name: '给它起名', exact: true }).click();
  await page.locator('#pet-name').fill(name);
  await page.getByRole('button', { name: '带拉姆回家！', exact: true }).click();
  await page.getByTestId('desktop-character').waitFor();
}
async function openActions(page) {
  const edge=await page.evaluate(async()=>window.desktop?.getState? (await window.desktop.getState()).edgePose : 'visible');
  if(edge!=='visible') await page.evaluate(()=>window.desktop.revealPet());
  const actions = page.getByTestId('pet-actions');
  if (!(await actions.isVisible())) await page.getByTestId('desktop-character').hover();
  await expect(actions).toBeVisible();
  return actions;
}
async function enterHome(page) {
  if (await page.locator('.cottage-scene').isVisible()) return;
  const actions = await openActions(page);
  await actions.getByRole('button', { name: '进入小屋', exact: true }).click();
  await expect(page.locator('.cottage-scene')).toBeVisible();
}
async function roomTab(page, label) {
  await expect(page.locator('.cottage-scene')).toBeVisible({timeout:15000});
  const paperButton = page.locator('.paper-tabs').getByRole('button', { name: label, exact: true });
  if (await paperButton.isVisible()) { await paperButton.click(); return; }
  // Every room function is also reachable without an open paper dialog.
  const dock = page.locator('.classic-dock');
  const aliases = { 状态: ['状态', '我的拉姆'], 背包: ['背包', '打开背包', '食物口袋'], 商店: ['商店', '进入商店', '拉姆商店'], 游戏: ['游戏', '游乐时光'], 成长: ['成长', '成长手册'], 对话: ['对话', '和拉姆说话'], 设置: ['设置', '陪伴设置'] };
  for (const name of aliases[label] || [label]) {
    const button = dock.getByRole('button', { name, exact: true });
    if (await button.isVisible()) { await button.click(); return; }
  }
  throw new Error(`No visible room navigation for ${label}`);
}
async function toDesktop(page) {
  const close = page.getByRole('button', { name: '关闭面板', exact: true });
  while (await close.isVisible()) await close.click();
  await page.getByRole('button', { name: '回到桌面', exact: true }).click();
  await page.getByTestId('desktop-character').waitFor();
}
async function selectPocket(page, id, label) {
  const pocket = page.locator('.care-pocket');
  const item = pocket.locator(`.pocket-slot[data-item-id="${id}"]`);
  if (!(await item.count())) {
    const next = pocket.getByRole('button', { name: '背包下一页', exact: true });
    while (!(await item.count()) && await next.isEnabled()) await next.click();
  }
  await item.click();
  const use = pocket.getByRole('button', { name: `使用${label}`, exact: true });
  await expect(use).toBeVisible();
  return use;
}
async function buy(page, id, label, category = '食物') {
  await roomTab(page, '商店');
  const shop = page.locator('.shop-book');
  await shop.getByRole('button', { name: `翻开${category}商品书`, exact: true }).click();
  const item = shop.locator(`.book-product[data-item-id="${id}"]`);
  if (!(await item.count())) {
    const next = shop.getByRole('button', { name: '商店下一页', exact: true });
    while (!(await item.count()) && await next.isEnabled()) await next.click();
  }
  await item.click();
  const button = shop.getByRole('button', { name: `购买${label}`, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}
// Test fixture: drain energy without a manual sleep command, then let the real clock policy rest.
async function makeTired(page) {
  await page.evaluate(()=>{
    const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));
    p.stats.energy=15;p.sleeping=false;delete p.awakeUntil;p.lastTick=Math.max(p.createdAt,Date.now()-1000);
    localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));
  });
  await page.reload();await expect(page.getByTestId('desktop-character').locator('.ram-sprite')).toHaveAttribute('data-sleeping','true');
}
async function verifyEdgePeek(page,desktop,side){
  const character=page.getByTestId('desktop-character');
  const settle=async pose=>{
    // Native state arrives before the 850 ms CSS transition finishes. Use the
    // painted position so forced pointer events hit the exposed strip.
    const x=(side==='left'?-1:1)*(pose==='hidden'?105:65);
    await expect.poll(()=>page.locator('.compact-pet').evaluate(n=>new DOMMatrix(getComputedStyle(n).transform).m41)).toBeCloseTo(x,1);
  };
  await page.keyboard.press('Escape');await page.mouse.move(1,239);await page.waitForTimeout(300);
  const {area}=await desktop.evaluate(({BrowserWindow,screen})=>{const bounds=BrowserWindow.getAllWindows()[0].getBounds();return {area:screen.getDisplayMatching(bounds).workArea};});
  const targetX=side==='left'?area.x:area.x+area.width-PET_SIZE.width,targetY=area.y+Math.min(240,area.height-240);
  const place=async x=>{
    await page.evaluate(async()=>{await window.desktop.setEdgeHiding(false);await window.desktop.setInteracting(false);});
    const current=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    await page.evaluate(async({dx,dy})=>{await window.desktop.startPetDrag();await window.desktop.movePet(dx,dy);await window.desktop.setEdgeHiding(true);await window.desktop.endPetDrag();},{dx:x-current.x,dy:targetY-current.y});
  };
  const state=()=>page.evaluate(()=>window.desktop.getState());
  if(side==='left'){
    await place(targetX);await page.waitForTimeout(950);expect((await state()).edgeSide).toBeNull();await expect(character).toBeInViewport();return;
  }
  await place(targetX-20);await page.waitForTimeout(950);expect((await state()).edgeSide).toBeNull();
  await place(targetX);
  await expect.poll(async()=>(await state()).edgePose,{timeout:6000}).toBe('hidden');await settle('hidden');
  await character.hover({position:{x:side==='left'?90:10,y:54},force:true});await expect.poll(async()=>(await state()).edgePose).toBe('peek');await settle('peek');
  await expect(character.locator('.ram-sprite')).toHaveClass(/is-peeking/);
  const lean=await character.locator('.seed-body-original,.ram-artwork').first().evaluate(n=>{const m=new DOMMatrix(getComputedStyle(n).transform);return Math.atan2(m.b,m.a)*180/Math.PI;});expect(lean).toBeCloseTo(-7,1);
  await expect(page.getByTestId('pet-actions')).toHaveCount(0);
  await character.click({position:{x:side==='left'?90:10,y:54},force:true});await expect.poll(async()=>(await state()).edgeSide).toBe(side);
  await expect.poll(async()=>(await state()).edgePose).toBe('peek');await expect(page.getByTestId('pet-actions')).toHaveCount(0);
  await page.mouse.move(100,5);await expect.poll(async()=>(await state()).edgePose).toBe('hidden');await settle('hidden');
  const until=(await state()).edgeNextPeekAt-Date.now();expect(until).toBeGreaterThan(118000);expect(until).toBeLessThanOrEqual(300000);
  await character.hover({position:{x:side==='left'?90:10,y:54},force:true});await expect.poll(async()=>(await state()).edgePose).toBe('peek');await settle('peek');
  const start=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  const localX=side==='left'?12:PET_SIZE.width-12,y=125;await page.mouse.move(localX,y);await page.mouse.down();
  // Keep physical screen coordinates stable while the native window follows the drag.
  for(let n=1;n<=8;n++){
    const current=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    await page.mouse.move(start.x+localX+(side==='left'?150:-150)*n/8-current.x,y);
    await page.evaluate(()=>window.desktop.getState());
  }
  await page.mouse.up();await expect.poll(async()=>(await state()).edgeSide).toBeNull();await expect.poll(async()=>(await state()).edgePose).toBe('visible');
  const after=await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());expect(after.y).toBe(targetY);await expect(character).toBeInViewport();
}
async function verifyStageSettings(page){
  await enterHome(page);await roomTab(page,'设置');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const memoryKey=`ramu-companion-memory-v1:${before.createdAt}`;
  const memoryBefore=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),memoryKey);
  const settings=page.getByRole('region',{name:'当前成长阶段',exact:true});
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const [stage,label] of ['种子期','初级拉姆','中级拉姆','高级拉姆','神力拉姆'].entries()){
    await settings.getByRole('button',{name:`切换到${label}`,exact:true}).click();
    await expect(settings.getByRole('button',{name:`切换到${label}`,exact:true})).toHaveAttribute('aria-pressed','true');
    // An already selected stage keeps its progress, and the real clock may tick.
    const growth=(await save()).growth,thresholds=[0,60,180,420,840];
    expect(growth).toBeGreaterThanOrEqual(thresholds[stage]);
    if(stage<4)expect(growth).toBeLessThan(thresholds[stage+1]);else expect(growth).toBe(840);
  }
  for(const [form,label] of Object.entries({super:'神力超级拉姆',fire:'霹雳火系拉姆',wood:'弹力木系拉姆',water:'神奇水系拉姆'})){
    await settings.getByRole('button',{name:`切换为${label}`,exact:true}).click();await expect.poll(async()=>(await save()).evolution).toBe(form);
  }
  await toDesktop(page);await page.reload();
  const sprite=page.getByTestId('desktop-character').locator('.ram-sprite');
  await expect(sprite).toHaveAttribute('data-stage','4');await expect(sprite).toHaveAttribute('data-evolution','water');await expect(sprite).toHaveAttribute('data-color',before.color);
  await enterHome(page);await roomTab(page,'设置');await settings.getByRole('button',{name:'切换到种子期',exact:true}).click();
  await toDesktop(page);await page.reload();await expect(sprite).toHaveAttribute('data-stage','0');await expect(sprite).toHaveAttribute('data-color',before.color);
  const after=await save();for(const key of ['name','color','createdAt','coins','inventory','completedGames'])expect(after[key]).toEqual(before[key]);expect(after.evolution).toBeUndefined();
  const memoryAfter=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),memoryKey);
  if(memoryBefore){expect(memoryAfter.facts).toEqual(memoryBefore.facts);expect(memoryAfter.messages).toEqual(memoryBefore.messages);for(const event of memoryBefore.events)expect(memoryAfter.events.some(e=>e.id===event.id)).toBe(true);}
}

async function verifyRecolorPotion(page){
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const before=await save(),color=before.color==='blue'?'pink':'blue',name=color==='blue'?'蓝色换色药水':'粉色换色药水',id=`recolor-${color}`;
  expect(before.coins).toBeGreaterThanOrEqual(80);await enterHome(page);await buy(page,id,name,'药水');
  expect((await save()).coins).toBe(before.coins-80);expect((await save()).inventory[id]).toBe((before.inventory[id]??0)+1);
  await toDesktop(page);await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'喂食',exact:true}).click();await page.locator('.pocket-categories').getByRole('button',{name:'药水',exact:true}).click();await(await selectPocket(page,id,name)).click();
  await expect(page.locator('[data-item-gesture=recolor]')).toBeVisible();await expect.poll(async()=>(await save()).color).toBe(color);await expect(page.locator('[data-item-gesture=recolor]')).toHaveCount(0,{timeout:6000});
  await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await page.reload();const ram=page.getByTestId('desktop-character').locator('.ram-sprite');await expect(ram).toHaveAttribute('data-color',color);
  const after=await save();for(const key of ['name','createdAt','evolution','completedGames'])expect(after[key]).toEqual(before[key]);expect(after.inventory[id]??0).toBe(before.inventory[id]??0);for(const key of Object.keys(before.inventory))expect(after.inventory[key]).toBe(before.inventory[key]);
}

module.exports = { adopt, openActions, enterHome, roomTab, toDesktop, selectPocket, buy, makeTired,verifyEdgePeek,verifyStageSettings,verifyRecolorPotion };

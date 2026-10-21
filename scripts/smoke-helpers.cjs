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
  // A still-visible toolbar can belong to the panel's previous native bounds.
  // Re-enter the pet after resize so normal pointer events target its new anchor.
  await page.getByTestId('desktop-character').hover();
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
async function verifyStageSettings(page,desktop){
  await enterHome(page);await roomTab(page,'设置');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const memoryKey=`ramu-companion-memory-v1:${before.createdAt}`;
  const memoryBefore=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),memoryKey);
  const settings=page.getByRole('region',{name:'当前成长阶段',exact:true});
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const [stage,label] of ['种子期','初级拉姆','中级拉姆','高级拉姆','神力拉姆'].entries()){
    await settings.getByRole('button',{name:`切换到${label}`,exact:true}).click();
    await expect(settings.getByRole('button',{name:`切换到${label}`,exact:true})).toHaveAttribute('aria-pressed','true');
    if(stage===1||stage===2){const canvas=page.locator('.scene-character canvas');await expect(canvas).toHaveAttribute('data-sheet','grounded');await expect(canvas).toHaveAttribute('data-form',stage===1?'junior':'middle');}
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
  await enterHome(page);await roomTab(page,'设置');await settings.getByRole('button',{name:'切换到初级拉姆',exact:true}).click();
  await toDesktop(page);const character=page.getByTestId('desktop-character');await character.hover({position:{x:94,y:54}});
  await expect.poll(async()=>Number(await character.locator('canvas').getAttribute('data-gaze-x'))).toBeGreaterThan(1);
  console.log('PASS: nearby pointer attention responds in the actual desktop window');
  if(desktop){
    await enterHome(page);await roomTab(page,'设置');
    await settings.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();
    await settings.getByRole('button',{name:'切换为神力超级拉姆',exact:true}).click();await toDesktop(page);
    await expect(character.locator('canvas')).toHaveAttribute('data-form','super');
    await character.locator('.ram-flight-layer').evaluate(n=>{window.__nativeFlight=n.getAnimations()[0];});
    const flags=await page.evaluate(()=>window.desktop.getState());
    await page.mouse.move(1,239);await page.keyboard.press('Escape');
    await page.evaluate(async()=>{await window.desktop.setEdgeHiding(false);await window.desktop.wander(true);await window.desktop.setInteracting(false);});
    const bounds=()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    const placed=await bounds();
    await expect.poll(()=>page.evaluate(async()=>{
      const state=await window.desktop.getState(),sprite=document.querySelector('[data-testid="desktop-character"] .ram-sprite');
      return (state.motion==='left'||state.motion==='right')&&sprite.querySelector('canvas').dataset.row===(state.motion==='left'?'2':'1')&&sprite.classList.contains('is-flying')&&sprite.querySelector('.ram-flight-layer').getAnimations()[0]===window.__nativeFlight;
    }),{timeout:22000}).toBe(true);
    await expect.poll(()=>page.evaluate(()=>window.desktop.getState().then(s=>s.motion)),{timeout:4000}).toBe('idle');
    await expect(character.locator('canvas')).toHaveAttribute('data-row','0');
    expect(await character.locator('.ram-flight-layer').evaluate(n=>n.getAnimations()[0]===window.__nativeFlight)).toBe(true);
    const moved=await bounds();expect(Math.abs(moved.x-placed.x)).toBeGreaterThanOrEqual(12);expect(Math.abs(moved.x-placed.x)).toBeLessThanOrEqual(28);expect(moved.y).toBe(placed.y);
    await page.evaluate(async flags=>{await window.desktop.wander(flags.wandering);await window.desktop.setEdgeHiding(flags.edgeHiding);},flags);
    console.log('PASS: autonomous wandering takes short random 12-28px steps and preserves placement height');
    console.log('PASS: super Ram follows native movement with original side-facing flight and returns to front');
  }

  await enterHome(page);await roomTab(page,'设置');await settings.getByRole('button',{name:'切换到种子期',exact:true}).click();
  await toDesktop(page);await page.reload();await expect(sprite).toHaveAttribute('data-stage','0');await expect(sprite).toHaveAttribute('data-color',before.color);
  const after=await save();for(const key of ['name','color','createdAt','coins','inventory','completedGames'])expect(after[key]).toEqual(before[key]);expect(after.evolution).toBeUndefined();
  console.log('PASS: original junior/middle layered atlases load through actual stage settings');
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
  await expect(page.getByTestId('care-gain')).toContainText(`变为${color==='blue'?'蓝色':'粉色'}`);await expect(page.getByTestId('care-gain')).toHaveCount(0,{timeout:4000});
  console.log('PASS: successful colour-potion feedback appears after use and fades away');
  await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await page.reload();const ram=page.getByTestId('desktop-character').locator('.ram-sprite');await expect(ram).toHaveAttribute('data-color',color);
  const after=await save();for(const key of ['name','createdAt','evolution','completedGames'])expect(after[key]).toEqual(before[key]);expect(after.inventory[id]??0).toBe(before.inventory[id]??0);for(const key of Object.keys(before.inventory))expect(after.inventory[key]).toBe(before.inventory[key]);
}

async function verifyPetLife(page){
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  await page.getByRole('button',{name:'看看小蝴蝶',exact:true}).click();
  const ram=page.getByTestId('desktop-character').locator('.ram-sprite');await expect(ram).toHaveAttribute('data-action','watch-butterfly');
  const image=ram.locator('.social-butterfly>img');await expect(image).toBeVisible();expect(await image.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);
  const scroll=await page.locator('.companion-content').evaluate(n=>({height:n.clientHeight,content:n.scrollHeight}));expect(scroll.content).toBeLessThanOrEqual(scroll.height+1);
  await expect(ram).not.toHaveAttribute('data-action','watch-butterfly',{timeout:8500});await expect(ram.locator('.social-butterfly')).toHaveCount(0);await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await enterHome(page);await roomTab(page,'设置');await page.getByRole('slider',{name:'拉姆音量',exact:true}).fill('31');await page.getByRole('checkbox',{name:'自然小动作',exact:true}).uncheck();
  await toDesktop(page);await page.reload();await enterHome(page);await roomTab(page,'设置');await expect(page.getByRole('slider',{name:'拉姆音量',exact:true})).toHaveValue('31');await expect(page.getByRole('checkbox',{name:'自然小动作',exact:true})).not.toBeChecked();await toDesktop(page);
}

async function verifyRoomIteration(page){
  await enterHome(page);const close=page.getByRole('button',{name:'关闭面板',exact:true});if(await close.isVisible())await close.click();
  await page.getByRole('button',{name:'布置小屋',exact:true}).click();
  const decor=page.getByRole('dialog',{name:'布置小屋',exact:true}),gallery=decor.getByRole('group',{name:'选择小屋背景',exact:true});
  await expect(gallery).toBeInViewport();await expect(gallery.getByRole('button')).toHaveCount(9);
  const previous=await gallery.locator('[aria-pressed=true]').getAttribute('aria-label');
  for(const [id,label] of [['berry-picnic','浆果野餐地'],['seashell-cottage','海风贝壳屋'],['sky-observatory','晴空观星阁']]){
    await gallery.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('.cottage-scene')).toHaveAttribute('data-background',id);
    for(const [phase,label] of [['morning','早晨'],['noon','白天'],['dusk','傍晚'],['night','夜晚']]){
      await decor.getByRole('button',{name:`预览${label}`,exact:true}).click();await expect(page.locator('.cottage-scene')).toHaveAttribute('data-phase',phase);
      await page.locator('.time-scene-art img').evaluate(n=>n.decode());
    }
  }
  console.log('PASS: nine scene choices and three original-style four-phase backgrounds render in the actual application');
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1'))),before=await save();
  const remaining=Math.max(0,before.lastRewardAt+10000-Date.now());if(remaining)await page.waitForTimeout(remaining+50);
  await roomTab(page,'游戏');await page.getByRole('button',{name:'开始寻宝',exact:true}).click();
  let game=page.getByTestId('treasure-game');await game.getByTestId('treasure-start').click();
  const first=await game.locator('[data-target-id]').first().getAttribute('data-target-id');await game.locator(`[data-treasure-id="${first}"]`).click();
  await game.getByRole('button',{name:'退出游戏，本局不领取奖励',exact:true}).click();
  expect((await save()).coins).toBe(before.coins);expect((await save()).completedGames).toBe(before.completedGames);
  await page.getByRole('button',{name:'开始寻宝',exact:true}).click();game=page.getByTestId('treasure-game');await game.getByTestId('treasure-start').click();
  await game.locator('.treasure-scene-art img').evaluate(n=>n.decode());
  const targets=await game.locator('[data-target-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.targetId));
  for(const id of targets)await game.locator(`[data-treasure-id="${id}"]`).click();
  await expect(game).toHaveAttribute('data-phase','collected');expect((await save()).coins).toBe(before.coins);
  await game.getByRole('button',{name:'收好宝物',exact:true}).evaluate(n=>{n.click();n.click();});
  await expect(game).toHaveAttribute('data-phase','finished');const after=await save();
  expect(after.coins-before.coins).toBe(24);expect(after.completedGames-before.completedGames).toBe(1);expect(after.inventory.juice-before.inventory.juice).toBe(1);
  await expect(game.locator('.treasure-receipt')).toContainText('+24');
  const memory=await page.evaluate(()=>{const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`));});
  expect(memory.events.filter(e=>e.kind==='game').at(-1).detail).toContain('在晴空观星阁完成了《小屋寻宝》');
  await game.getByRole('button',{name:'完成',exact:true}).click();await roomTab(page,'布置');
  await gallery.getByRole('button',{name:previous,exact:true}).click();await decor.getByRole('button',{name:'跟随时间',exact:true}).click();await toDesktop(page);
  console.log('PASS: actual room treasure hunt has no abandoned reward, one explicit receipt and a retained scene-specific shared memory');
}

module.exports = { adopt, openActions, enterHome, roomTab, toDesktop, selectPocket, buy, makeTired,verifyEdgePeek,verifyStageSettings,verifyRecolorPotion,verifyPetLife,verifyRoomIteration };

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
async function enterBackpack(page){
 const panel=page.getByTestId('companion-panel'),link=panel.getByRole('button',{name:'打开背包',exact:true});
 if(await link.isVisible())await link.click();
 const pocket=panel.getByRole('region',{name:'拉姆用品背包',exact:true});await expect(pocket).toBeVisible();return pocket;
}
async function applyGrowthSettings(page,{mode}={}){
 const settings=page.getByRole('region',{name:'当前成长阶段',exact:true});
 if(mode)await settings.getByRole('button',{name:mode==='fixed'?'固定形态':'自动成长',exact:true}).click();
 const apply=settings.getByRole('button',{name:'应用成长设置',exact:true});if(!await apply.isEnabled())return;
 await apply.click();const confirmation=page.getByRole('alertdialog',{name:'确认切换成长设置？',exact:true});
 await confirmation.getByRole('button',{name:'确认切换',exact:true}).click();await expect(confirmation).toHaveCount(0);
}
async function enterHome(page) {
  if (await page.locator('.cottage-scene').isVisible()) return;
  const actions = await openActions(page);
  await actions.getByRole('button', { name: '进入小屋', exact: true }).click();
  await expect(page.locator('.cottage-scene')).toBeVisible();
}
async function roomTab(page, label) {
  await expect(page.locator('.cottage-scene')).toBeVisible({timeout:15000});
  if(await page.locator('.classic-room-overlay').isVisible())await page.locator('.classic-room-overlay').getByRole('button',{name:'关闭面板',exact:true}).click();
  const paperButton = page.locator('.paper-tabs').getByRole('button', { name: label, exact: true });
  if (await paperButton.isVisible()) { await paperButton.click(); return; }
  // Every room function is also reachable without an open paper dialog.
  const dock = page.locator('.classic-dock');
  const aliases = { 学院: ['进入拉姆学院'], 状态: ['状态', '我的拉姆'], 背包: ['背包', '打开背包', '食物口袋'], 商店: ['商店', '进入商店', '拉姆商店'], 游戏: ['游戏', '游乐时光'], 成长: ['成长', '成长手册'], 衣橱: ['衣橱', '拉姆小衣橱'], 回忆: ['回忆', '照料回忆'], 布置: ['布置', '布置小屋'], 设置: ['设置', '陪伴设置'] };
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
  const pocket = page.locator('.classic-pet-book');
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
async function verifyEdgePeek(page,desktop,side,{onPose}={}){
  expect(['left','right','top','bottom']).toContain(side);
  const character=page.getByTestId('desktop-character'),sprite=character.locator('.ram-sprite');
  const horizontal=side==='left'||side==='right',negative=side==='left'||side==='top';
  const direction=negative?-1:1;
  // At the top edge a moving body passes through y=5. Stay outside its
  // horizontal range too, so this test does not intentionally request a peek.
  const away=side==='left'?{x:155,y:5}:{x:5,y:5};
  const state=()=>page.evaluate(()=>window.desktop.getState());
  const bounds=()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  const clipped=async()=>{
    const inset=await page.locator('.companion-layout').evaluate(n=>{
      const clip=getComputedStyle(n).clipPath;
      if(!clip.startsWith('inset('))return clip;
      const values=clip.match(/-?\d+(?:\.\d+)?/g).map(Number);
      return [values[0],values[1]??values[0],values[2]??values[0],values[3]??values[1]??values[0]];
    });
    expect(inset).toEqual({left:[0,0,0,30],right:[0,30,0,0],top:[71,0,0,0],bottom:[0,0,61,0]}[side]);
  };
  const settle=async pose=>{
    // Assert actual painted motion, rather than merely the early IPC state.
    const offset=(await state()).edgeOffset;const amount=Math.abs(horizontal?offset.x:offset.y);
    await expect.poll(()=>page.locator('.compact-pet').evaluate(n=>{
      const m=new DOMMatrix(getComputedStyle(n).transform);return [m.m41,m.m42];
    })).toEqual(horizontal?[direction*amount,0]:[0,direction*amount]);
  };
  await page.keyboard.press('Escape');await page.mouse.move(away.x,away.y);await page.waitForTimeout(250);
  const area=await desktop.evaluate(({BrowserWindow,screen})=>screen.getDisplayMatching(BrowserWindow.getAllWindows()[0].getBounds()).workArea);
  // The 100x108 body, not its transparent 160x240 frame, touches the work-area edge.
  const target={x:area.x+Math.round((area.width-PET_SIZE.width)/2),y:area.y+Math.round((area.height-PET_SIZE.height)/2)};
  if(side==='left')target.x=area.x-30;
  if(side==='right')target.x=area.x+area.width-130;
  if(side==='top')target.y=area.y-71;
  if(side==='bottom')target.y=area.y+area.height-179;
  const place=async point=>{
    await page.evaluate(async()=>{await window.desktop.setEdgeHiding(false);await window.desktop.setInteracting(false);});
    const current=await bounds();
    await page.evaluate(async({dx,dy})=>{
      await window.desktop.startPetDrag();await window.desktop.movePet(dx,dy);
      await window.desktop.setEdgeHiding(true);await window.desktop.endPetDrag();
    },{dx:point.x-current.x,dy:point.y-current.y});
  };
  const near={...target};near[horizontal?'x':'y']-=direction*20;
  await place(near);await page.mouse.move(away.x,away.y);await page.waitForTimeout(2000);
  expect((await state()).edgeSide).toBeNull();expect((await state()).edgePose).toBe('visible');
  await place(target);
  await page.mouse.move(away.x,away.y);
  await expect.poll(async()=>(await state()).edgePose).toBe('tucking');
  expect((await state()).edgeSide).toBe(side);
  await expect(sprite).toHaveAttribute('data-edge-entry',side);
  if(onPose)await onPose('tucking');
  await expect.poll(async()=>(await state()).edgePose,{timeout:6000}).toBe('hidden');await settle('hidden');
  await clipped();
  await expect(sprite).not.toHaveAttribute('data-edge-entry',side);
  await expect(sprite).toHaveAttribute('data-action','still');
  const hiddenBounds=await bounds();expect(hiddenBounds.x).toBe(target.x);expect(hiddenBounds.y).toBe(target.y);
  if(onPose)await onPose('hidden');
  const exposed=horizontal?{x:negative?90:10,y:54}:{x:50,y:negative?100:8};
  await character.hover({position:exposed,force:true});
  await expect.poll(async()=>(await state()).edgePose).toBe('peek');await settle('peek');
  await clipped();
  await expect(sprite).toHaveClass(/is-peeking/);
  await expect(sprite).toHaveAttribute('data-peek-side',side);
  const lean=await sprite.locator('.seed-body-original,.ram-artwork').first().evaluate(n=>{
    const m=new DOMMatrix(getComputedStyle(n).transform);return Math.atan2(m.b,m.a)*180/Math.PI;
  });
  expect(lean).toBeCloseTo({left:7,right:-7,top:5,bottom:-5}[side],1);
  await expect(page.getByTestId('pet-actions')).toHaveCount(0);
  if(onPose)await onPose('peek');
  await character.click({position:exposed,force:true});
  expect((await state()).edgeSide).toBe(side);expect((await state()).edgePose).toBe('peek');
  const clickedBounds=await bounds();expect(clickedBounds.x).toBe(target.x);expect(clickedBounds.y).toBe(target.y);
  await expect(page.getByTestId('pet-actions')).toHaveCount(0);
  await page.mouse.move(away.x,away.y);await expect.poll(async()=>(await state()).edgePose).toBe('hidden');await settle('hidden');
  const until=(await state()).edgeNextPeekAt-Date.now();expect(until).toBeGreaterThan(118000);expect(until).toBeLessThanOrEqual(300000);
  await character.hover({position:exposed,force:true});await expect.poll(async()=>(await state()).edgePose).toBe('peek');await settle('peek');
  const start=await bounds(),box=await character.boundingBox();
  const point={x:box.x+exposed.x,y:box.y+exposed.y};
  const travel={x:horizontal?-direction*150:0,y:horizontal?0:-direction*150};
  const physical={x:start.x+point.x,y:start.y+point.y};
  await page.evaluate(()=>{
    window.__edgeInputController?.abort();window.__edgeInputController=new AbortController();
    window.__edgeInput={sequence:0};
    for(const type of ['pointerdown','pointermove','pointerup'])document.addEventListener(type,event=>{
      window.__edgeInput={sequence:window.__edgeInput.sequence+1,type,x:event.screenX,y:event.screenY};
    },{capture:true,signal:window.__edgeInputController.signal});
  });
  const pointer=async(type,position,held=false)=>{
    const before=await page.evaluate(()=>window.__edgeInput.sequence);
    await desktop.evaluate(({BrowserWindow},{type,position,held})=>{
      const window=BrowserWindow.getAllWindows()[0],frame=window.getBounds();
      // CDP dispatches screenX=clientX even when the native window is offset.
      // Electron's native input path supplies both coordinate systems, as a
      // real pointer does, while preserving capture across moving windows.
      window.webContents.sendInputEvent({type,x:Math.round(position.x-frame.x),y:Math.round(position.y-frame.y),
        globalX:Math.round(position.x),globalY:Math.round(position.y),button:'left',
        clickCount:type==='mouseMove'?0:1,modifiers:held?['leftButtonDown']:[]});
    },{type,position,held});
    const kind={mouseMove:'pointermove',mouseDown:'pointerdown',mouseUp:'pointerup'}[type];
    await expect.poll(()=>page.evaluate(()=>window.__edgeInput)).toMatchObject({type:kind,x:Math.round(position.x),y:Math.round(position.y)});
    expect(await page.evaluate(()=>window.__edgeInput.sequence)).toBeGreaterThan(before);
    await page.evaluate(()=>window.desktop.getState());
  };
  await pointer('mouseMove',physical);await pointer('mouseDown',physical,true);
  // Keep the physical pointer path stable while the native frame follows it.
  for(let n=1;n<=8;n++){
    await pointer('mouseMove',{x:physical.x+travel.x*n/8,y:physical.y+travel.y*n/8},true);
  }
  await pointer('mouseUp',{x:physical.x+travel.x,y:physical.y+travel.y});
  await page.evaluate(()=>{window.__edgeInputController.abort();delete window.__edgeInputController;delete window.__edgeInput;});
  await expect.poll(async()=>(await state()).edgeSide).toBeNull();await expect.poll(async()=>(await state()).edgePose).toBe('visible');
  const after=await bounds(),offset=direction*(horizontal?44:50);
  expect(after.x).toBe(start.x+travel.x+(horizontal?offset:0));
  expect(after.y).toBe(start.y+travel.y+(horizontal?0:offset));
  await expect(character).toBeInViewport();
  await expect(page.locator('.companion-layout')).toHaveCSS('clip-path','none');
  if(onPose)await onPose('released');
}
async function verifyStageSettings(page,desktop){
  await enterHome(page);await roomTab(page,'设置');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const memoryKey=`ramu-companion-memory-v1:${before.createdAt}`;
  const memoryBefore=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),memoryKey);
  const settings=page.getByRole('region',{name:'当前成长阶段',exact:true});
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const [stage,label] of ['种子期','初级拉姆','中级拉姆','高级拉姆','神力拉姆'].entries()){
    await settings.getByRole('button',{name:`切换到${label}`,exact:true}).click();await applyGrowthSettings(page,{mode:'fixed'});
    await expect(settings.getByRole('button',{name:`切换到${label}`,exact:true})).toHaveAttribute('aria-pressed','true');
    if(stage===1||stage===2){const canvas=page.locator('.scene-character canvas');await expect(canvas).toHaveAttribute('data-sheet','grounded',{timeout:15000});await expect(canvas).toHaveAttribute('data-form',stage===1?'junior':'middle',{timeout:15000});}
    // An already selected stage keeps its progress, and the real clock may tick.
    const growth=(await save()).growth,thresholds=[0,60,180,420,840];
    expect(growth).toBeGreaterThanOrEqual(thresholds[stage]);
    if(stage<4)expect(growth).toBeLessThan(thresholds[stage+1]);else expect(growth).toBe(840);
  }
  for(const [form,label] of Object.entries({super:'神力超级拉姆',fire:'霹雳火系拉姆',wood:'弹力木系拉姆',water:'神奇水系拉姆'})){
    await settings.getByRole('button',{name:`切换为${label}`,exact:true}).click();await applyGrowthSettings(page,{mode:'fixed'});await expect.poll(async()=>(await save()).evolution).toBe(form);
  }
  await toDesktop(page);await page.reload();
  const sprite=page.getByTestId('desktop-character').locator('.ram-sprite');
  await expect(sprite).toHaveAttribute('data-stage','4');await expect(sprite).toHaveAttribute('data-evolution','water');await expect(sprite).toHaveAttribute('data-color',before.color);
  await enterHome(page);await roomTab(page,'设置');await settings.getByRole('button',{name:'切换到初级拉姆',exact:true}).click();await applyGrowthSettings(page,{mode:'fixed'});
  await toDesktop(page);const character=page.getByTestId('desktop-character');await character.hover({position:{x:94,y:54}});
  await expect.poll(async()=>Number(await character.locator('canvas:not(.ram-wear)').getAttribute('data-gaze-x'))).toBeGreaterThan(1);
  console.log('PASS: nearby pointer attention responds in the actual desktop window');
  if(desktop){
    await enterHome(page);await roomTab(page,'设置');
    await settings.getByRole('button',{name:'切换到神力拉姆',exact:true}).click();await applyGrowthSettings(page,{mode:'fixed'});
    await settings.getByRole('button',{name:'切换为神力超级拉姆',exact:true}).click();await applyGrowthSettings(page,{mode:'fixed'});await toDesktop(page);
    await expect(character.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-form','super');
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
    await expect(character.locator('canvas:not(.ram-wear)')).toHaveAttribute('data-row','0');
    expect(await character.locator('.ram-flight-layer').evaluate(n=>n.getAnimations()[0]===window.__nativeFlight)).toBe(true);
    const moved=await bounds();expect(Math.abs(moved.x-placed.x)).toBeGreaterThanOrEqual(12);expect(Math.abs(moved.x-placed.x)).toBeLessThanOrEqual(28);expect(moved.y).toBe(placed.y);
    await page.evaluate(async flags=>{await window.desktop.wander(flags.wandering);await window.desktop.setEdgeHiding(flags.edgeHiding);},flags);
    console.log('PASS: autonomous wandering takes short random 12-28px steps and preserves placement height');
    console.log('PASS: super Ram follows native movement with original side-facing flight and returns to front');
  }

  await enterHome(page);await roomTab(page,'设置');await settings.getByRole('button',{name:'切换到种子期',exact:true}).click();await applyGrowthSettings(page,{mode:'fixed'});
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
  await toDesktop(page);await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'状态',exact:true}).click();await(await selectPocket(page,id,name)).click();
  await expect(page.getByTestId('desktop-character').locator('[data-item-gesture=recolor]')).toBeVisible();await expect.poll(async()=>(await save()).color).toBe(color);await expect(page.getByTestId('desktop-character').locator('[data-item-gesture=recolor]')).toHaveCount(0,{timeout:6000});
  await expect(page.getByTestId('care-gain')).toContainText(`变为${color==='blue'?'蓝色':'粉色'}`);await expect(page.getByTestId('care-gain')).toHaveCount(0,{timeout:4000});
  console.log('PASS: successful colour-potion feedback appears after use and fades away');
  await page.getByRole('button',{name:'关闭小窗',exact:true}).click();await page.reload();const ram=page.getByTestId('desktop-character').locator('.ram-sprite');await expect(ram).toHaveAttribute('data-color',color);
  const after=await save();for(const key of ['name','createdAt','evolution','completedGames'])expect(after[key]).toEqual(before[key]);expect(after.inventory[id]??0).toBe(before.inventory[id]??0);for(const key of Object.keys(before.inventory))expect(after.inventory[key]).toBe(before.inventory[key]);
}

async function verifyPetLife(page){
  // Earlier sleep checks deliberately exhaust this shared fixture. Restore
  // normal energy so the real invitation policy can offer a second activity.
  await page.evaluate(()=>{const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));pet.stats.energy=85;localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  await page.getByRole('button',{name:'看看小蝴蝶',exact:true}).click();
  const ram=page.getByTestId('desktop-character').locator('.ram-sprite');await expect(ram).toHaveAttribute('data-action','watch-butterfly');
  const image=ram.locator('.social-butterfly>img');await expect(image).toBeVisible();expect(await image.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);
  await expect(ram).not.toHaveAttribute('data-action','watch-butterfly',{timeout:8500});
  // Derive the extra familiarity row from two real interactions. The direct
  // and accepted-invitation receipts differ, so ordinary dedup keeps both.
  const invitation=page.getByTestId('companion-panel').getByTestId('pet-invitation');
  for(let attempt=0;attempt<3;attempt++){
    await invitation.getByRole('button',{name:'让拉姆提个主意',exact:true}).click();
    if(await invitation.locator('[data-invitation-kind]').getAttribute('data-invitation-kind')==='butterfly')break;
  }
  await expect(invitation.locator('[data-invitation-kind]')).toHaveAttribute('data-invitation-kind','butterfly');
  await invitation.locator('.pet-invitation-accept').click();
  await expect(ram).toHaveAttribute('data-action','watch-butterfly');await expect(image).toBeVisible();
  await expect(invitation.locator('[data-invitation-kind]')).toHaveCount(0);
  const watches=await page.evaluate(()=>{
    const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));
    const memory=JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`));
    return memory.events.filter(event=>event.kind==='play'&&event.detail.includes('小蝴蝶'));
  });
  expect(watches.length).toBeGreaterThanOrEqual(2);
  await expect(invitation.locator('.pet-invitation-habit')).toBeVisible();
  const scroll=await page.locator('.companion-content').evaluate(n=>({height:n.clientHeight,content:n.scrollHeight}));expect(scroll.content).toBeLessThanOrEqual(scroll.height+1);
  console.log('PASS: familiar habits from two real interactions keep every play card inside the compact panel');
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

async function verifyPetSpirit(page){
  // The earlier sleep regression deliberately exhausted this same pet. Give
  // this interaction fixture its normal energy; a tired pet correctly refuses
  // to propose a game. All calls, deferrals and accepted actions use the UI.
  await page.evaluate(()=>{const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));pet.stats.energy=85;localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));});
  await page.reload();await page.getByTestId('desktop-character').waitFor();
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const readMemory=()=>page.evaluate(()=>{const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));return JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`));});
  const before=await save(),character=page.getByTestId('desktop-character');
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  const widget=page.getByTestId('pet-invitation');
  await widget.getByRole('button',{name:`叫叫${before.name}`,exact:true}).click();
  await expect(character.locator('.ram-sprite')).toHaveAttribute('data-action','look-around');
  await expect(page.getByRole('button',{name:'回应拉姆的话',exact:true})).toContainText(before.name);
  const called=await save();expect(called.coins).toBe(before.coins);expect(called.inventory).toEqual(before.inventory);expect(called.sleeping).toBe(false);
  await expect(widget.getByRole('button',{name:'让拉姆提个主意',exact:true})).toBeEnabled();
  const experiences=(await readMemory()).events.filter(e=>['play','pet'].includes(e.kind)).length;
  await widget.getByRole('button',{name:'让拉姆提个主意',exact:true}).click();await expect(widget.locator('[data-invitation-kind]')).toBeVisible();
  await widget.getByRole('button',{name:'我先忙30分钟',exact:true}).click();await expect(widget.locator('.pet-invitation-snoozed')).toBeVisible();
  expect((await readMemory()).events.filter(e=>['play','pet'].includes(e.kind)).length).toBe(experiences);
  await page.reload();await character.waitFor();await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  await expect(widget.getByRole('button',{name:'恢复主动陪伴',exact:true})).toBeVisible();await widget.getByRole('button',{name:'恢复主动陪伴',exact:true}).click();
  await expect(widget.locator('.pet-invitation-snoozed')).toHaveCount(0);
  await widget.getByRole('button',{name:'让拉姆提个主意',exact:true}).click();const kind=await widget.locator('[data-invitation-kind]').getAttribute('data-invitation-kind');
  await widget.locator('.pet-invitation-accept').evaluate(n=>{n.click();n.click();});
  const action=kind==='ball'?'play':kind==='pet'?'pet':'watch-butterfly';
  await expect(character.locator('.ram-sprite')).toHaveAttribute('data-action',action);
  if(action==='play'&&Number(await character.locator('.ram-sprite').getAttribute('data-stage'))>0)await expect(character.locator('canvas[data-sheet=football]')).toBeVisible();
  else await expect(character.locator(`[data-social-action="${action}"]`)).toBeVisible();
  await expect(widget.locator('[data-invitation-kind]')).toHaveCount(0);
  const events=(await readMemory()).events.filter(e=>['play','pet'].includes(e.kind));expect(events.length).toBe(experiences+1);expect(events.at(-1).detail).toContain('小邀请');
  const after=await save();expect(after.coins).toBe(before.coins);expect(after.inventory).toEqual(before.inventory);expect(after.growth-before.growth).toBeLessThan(.1);
  await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
  console.log('PASS: named response, real invitation acceptance, restart-safe 30-minute defer and one actual shared interaction in the packaged application');
}

async function verifyComfortMotion(page) {
  const original=await page.evaluate(()=>({pet:localStorage.getItem('ramu-house-save-v1'),prefs:localStorage.getItem('ramu-house-preferences-v2')}));
  try {
    for(const [growth,evolution] of [[0,null],[180,null],[840,'super']]){
      await page.evaluate(({growth,evolution})=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(p,{growth,sleeping:true,lastTick:Date.now(),stats:{hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:50}});delete p.awakeUntil;delete p.evolution;if(evolution)p.evolution=evolution;localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false,lively:false}));},{growth,evolution});
      await page.reload();const ram=page.getByTestId('desktop-character').locator('.ram-sprite'),canvas=ram.locator('canvas:not(.ram-wear)');
      await expect(canvas).toHaveAttribute('data-loaded','true');await expect(ram).toHaveAttribute('data-sleeping','true');await expect(canvas).toHaveAttribute('data-sheet','slumber');
      const first=await canvas.getAttribute('data-frame');await expect.poll(()=>canvas.getAttribute('data-frame'),{intervals:[100],timeout:5000}).not.toBe(first);
      await expect(ram.locator('.ram-sleep-particles>img')).toHaveCount(3);expect(await ram.locator('.ram-sleep-particles>img').first().evaluate(n=>getComputedStyle(n).animationName)).toBe('ram-snore-rise');
      if(growth===0)expect(['none','matrix(1, 0, 0, 1, 0, 0)'].includes(await ram.locator('.seed-body-original').evaluate(n=>getComputedStyle(n).transform))).toBe(true);
      await page.getByRole('button',{name:'叫醒拉姆',exact:true}).click();await expect(ram).toHaveAttribute('data-action','wake');await expect(ram).not.toHaveAttribute('data-action','wake',{timeout:4000});
      await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();const panel=page.getByTestId('companion-panel');
      await panel.getByRole('button',{name:'摸摸拉姆',exact:true}).click();await expect(canvas).toHaveAttribute('data-sheet',growth===0?'seed':'affection');
      await expect.poll(()=>ram.evaluate(n=>parseFloat(n.style.getPropertyValue('--social-angle'))),{intervals:[30],timeout:2500}).toBeGreaterThan(growth>=840?.2:1.5);
      const opaque=await canvas.evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0;for(let i=3;i<a.length;i+=4)if(a[i]>200)count++;return count;});expect(opaque).toBeGreaterThan(100);
      await expect(ram).not.toHaveAttribute('data-action','pet',{timeout:4000});
      await panel.getByRole('button',{name:'一起玩球',exact:true}).click();
      let duration=4200;
      if(growth===0){await expect.poll(()=>ram.locator('.social-ball-contact').evaluate(n=>Number(getComputedStyle(n).opacity)),{intervals:[25],timeout:4000}).toBeGreaterThan(.7)}
      else {
        await expect(canvas).toHaveAttribute('data-sheet','football');await expect(canvas).toHaveAttribute('data-loaded','true');duration=Number(await canvas.getAttribute('data-duration'));
        await expect.poll(()=>canvas.getAttribute('data-near-ball'),{intervals:[30],timeout:5000}).toBe('true');
        expect(await ram.locator('.ram-pose-layer').evaluate(n=>getComputedStyle(n).transform)).toBe('none');
        const f=Number(await canvas.getAttribute('data-source-frame'));await expect.poll(async()=>Number(await canvas.getAttribute('data-source-frame')),{intervals:[50]}).toBeGreaterThan(f);
      }
      await expect(ram).not.toHaveAttribute('data-action','play',{timeout:duration+2500});
    }
    console.log('PASS: original sleepy mouth cycle, rising Z particles, large-eye affection and body/ball source frames in the actual application');
  } finally {
    await page.evaluate(({pet,prefs})=>{localStorage.setItem('ramu-house-save-v1',pet);if(prefs)localStorage.setItem('ramu-house-preferences-v2',prefs);else localStorage.removeItem('ramu-house-preferences-v2');},original);
    await page.reload();await page.getByTestId('desktop-character').waitFor();
  }
}

async function verifyMoodWardrobe(page) {
  const original=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key==='ramu-house-save-v1'||key==='ramu-house-preferences-v2'||key.includes('companion'))));
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  try {
    await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(p,{coins:200,growth:0,sleeping:false,wardrobe:[],lastTick:Date.now(),stats:{hunger:90,thirst:90,cleanliness:90,happiness:90,health:100,energy:90}});delete p.wearing;delete p.evolution;for(const key of Object.keys(localStorage))if(key.includes('companion'))localStorage.removeItem(key);localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false,lively:false}));});
    await page.reload();const identity=await save(),character=page.getByTestId('desktop-character'),ram=character.locator('.ram-sprite');
    await expect(page.getByRole('button',{name:'拉姆小衣橱',exact:true})).toHaveCount(0);
    await enterHome(page);await page.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();const wardrobe=page.locator('.wardrobe');
    await wardrobe.getByRole('button',{name:'试戴庆生小帽',exact:true}).click();await expect(wardrobe.locator('.wardrobe-mirror .ram-wear')).toBeVisible();
    expect((await save()).coins).toBe(200);expect((await save()).wardrobe??[]).toEqual([]);expect((await save()).wearing).toBeUndefined();await expect(page.locator('.scene-character .ram-wear')).toHaveCount(0);
    await wardrobe.getByRole('button',{name:'买下 · 30 摩尔豆',exact:true}).evaluate(button=>{button.click();button.click()});
    expect((await save()).coins).toBe(170);expect((await save()).wardrobe).toEqual(['party-cap']);
    await wardrobe.getByRole('button',{name:'给拉姆戴上',exact:true}).click();await expect(page.locator('.scene-character .ram-wear')).toHaveAttribute('data-outfit','party-cap');
    // Cached sources may still have a queued animation frame while React clears
    // the seed ref before passive cleanup. Exercise that transition in shipping
    // React/Electron, not only the development renderer.
    for(let i=0;i<6;i++){
      await wardrobe.getByRole('button',{name:'试戴金色羽毛',exact:true}).click();
      await expect(wardrobe.locator('.wardrobe-mirror .ram-wear')).toBeVisible();
      await page.locator('.paper-tabs').getByRole('button',{name:'状态',exact:true}).click();
      await page.getByRole('button',{name:'关闭面板',exact:true}).click();await page.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();
    }
    console.log('PASS: repeated original seed wardrobe/profile switches cancel detached animation work');
    await toDesktop(page);await expect(ram.locator('.ram-wear')).toBeVisible();await page.reload();await expect(ram.locator('.ram-wear')).toHaveAttribute('data-outfit','party-cap');
    for(const [growth,evolution,happiness,energy,action] of [[0,null,90,90,'mood-joy'],[180,null,35,90,'mood-grumpy'],[840,'fire',90,30,'mood-dozy'],[420,null,70,90,'mood-content']]){
      await page.evaluate(({growth,evolution,happiness,energy})=>{const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));p.growth=growth;p.stats.happiness=happiness;p.stats.energy=energy;p.sleeping=false;p.lastTick=Date.now();delete p.evolution;if(evolution)p.evolution=evolution;localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));},{growth,evolution,happiness,energy});
      await page.reload();await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'查看状态',exact:true}).click();
      const mood=page.getByRole('button',{name:'回应拉姆的心情',exact:true});await expect(mood).toBeVisible();
      const bounds=await mood.boundingBox(),panel=await page.getByTestId('companion-panel').boundingBox();expect(bounds.y+bounds.height).toBeLessThanOrEqual(panel.y+panel.height);
      await mood.click();await expect(ram).toHaveAttribute('data-action',action);await expect(ram.locator('.ram-wear')).toBeVisible();
      if(growth===180){const canvas=ram.locator('canvas:not(.ram-wear)');await expect(canvas).toHaveAttribute('data-loaded','true');const first=await canvas.getAttribute('data-source-frame');await expect.poll(()=>canvas.getAttribute('data-source-frame'),{intervals:[60]}).not.toBe(first)}
      await expect(ram).toHaveAttribute('data-action','idle',{timeout:9000});await expect(ram).toHaveAttribute('data-sleeping','false');
      const pet=await save();expect(pet.coins).toBe(170);expect(pet.wearing).toBe('party-cap');expect(pet.name).toBe(identity.name);expect(pet.color).toBe(identity.color);expect(pet.inventory).toEqual(identity.inventory);
      await page.getByRole('button',{name:'关闭小窗',exact:true}).click();
    }
    await enterHome(page);await page.getByRole('button',{name:'拉姆小衣橱',exact:true}).click();await wardrobe.getByRole('button',{name:'试戴金色羽毛',exact:true}).click();await wardrobe.getByRole('button',{name:'买下 · 45 摩尔豆',exact:true}).click();await wardrobe.getByRole('button',{name:'给拉姆戴上',exact:true}).click();await expect(page.locator('.scene-character .ram-wear')).toHaveAttribute('data-outfit','gold-feather');
    await wardrobe.getByRole('button',{name:'收好装扮',exact:true}).click();await expect(page.locator('.scene-character .ram-wear')).toHaveCount(0);await expect(wardrobe.locator('.ram-wear')).toHaveCount(0);
    const end=await save();expect(end.coins).toBe(125);expect(end.wardrobe).toEqual(['party-cap','gold-feather']);expect(end.wearing).toBeUndefined();await toDesktop(page);
    console.log('PASS: wardrobe preview never spends, purchases charge once, worn original accessories persist and real moods respond without fake care rewards');
  } finally {
    await page.evaluate(values=>{for(const key of Object.keys(localStorage))if(key==='ramu-house-save-v1'||key==='ramu-house-preferences-v2'||key.includes('companion'))localStorage.removeItem(key);for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);},original);
    await page.reload();await page.getByTestId('desktop-character').waitFor();
  }
}

module.exports = { enterBackpack,applyGrowthSettings,adopt, openActions, enterHome, roomTab, toDesktop, selectPocket, buy, makeTired,verifyEdgePeek,verifyStageSettings,verifyRecolorPotion,verifyPetLife,verifyRoomIteration,verifyPetSpirit,verifyComfortMotion,verifyMoodWardrobe };

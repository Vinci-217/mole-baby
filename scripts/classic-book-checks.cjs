const {expect}=require('@playwright/test');
const {openActions,enterHome,roomTab,toDesktop,selectPocket}=require('./smoke-helpers.cjs');
const path=require('node:path'),fs=require('node:fs');

/** Exercise real shipping controls and inventory, not a static UI fixture. */
async function verifyClassicBook(page,desktop){
  const original=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k==='ramu-house-save-v1'||k==='ramu-house-preferences-v2'||k.includes('companion'))));
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const nativeBounds=()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  const open=async()=>{await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'喂食',exact:true}).click();await expect(page.locator('.classic-pet-book')).toBeVisible();};
  const close=async()=>{await page.locator('.classic-pet-book').getByRole('button',{name:'关闭小窗',exact:true}).click();};
  try{
    await page.evaluate(()=>{
      const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));
      Object.assign(p,{name:'小叶',color:'blue',growth:180,sleeping:false,coins:200,wardrobe:['party-cap'],inventory:{berry:2,biscuit:2,juice:2,'180001':2,'180002':2,'180003':2,'180005':2,'180007':2,'180009':2,'180010':2,'180014':2,'180018':2,'180019':2,'180020':2,'180021':2,'180022':2,'180024':2,'180025':2},lastTick:Date.now(),stats:{hunger:35,thirst:40,cleanliness:55,happiness:70,health:100,energy:90}});delete p.evolution;delete p.wearing;
      localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,presence:false,lively:false}));
    });
    await page.reload();await page.getByTestId('desktop-character').waitFor();
    if(desktop)await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false);});
    const anchor=desktop?await nativeBounds():null;await open();const book=page.locator('.classic-pet-book');
    await expect(book.getByRole('tab')).toHaveText(['用品','装扮','成长','游戏','回忆','玩耍']);
    await expect(book.locator('.pocket-slot')).toHaveCount(12);await expect(book.locator('.classic-book-stat')).toHaveCount(6);
    for(const cell of await book.locator('.pocket-slot').all()){const b=await cell.boundingBox();expect(Math.abs(b.width-b.height)).toBeLessThan(.5);}
    if(desktop){const g=await page.evaluate(()=>window.desktop.getState()),b=await nativeBounds();expect(g.panelLayout).toBe('classic');expect(b.x+g.panelGeometry.petX).toBe(anchor.x);expect(b.y+g.panelGeometry.petY).toBe(anchor.y);const body=await page.getByTestId('desktop-character').boundingBox();expect(body.width).toBe(100);}
    expect((await save()).inventory.berry).toBe(2);await book.getByRole('button',{name:'背包下一页',exact:true}).click();await expect(book.locator('.classic-book-pages>span')).toHaveText('2/2');await book.getByRole('button',{name:'背包上一页',exact:true}).click();
    await book.getByRole('button',{name:'编辑拉姆名字',exact:true}).click();await book.getByRole('textbox',{name:'拉姆新名字',exact:true}).fill('小团子');await book.getByRole('button',{name:'保存名字',exact:true}).click();expect((await save()).name).toBe('小团子');
    await book.getByRole('button',{name:'收起背包页',exact:true}).click();await expect(book.getByRole('tab')).toHaveCount(0);await expect(book.locator('.classic-book-stat')).toHaveCount(6);if(desktop)expect((await page.evaluate(()=>window.desktop.getState())).panelLayout).toBe('profile');
    await book.getByRole('button',{name:'展开背包',exact:true}).click();await expect(book.locator('.pocket-slot')).toHaveCount(12);
    const use=await selectPocket(page,'berry','可可果');expect((await save()).inventory.berry).toBe(2);await use.click();await expect.poll(async()=>(await save()).inventory.berry).toBe(1);await expect(use).toBeDisabled();
    await expect(page.locator('.care-pocket')).toHaveAttribute('aria-busy','true');await expect(page.getByTestId('care-gain')).toContainText('饱食',{timeout:7000});await expect(page.locator('.care-pocket')).toHaveAttribute('aria-busy','false');
    await expect(use).toBeEnabled();await book.getByRole('button',{name:'收起物品说明',exact:true}).click();await book.locator('.pocket-slot[data-item-id="berry"]').dblclick();await expect.poll(async()=>(await save()).inventory.berry).toBe(0);await expect(book.locator('.pocket-slot[data-item-id="berry"]')).toHaveAttribute('data-count','0');
    await expect(page.locator('.care-pocket')).toHaveAttribute('aria-busy','false',{timeout:7000});await book.getByRole('button',{name:'收起物品说明',exact:true}).click();
    const foreign=await page.evaluateHandle(()=>{const data=new DataTransfer();data.setData('application/x-mole-baby-item',JSON.stringify({kind:'item',id:'juice',pet:-1}));return data;});await book.getByTestId('classic-drop-target').dispatchEvent('drop',{dataTransfer:foreign});expect((await save()).inventory.juice).toBe(2);await foreign.dispose();
    await book.locator('.pocket-slot[data-item-id="juice"]').dragTo(book.getByTestId('classic-drop-target'));await expect.poll(async()=>(await save()).inventory.juice).toBe(1);await expect(page.locator('.care-pocket')).toHaveAttribute('aria-busy','false',{timeout:7000});
    await book.getByRole('tab',{name:'装扮',exact:true}).click();await book.locator('[data-outfit-id="party-cap"]').click();await book.getByRole('button',{name:'戴上看看',exact:true}).click();await expect.poll(async()=>(await save()).wearing).toBe('party-cap');expect((await save()).coins).toBe(200);
    await book.getByRole('button',{name:'收起装扮说明',exact:true}).click();await book.locator('[data-outfit-id="party-cap"]').dragTo(book.getByTestId('classic-drop-target'));expect((await save()).wearing).toBe('party-cap');
    await book.getByRole('tab',{name:'回忆',exact:true}).click();await expect(book.locator('.classic-diary')).toContainText('小团子');await expect(book.locator('.classic-diary')).toContainText('可可果');
    await book.getByRole('tab',{name:'成长',exact:true}).click();await expect(book.locator('.classic-growth-list>li')).toHaveCount(5);await expect(book.locator('.classic-growth-list>li.current')).toContainText('中级');
    await book.getByRole('tab',{name:'玩耍',exact:true}).click();await expect(book.locator('.classic-card')).toHaveCount(6);await book.getByRole('button',{name:'回应心情',exact:true}).click();await expect(book.locator('.classic-book-portrait .ram-sprite')).not.toHaveAttribute('data-action','idle');
    await book.getByRole('tab',{name:'用品',exact:true}).click();await book.locator('img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
    if(!desktop){const dir=path.resolve(__dirname,'../artifacts');fs.mkdirSync(dir,{recursive:true});await page.mouse.move(5,5);await page.screenshot({path:path.join(dir,'v23-classic-backpack.png')});for(const size of [{width:1000,height:720},{width:800,height:600},{width:390,height:844}]){await page.setViewportSize(size);await expect.poll(async()=>{const b=await book.boundingBox();return b.x>=0&&b.y>=0&&b.x+b.width<=size.width&&b.y+b.height<=size.height;}).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);}await page.setViewportSize({width:1180,height:820});}
    await close();if(desktop)expect(await nativeBounds()).toEqual(anchor);
    await page.reload();expect((await save()).name).toBe('小团子');expect((await save()).wearing).toBe('party-cap');expect((await save()).inventory.berry).toBe(0);expect((await save()).inventory.juice).toBe(1);
    await open();await book.getByRole('tab',{name:'游戏',exact:true}).click();await book.getByRole('button',{name:'翻翻乐',exact:true}).click();await expect(page.locator('.cottage-scene')).toBeVisible();await expect(page.locator('.memory-dialog')).toBeVisible();await page.getByRole('button',{name:'关闭翻牌游戏',exact:true}).click();
    await roomTab(page,'背包');await expect(book).toBeVisible();await expect(book.locator('.pocket-slot')).toHaveCount(12);await page.getByRole('button',{name:'关闭面板',exact:true}).click();await toDesktop(page);
    console.log('PASS: classic book has original double-page artwork, twelve square slots, six types, real stats, rename/fold, single/double-click and drag care, permanent desktop outfits, true memories and room games');
  }finally{
    await page.evaluate(values=>{for(const key of Object.keys(localStorage))if(key==='ramu-house-save-v1'||key==='ramu-house-preferences-v2'||key.includes('companion'))localStorage.removeItem(key);for(const [key,value] of Object.entries(values))localStorage.setItem(key,value);},original);
    await page.reload();await page.getByTestId('desktop-character').waitFor();
  }
}
module.exports={verifyClassicBook};

/** Transparent pet hover regression. Native caption/tooltip HWND checks belong
 * to windows-window-chrome.cjs; capturePage covers the renderer's alpha only. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sharp=require('sharp');
const {expect}=require('@playwright/test');
const {openActions}=require('./smoke-helpers.cjs');
async function verifyTransparentHover(page,desktop,options={}){
 const out=options.outDirectory??path.resolve(__dirname,'../artifacts/transparent-hover');
 fs.mkdirSync(out,{recursive:true});
 const snapshot=await page.evaluate(()=>({save:localStorage.getItem('ramu-house-save-v1'),prefs:localStorage.getItem('ramu-house-preferences-v2')}));
 assert.ok(snapshot.save,'Adopt a pet before checking transparent hover');
 const noTitles=()=>expect(page.locator('.companion-layout [title]')).toHaveCount(0);
 async function captureClearTop(name){
  // A real care/welcome bubble may outlive the previous smoke. Dismiss it
  // through its normal control before measuring unused transparent space.
  const bubble=page.getByRole('button',{name:'收起拉姆提示',exact:true});
  if(await bubble.isVisible())await bubble.click();
  await page.mouse.move(1,1);
  await expect(page.locator('.compact-bubble.visible')).toHaveCount(0);
  await expect(page.getByTestId('desktop-character').locator('.ram-sprite')).toHaveAttribute('data-action','idle',{timeout:15000});
  await expect(page.getByTestId('care-gain')).toHaveCount(0,{timeout:10000});
  await page.waitForTimeout(300);
  const png=await page.screenshot({path:path.join(out,name+'.png'),omitBackground:true});
  if(!desktop)return;
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const viewport=page.viewportSize()??await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const top=Math.floor(60*info.height/viewport.height);
  let painted=0;
  for(let y=0;y<top;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>10)painted++;
  assert.equal(painted,0,`${name}: unused renderer space above the pet must be transparent`);
 }
 try{
  await page.evaluate(()=>{
   const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));
   Object.assign(p,{sleeping:false,lastTick:Date.now(),stats:{hunger:90,thirst:90,cleanliness:90,happiness:90,health:100,energy:90}});
   delete p.outing;p.inventory.biscuit=3;p.inventory.juice=2;
   localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));
   localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({sound:false,quiet:true,lively:false,presence:false}));
  });
  await page.reload();
  if(desktop)await page.evaluate(async()=>{await window.desktop.setPetMode(true);await window.desktop.setEdgeHiding(false)});
  await expect(page.getByTestId('desktop-character').locator('canvas:not(.ram-wear)')).toHaveAttribute('data-loaded','true',{timeout:20000});
  await noTitles();await captureClearTop('idle');
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'喂食',exact:true}).click();
  const pocket=page.locator('.pocket-compact'),hint=pocket.getByRole('tooltip'),biscuit=pocket.locator('[data-item-id="biscuit"]');
  await expect(pocket).toBeVisible();await noTitles();
  await biscuit.hover();await expect(hint).toContainText('饱食');
  await expect(biscuit).toHaveAttribute('aria-description',/饱食/);
  const bounds=await pocket.boundingBox(),box=await hint.boundingBox();
  assert.ok(box.x>=bounds.x&&box.y>=bounds.y&&box.x+box.width<=bounds.x+bounds.width+.5&&box.y+box.height<=bounds.y+bounds.height+.5,'item hint stays inside the existing pocket');
  await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(out,'food-hover.png'),omitBackground:true});
  await pocket.locator('.pocket-heading').hover();await expect(hint).toHaveCount(0);
  await pocket.getByLabel('物品分类',{exact:true}).focus();await expect(hint).toHaveCount(0);
  await biscuit.focus();await expect(hint).toContainText('饱食');
  await pocket.getByLabel('物品分类',{exact:true}).selectOption('drink');await expect(hint).toHaveCount(0);
  const juice=pocket.locator('[data-item-id="juice"]');await juice.hover();await expect(hint).toContainText('水分');
  await juice.click();await expect(hint).toHaveCount(0);
  await pocket.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await expect(hint).toHaveCount(0);await noTitles();await captureClearTop('after-pocket-close');
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'喂食',exact:true}).click();
  await expect(pocket).toBeVisible();await expect(hint).toHaveCount(0);await noTitles();
  await pocket.getByRole('button',{name:'关闭小窗',exact:true}).click();
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();
  await noTitles();await page.getByRole('button',{name:'摸摸拉姆',exact:true}).hover();await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(out,'play-hover.png'),omitBackground:true});
  await page.getByTestId('companion-panel').getByRole('button',{name:'关闭小窗',exact:true}).click();
  await captureClearTop('after-play-close');
  console.log(`PASS transparent hover: idle/food/play have no native title tooltips; bounded accessible hints clear on leave, focus, category, use and close${desktop?'; unused renderer top is alpha-transparent':''}`);
 }finally{
  if(!page.isClosed()){
   await page.evaluate(s=>{localStorage.setItem('ramu-house-save-v1',s.save);if(s.prefs===null)localStorage.removeItem('ramu-house-preferences-v2');else localStorage.setItem('ramu-house-preferences-v2',s.prefs)},snapshot);
   await page.reload();await page.getByTestId('desktop-character').waitFor();
  }
 }
}
module.exports={verifyTransparentHover};

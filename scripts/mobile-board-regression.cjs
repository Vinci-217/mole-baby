/** Small-screen compose controls and real local note persistence. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
const {roomTab}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/interaction-feedback-review');
async function main(){
 const context=await chromium.launchPersistentContext(path.join(out,'browser-complete-qa-profile'),{headless:true,executablePath:'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',viewport:{width:1100,height:850},args:['--disable-dev-shm-usage']});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  await expect(page.locator('.cottage-scene')).toBeVisible();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert(before,'Run the interaction feedback fixture first');
  await roomTab(page,'设置');const lively=await page.getByRole('checkbox',{name:'自然小动作',exact:true}).isChecked();await page.getByRole('checkbox',{name:'自然小动作',exact:true}).uncheck();await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  if(!await page.locator('.room-placed-item[data-furniture=message-board]').count()){
   await page.getByRole('button',{name:'布置小屋',exact:true}).click();
   const drawer=page.getByRole('complementary',{name:'小屋布置工具'}),layer=page.locator('.time-scene>.room-furnishing-layer.is-editing');
   const card=drawer.locator('.warehouse-drag-card').first();await card.scrollIntoViewIfNeeded();const r=await layer.boundingBox();
   await card.dragTo(layer,{targetPosition:{x:r.width*.32,y:r.height*.3}});await drawer.getByRole('button',{name:'完成布置',exact:true}).click();
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'小屋留言板',exact:true}).click();await page.getByRole('button',{name:'我要留言',exact:true}).click();
  const save=page.getByRole('button',{name:'保存',exact:true});await expect(save).toBeDisabled();
  assert.equal(await save.evaluate(n=>getComputedStyle(n).opacity),'1');
  const rect=await page.locator('.board-compose').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390);
  await page.screenshot({path:path.join(out,'phone-compose-empty.png')});
  const note='手机留言回归 '+Date.now();await page.locator('#board-note').fill(note);await save.click();await expect(page.locator('.board-compose')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'编辑留言：'+note,exact:true})).toBeVisible();
  await page.screenshot({path:path.join(out,'phone-board.png')});
  await page.getByRole('button',{name:'删除留言：'+note,exact:true}).click();await page.getByRole('button',{name:'确认删除',exact:true}).click();
  await page.getByRole('button',{name:'关闭留言板',exact:true}).first().click();
  await roomTab(page,'设置');if(lively)await page.getByRole('checkbox',{name:'自然小动作',exact:true}).check();await page.getByRole('button',{name:'关闭面板',exact:true}).click();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  for(const key of ['createdAt','name','color','growth','evolution','wearing','wardrobe','inventory','notes'])assert.deepEqual(after[key],before[key],key);
  assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),viewport:[390,844],disabledLabelOpaque:true,composeWithinViewport:true,createAndDeleteNote:true,previousNotesAndIdentityRetained:true,errors};
  fs.writeFileSync(path.join(out,'mobile-board-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await context.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});

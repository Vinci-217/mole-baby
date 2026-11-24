/** End-to-end save receipts and round trips. Native QA profiles and fixtures are retained. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit,_electron,expect}=require('@playwright/test');
const {enterHome,roomTab}=require('./smoke-helpers.cjs');
const {verifyBackupImport}=require('./backup-regression.cjs');
const root=path.resolve(__dirname,'..'),native=process.argv.includes('--native'),safari=process.argv.includes('--webkit');
const engine=native?'electron':safari?'webkit':'chromium',out=path.join(root,'artifacts/save-workflow',engine+'-'+new Date().toISOString().replaceAll(':','-'));
const base=process.env.PREVIEW_URL||'http://127.0.0.1:5174/';
fs.mkdirSync(out,{recursive:true});
const fixture=require('./animation-repair-fixture.cjs')(path.join(root,'artifacts/animation-repair'));
const pet={...fixture.pet,lastTick:Date.now(),notes:[{id:'save-roundtrip',text:'存档闭环测试',done:false,createdAt:fixture.pet.createdAt}],room:{owned:['leaf-rug','message-board'],placed:[{id:'leaf-rug',x:40,y:70,instanceId:'qa-rug',scale:1.2,order:2}]}};
const backup={...pet,companionMemory:JSON.parse(fixture.snapshot['ramu-companion-memory-v1:'+pet.createdAt]),localData:{'ramu-house-preferences-v2':fixture.snapshot['ramu-house-preferences-v2']}};
const input=page=>page.locator('.save-manager input[type=file]');
const feedback=page=>page.locator('.save-manager .save-operation-feedback');
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
const upload=(page,name,value)=>input(page).setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});
function samePet(actual,expected){
 for(const key of ['createdAt','name','color','growth','highestGrowth','naturalGrowth','growthLocked','evolution','coins','wearing','inventory','notes','room','education'])assert.deepEqual(actual[key],expected[key],key);
 assert.deepEqual([...actual.wardrobe].sort(),[...expected.wardrobe].sort());
}
async function receiptAllowsRoomActions(page){
 await enterHome(page);
 const receipt=page.locator('.save-operation-receipt .save-operation-feedback');await expect(receipt).toBeVisible();
 await page.getByRole('button',{name:'布置小屋',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'小屋布置工具'})).toBeVisible();await expect(receipt).toBeVisible();
 await page.locator('.room-side-tools').getByRole('button',{name:'完成布置',exact:true}).click();
 await receipt.getByRole('button',{name:'收起存档操作提示',exact:true}).click();await expect(receipt).toHaveCount(0);
}
async function roundTrip(page,desktop){
 await enterHome(page);await roomTab(page,'设置');
 await expect(page.locator('.save-manager')).toHaveCount(1);await expect(input(page)).toHaveCount(1);
 await page.getByRole('button',{name:'检查本地存档',exact:true}).click();
 await expect(page.locator('.local-save-inspector [role=status]')).toContainText(pet.name);
 const before=await saved(page),file=path.join(out,'exported-save.json');
 if(desktop){
  await desktop.evaluate(({session},file)=>{global.qaSaveDownload='waiting';session.defaultSession.once('will-download',(_event,item)=>{item.setSavePath(file);item.once('done',(_event,state)=>global.qaSaveDownload=state)})},file);
  await page.getByRole('button',{name:'导出存档',exact:true}).click();
  await expect.poll(()=>desktop.evaluate(()=>global.qaSaveDownload)).toBe('completed');
 }else{
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档',exact:true}).click();await(await download).saveAs(file);
 }
 const exported=JSON.parse(fs.readFileSync(file));samePet(exported,before);
 assert.deepEqual(exported.companionMemory.events,backup.companionMemory.events);assert.equal(exported.localData['ramu-house-preferences-v2'],await page.evaluate(()=>localStorage.getItem('ramu-house-preferences-v2')));
 await expect(feedback(page)).toContainText('下载');await expect(feedback(page)).toBeInViewport();
 await upload(page,'invalid.json','{broken');await expect(feedback(page)).toContainText('原来的拉姆仍然保留');samePet(await saved(page),before);
 await input(page).setInputFiles(file);await expect(feedback(page)).toContainText('存档已恢复');await expect(feedback(page)).toBeInViewport();
 samePet(await saved(page),before);
 const archives=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('ramu-before-import-v1:')).map(([,value])=>JSON.parse(value)));
 if(!desktop)assert(archives.some(value=>value.createdAt===before.createdAt));
 await page.screenshot({path:path.join(out,'settings-import-success.png')});
 await page.reload();samePet(await saved(page),before);await enterHome(page);await roomTab(page,'设置');
 await expect(page.locator('#rename')).toHaveValue(before.name);
 const memory=await page.evaluate(id=>JSON.parse(localStorage.getItem('ramu-companion-memory-v1:'+id)),before.createdAt);assert.deepEqual(memory.events,backup.companionMemory.events);
 return {exportDownloadedAndParsed:true,roundTripAllPetFields:true,memoriesAndPreferences:true,reloadRetained:true,feedbackInViewport:true};
}
async function browserChecks(browser){
 const context=await browser.newContext({viewport:safari?{width:390,height:844}:{width:1000,height:850},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base);await page.locator('.adoption-save-help summary').click();
  await page.getByRole('button',{name:'检查本地存档',exact:true}).click();
  await expect(page.locator('.local-save-inspector [role=status]')).toContainText('未找到');
  for(const text of ['{broken','','null','{}','x'.repeat(1_000_001)]){
   await upload(page,'retry.json',text);await expect(feedback(page)).toHaveAttribute('role','alert');await expect(feedback(page)).toBeInViewport();assert.equal(await saved(page),null);assert.equal(await input(page).inputValue(),'');
  }
  // Real file-input retries, including the very same file after rejection.
  await upload(page,'retry.json','{broken');await expect(feedback(page)).toContainText('有效的拉姆');
  await page.screenshot({path:path.join(out,'adoption-import-error.png')});
  const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();const chooser=await picker;
  await page.evaluate(()=>document.querySelector('.save-manager input').dispatchEvent(new Event('cancel')));
  await expect(feedback(page)).toContainText('已取消选择');assert.equal(await saved(page),null);
  await chooser.setFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('.adoption-screen')).toHaveCount(0);
  const receipt=page.locator('.save-operation-receipt .save-operation-feedback');await expect(receipt).toContainText('存档已恢复');await expect(receipt).toBeInViewport();
  await page.waitForTimeout(4200);await expect(receipt).toBeVisible();
  await receiptAllowsRoomActions(page);
  const result=await roundTrip(page);
  await page.evaluate(()=>{const get=Storage.prototype.getItem;window.restoreSaveInspection=()=>Storage.prototype.getItem=get;Storage.prototype.getItem=function(key){if(key==='ramu-house-save-v1')throw Error('Storage unavailable');return get.call(this,key)}});
  await page.getByRole('button',{name:'检查本地存档',exact:true}).click();
  await expect(page.locator('.local-save-inspector [role=alert]')).toContainText('检查暂未完成');await expect(page.locator('.local-save-inspector [role=alert]')).toBeInViewport();
  await page.evaluate(()=>window.restoreSaveInspection());await page.getByRole('button',{name:'检查本地存档',exact:true}).click();await expect(page.locator('.local-save-inspector [role=alert]')).toHaveCount(0);
  // Reuse existing coverage for quota rollback, completion order and farewell.
  if(!safari)await verifyBackupImport(page);
  // Mobile export bridge: success, explicit false, rejection, cancellation.
  await page.evaluate(()=>{window.mobile={exportSave:async(text,name)=>{window.qaMobileExport={text,name};return true}}});
  await page.getByRole('button',{name:'导出存档',exact:true}).click();await expect(feedback(page)).toContainText('存档已经导出');assert.equal((await page.evaluate(()=>JSON.parse(window.qaMobileExport.text))).createdAt,pet.createdAt);
  await page.evaluate(()=>window.mobile.exportSave=async()=>false);await page.getByRole('button',{name:'导出存档',exact:true}).click();await expect(feedback(page)).toContainText('已取消导出');
  await page.evaluate(()=>window.mobile.exportSave=async()=>{throw Error('磁盘写入失败')});await page.getByRole('button',{name:'导出存档',exact:true}).click();await expect(feedback(page)).toHaveAttribute('role','alert');await expect(feedback(page)).toContainText('导出失败');
  await page.evaluate(()=>window.mobile.exportSave=async()=>{throw Error('已取消导出')});await page.getByRole('button',{name:'导出存档',exact:true}).click();await expect(feedback(page)).toHaveAttribute('role','status');await expect(feedback(page)).toContainText('已取消导出');
  await page.evaluate(()=>delete window.mobile);
  assert.deepEqual(errors,[]);
  return {...result,adoptionInvalidEmptyOversizeFeedback:true,pickerAndSameFileRetry:true,cancelFeedback:true,adoptionSuccessSurvivesScreenChange:true,receiptAllowsRoomActionsAndDismissal:true,inspectionFailureAndRetry:true,mobileBridgeResponses:true,errors};
 }catch(error){await page.screenshot({path:path.join(out,'browser-failure.png'),fullPage:true}).catch(()=>{});throw error}finally{await context.close()}
}
async function recoveryChecks(browser){
 const context=await browser.newContext(),page=await context.newPage();
 try{
  await page.goto(base+'manifest.webmanifest');await page.evaluate(()=>localStorage.setItem('ramu-house-save-v1','{damaged original'));await page.goto(base);
  await expect(page.locator('.save-recovery')).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出原始存档',exact:true}).click();const file=path.join(out,'damaged-original.json');await(await download).saveAs(file);assert.equal(fs.readFileSync(file,'utf8'),'{damaged original');
  await upload(page,'invalid.json','{}');await expect(feedback(page)).toHaveAttribute('role','alert');assert.equal(await page.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),'{damaged original');
  await upload(page,'valid.json',backup);await expect(page.locator('.save-operation-receipt')).toContainText('存档已恢复');
  assert(await page.evaluate(()=>Object.entries(localStorage).some(([key,value])=>key.startsWith('ramu-before-import-v1:')&&value==='{damaged original')));
  return {recoveryUsesSameManager:true,rawExportExact:true,rawRecordArchivedBeforeRestore:true};
 }finally{await context.close()}
}
async function nativeChecks(){
 const profile=path.join(out,'native-qa-profile'),config=path.join(out,'config'),legacy=path.join(config,'mole-baby','save-backups');
 fs.mkdirSync(legacy,{recursive:true});fs.writeFileSync(path.join(legacy,'latest.json'),JSON.stringify(backup));
 const desktop=await _electron.launch({args:[root,'--no-sandbox','--user-data-dir='+profile],env:{...process.env,XDG_CONFIG_HOME:config,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},timeout:45000});
 try{
  const page=await desktop.firstWindow();await page.waitForLoadState('domcontentloaded');await page.locator('.adoption-save-help summary').click();
  await page.getByRole('button',{name:'检查本地存档',exact:true}).click();
  await expect(page.locator('.local-save-paths')).toContainText(profile);await expect(page.locator('.local-save-inspector')).toContainText('旧版本目录备份');
  // Actual disk failure, with the original QA backup retained under another name.
  fs.renameSync(path.join(legacy,'latest.json'),path.join(legacy,'retained.json'));
  await page.getByRole('button',{name:'导入这份备份',exact:true}).click();await expect(page.locator('.local-save-inspector [role=alert]')).toContainText('暂时无法读取');await expect(page.locator('.local-save-inspector [role=alert]')).toBeInViewport();assert.equal(await saved(page),null);
  fs.renameSync(path.join(legacy,'retained.json'),path.join(legacy,'latest.json'));
  await page.getByRole('button',{name:'导入这份备份',exact:true}).click();await expect(page.locator('.save-operation-receipt')).toContainText('存档已恢复');
  await receiptAllowsRoomActions(page);
  const imported=await saved(page);
  const result=await roundTrip(page,desktop),info=await page.evaluate(()=>window.desktop.localSaves.inspect());assert.equal(info.profileDirectory,profile);
  assert(fs.readdirSync(info.backupDirectory).some(name=>name.includes('before-import')));
  // Only this isolated QA record is removed before the next React mount.
  await page.addInitScript(()=>{if(sessionStorage.getItem('qa-missing-primary')==='yes'){sessionStorage.removeItem('qa-missing-primary');localStorage.removeItem('ramu-house-save-v1')}});
  await page.evaluate(()=>sessionStorage.setItem('qa-missing-primary','yes'));await page.reload();await expect(page.getByTestId('desktop-character')).toBeVisible();samePet(await saved(page),imported);
  return {...result,realLegacyBackupSearch:true,unavailableBackupFeedback:true,selectedBackupImport:true,preImportDiskArchive:true,missingBrowserRecordAutoRecovered:true};
 }finally{await desktop.close()}
}
(async()=>{
 let browser;
 try{
  let checks;
  if(native)checks=await nativeChecks();
  else{browser=await(safari?webkit:chromium).launch({headless:true,executablePath:safari?'/usr/local/share/ms-playwright/webkit-2370/pw_run.sh':'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome',...(safari?{}:{args:['--disable-dev-shm-usage']})});checks={...await browserChecks(browser),...await recoveryChecks(browser)}}
  const result={engine,checks};fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser?.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

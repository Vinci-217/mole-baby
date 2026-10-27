const assert=require('node:assert/strict');
const{expect}=require('@playwright/test');
const{enterHome,roomTab}=require('./smoke-helpers.cjs');

/** Real file-input imports: validation, storage failure, completion order and
 * farewell. Use an isolated page so the rest of the smoke keeps its own pet. */
async function verifyBackupImport(source){
 const context=await source.context().browser().newContext({viewport:{width:1180,height:820}}),page=await context.newPage();
 try{
  const saved=await source.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  await page.goto(source.url());await page.evaluate(values=>{localStorage.clear();for(const[key,value]of Object.entries(values))localStorage.setItem(key,value)},saved);await page.reload();
  await enterHome(page);await roomTab(page,'设置');
  const input=page.locator('.room-backup input[type=file]');
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  const upload=async(name,pet)=>input.setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(typeof pet==='string'?pet:JSON.stringify(pet))});
  await upload('broken.json','{invalid');
  await expect(page.locator('.panel-feedback')).toContainText('原来的拉姆仍然保留');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt),original.createdAt);
  await page.evaluate(()=>{const set=Storage.prototype.setItem;window.restoreBackupStorage=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(key,value){if(key==='ramu-house-save-v1'&&JSON.parse(value).name==='不能写入'){window.backupWriteRejected=true;throw new DOMException('Full','QuotaExceededError')}return set.call(this,key,value)}});
  const rejected={...original,name:'不能写入',createdAt:original.createdAt-10_000};
  await upload('quota.json',rejected);
  await expect.poll(()=>page.evaluate(()=>window.backupWriteRejected)).toBe(true);
  await expect(page.locator('#rename')).toHaveValue(original.name);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt),original.createdAt);
  assert.equal(await page.evaluate(id=>localStorage.getItem('ramu-companion-memory-v1:'+id),rejected.createdAt),null);
  await page.evaluate(()=>window.restoreBackupStorage());
  const restored={...original,name:'恢复小叶',createdAt:original.createdAt-20_000};
  await upload('valid.json',restored);await expect(page.locator('#rename')).toHaveValue('恢复小叶');
  await page.reload();await enterHome(page);await roomTab(page,'设置');await expect(page.locator('#rename')).toHaveValue('恢复小叶');
  await page.evaluate(()=>{const read=File.prototype.text;window.restoreBackupFile=()=>File.prototype.text=read;File.prototype.text=function(){if(this.name==='delayed.json')return new Promise(resolve=>window.finishDelayedBackup=()=>read.call(this).then(resolve));return read.call(this)}});
  await upload('delayed.json',{...restored,name:'过期导入'});
  await expect.poll(()=>page.evaluate(()=>typeof window.finishDelayedBackup)).toBe('function');
  await upload('latest.json',{...restored,name:'最后导入'});await expect(page.locator('#rename')).toHaveValue('最后导入');
  await page.evaluate(()=>window.finishDelayedBackup());await page.waitForTimeout(100);await expect(page.locator('#rename')).toHaveValue('最后导入');
  await upload('delayed.json',{...restored,name:'不能复活'});
  await page.getByRole('button',{name:'送别拉姆',exact:true}).click();await page.getByRole('button',{name:'确认送别',exact:true}).click();
  await page.evaluate(()=>window.finishDelayedBackup());await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ramu-house-save-v1')),null);
  console.log('PASS backup file import: malformed/quota failure preserves pet, valid restore survives reload, stale imports cannot overwrite or resurrect a pet');
 }finally{
  await context.close();
 }
}
module.exports={verifyBackupImport};

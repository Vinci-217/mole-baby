/** Verify candidate provenance, all exported PNGs, and real reader interactions. */
const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'local-assets/book-candidates'),out=path.join(root,'artifacts/book-candidates-20261117');
const url=process.env.MOLE_BOOK_CANDIDATES_URL||'http://127.0.0.1:5181/book-candidates/';
const catalog=JSON.parse(fs.readFileSync(path.join(folder,'catalog.json'))),notes=JSON.parse(fs.readFileSync(path.join(folder,'assessments.json')));
const report={at:new Date().toISOString(),url,sources:0,images:0,fullBooks:[],screens:[],errors:[],httpErrors:[]};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main(){
 for(const row of catalog.items){assert.equal(sha(path.join(root,'local-assets/raw/root',row.path)),row.sha256);report.sources++;
  for(const file of row.samples){const metadata=await sharp(path.join(folder,file)).metadata();assert.ok(metadata.width>0&&metadata.height>0);await sharp(path.join(folder,file)).stats();report.images++}
  if(row.frames>1&&row.samples.length===row.frames&&row.sampleFrames.length===row.frames)report.fullBooks.push({title:notes[row.path]?.title||row.path,frames:row.frames});
 }
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true});
 try{
  for(const width of[1360,393,320]){
   const context=await browser.newContext({viewport:{width,height:width>650?1100:852},hasTouch:width<650,isMobile:width<650}),page=await context.newPage();
   page.on('pageerror',error=>report.errors.push(error.message));page.on('response',response=>{if(response.status()>=400)report.httpErrors.push([response.status(),response.url()])});
   await page.goto(url);await expect(page.locator('.card')).toHaveCount(71);
   await page.locator('#group').selectOption('优先加入');await expect(page.locator('.card')).toHaveCount(5);
   await page.locator('.card .cover img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
   await page.screenshot({path:path.join(out,`recommended-${width}.png`),fullPage:true});
   for(const row of catalog.items.filter(row=>notes[row.path]?.group==='优先加入')){
    const title=notes[row.path].title;await page.getByRole('button',{name:`查看《${title}》`,exact:true}).click();
    for(let index=0;index<row.samples.length;index++){
     const image=page.locator('#page');await expect(image).toHaveAttribute('src',row.samples[index]);await image.evaluate(image=>image.decode());
     const fit=await image.boundingBox();assert.ok(fit.x>=-1&&fit.y>=-1&&fit.x+fit.width<=width+1&&fit.y+fit.height<=page.viewportSize().height+1);
     if(index===1&&row.path.endsWith('/107.swf'))await page.screenshot({path:path.join(out,`healing-book-${width}.png`)});
     if(index<row.samples.length-1){const book=await page.locator('.original').boundingBox();const point={x:book.x+book.width*.9,y:book.y+book.height*.86};if(width<650)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y)}
    }
    await expect(page.locator('.next')).toBeDisabled();await page.keyboard.press('ArrowLeft');await expect(page.locator('#page')).toHaveAttribute('src',row.samples[row.samples.length-2]);
    await page.keyboard.press('Escape');await expect(page.locator('dialog')).not.toBeVisible();
   }
   await page.locator('#group').selectOption('');await page.locator('#q').fill('拉姆救治师手册');await expect(page.locator('.card')).toHaveCount(1);
   await page.locator('#q').fill('');await page.locator('#copies').check();await expect(page.locator('.card')).toHaveCount(86);
   await page.locator('#q').fill('this-book-does-not-exist');await expect(page.locator('.card')).toHaveCount(0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   report.screens.push({width,allFiveBooksFullyRead:true,firstAndLastBoundaries:true,searchAndFilter:true,exactDuplicatesHidden:true,noOverflow:true});await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log(JSON.stringify(report));
 }finally{await browser.close()}
}
main().catch(error=>{report.failure=error.stack;console.error(error);process.exitCode=1}).finally(()=>fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n'));

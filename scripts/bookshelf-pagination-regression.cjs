/** Entire original App library, furniture pagination, mobile and save roundtrip. */
const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {enterHome}=require('./smoke-helpers.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/bookshelf-spines');
const origin=process.env.MOLE_BOOKSHELF_URL||'http://127.0.0.1:5190',PET='ramu-house-save-v1';
const booksPerRow=7,booksPerPage=booksPerRow*2;
const books=JSON.parse(fs.readFileSync(path.join(root,'public/assets/original/reading-books/catalog.json'))),receipt=JSON.parse(fs.readFileSync(path.join(root,'public/assets/original/reading-books/source.json'))),count=Math.ceil(books.length/booksPerPage);
const report={at:new Date().toISOString(),books:books.length,shelfPages:count,images:0,rooms:[],errors:[],httpErrors:[]};
const stored=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),PET);
const shelf=page=>page.locator('.room-piece').filter({has:page.locator('.room-placed-item[data-furniture="reading-shelf"]')}).first();
const warehouse=page=>page.getByRole('complementary',{name:'小屋布置工具'});
const card=page=>warehouse(page).locator('article').filter({has:page.locator('strong',{hasText:/^拉姆书架$/})});
async function ready(page,book,index){await expect(page.locator('.reading-original-book')).toHaveAttribute('data-book',book.id);await expect(page.locator('.reading-original-book')).toHaveAttribute('data-page',String(index));await page.locator('.reading-page-image').evaluate(image=>image.decode());const r=await page.locator('.reading-original-book').boundingBox(),v=page.viewportSize();assert.ok(r.width>0&&r.height>0&&r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,JSON.stringify({r,v,book:book.id,index}))}
async function corner(page,id,direction){const r=await page.locator('.reading-original-book').boundingBox(),x=direction==='next'?(id==='secret'?.9:.95):(id==='secret'?.08:.05),y=id==='secret'?.86:.88;if(page.viewportSize().width<650)await page.touchscreen.tap(r.x+r.width*x,r.y+r.height*y);else await page.mouse.click(r.x+r.width*x,r.y+r.height*y)}
async function goToShelfPage(page,index){
 let at=(await stored(page)).room.placed.find(piece=>piece.id==='reading-shelf').shelfPage??0;
 if(at!==index)await shelf(page).getByRole('combobox',{name:'跳到书架页'}).selectOption(String(index));
 await expect(shelf(page).locator('.room-shelf-pages')).toHaveAttribute('aria-label',`书架第 ${index+1} 页，共 ${count} 页`);
 await expect(shelf(page).locator('.room-shelf-book-hit > .reading-shelf-spine')).toHaveCount(Math.min(booksPerPage,books.length-index*booksPerPage));
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const hashes=new Set();
 for(const source of receipt.sources){assert.ok(!hashes.has(source.sourceSha256),'Duplicate source '+source.id);hashes.add(source.sourceSha256);for(const item of source.pages){const file=path.join(root,'public/assets/original/reading-books',item.file);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),item.sha256);const image=await sharp(file).metadata();assert.ok(image.width>0&&image.height>0);report.images++}}
 assert.equal(report.images,books.reduce((sum,book)=>sum+book.pages.length,0));assert.equal(new Set(books.map(book=>book.title)).size,books.length);
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true});let page;
 try{
  for(const width of[1360,393,320]){
   const context=await browser.newContext({viewport:{width,height:width>650?900:852},hasTouch:width<650,isMobile:width<650});page=await context.newPage();
   page.on('pageerror',error=>report.errors.push(error.message));page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)report.httpErrors.push([response.status(),response.url()])});
   await page.addInitScript(()=>{const now=Date.now();if(!localStorage.getItem('ramu-house-save-v1'))localStorage.setItem('ramu-house-save-v1',JSON.stringify({version:1,name:'旧小屋',color:'blue',createdAt:now-86400000,lastTick:now,growth:180,highestGrowth:180,coins:1000,stats:{hunger:90,thirst:90,happiness:90,cleanliness:90,health:100,energy:90},inventory:{biscuit:2,juice:2},sleeping:false,completedGames:0,lastRewardAt:0,room:{owned:['plant'],placed:[{id:'plant',x:15,y:70}]}}));localStorage.setItem('ramu-house-preferences-v2',JSON.stringify({lively:false,presence:false,outings:false,roomWander:false,sound:false,reminders:false}))});
   await page.goto(origin+'/?preview=bookshelf');await expect(page.locator('.cottage-scene')).toBeVisible();const old=await stored(page);
   await page.getByRole('button',{name:'布置小屋',exact:true}).click();await expect(card(page)).toBeVisible();
   await card(page).getByRole('button',{name:'放进小屋',exact:true}).click();await page.locator('.room-side-tools').getByRole('button',{name:'完成布置',exact:true}).click();
   await expect(shelf(page).getByRole('button',{name:'书架上一页',exact:true})).toBeDisabled();
   let turns=0,checkedShelfPage=-1;
   for(const [index,book]of books.entries()){
    const shelfPage=Math.floor(index/booksPerPage);
    if(shelfPage!==checkedShelfPage){
     await goToShelfPage(page,shelfPage);
     const spines=await shelf(page).locator('.room-shelf-book-hit').evaluateAll(buttons=>Promise.all(buttons.map(async button=>{
      const art=button.querySelector('.reading-shelf-spine'),rect=art.getBoundingClientRect();
      const glyphs=[...art.querySelector('.reading-shelf-spine-title').children].map(glyph=>glyph.getBoundingClientRect());
      const slot=button.getBoundingClientRect();
      const image=art.querySelector('.reading-shelf-spine-art');
      if(image)await image.decode();
      return {label:button.getAttribute('aria-label'),art:image?.currentSrc,slot:slot.toJSON(),
       upright:rect.height>rect.width&&glyphs.every((glyph,index)=>index===0||glyph.top>=glyphs[index-1].bottom-.5)};
     })));
     assert.ok(spines.every(spine=>spine.upright));
     const visibleBooks=books.slice(shelfPage*booksPerPage,(shelfPage+1)*booksPerPage);
     assert.deepEqual(spines.map(spine=>spine.label),visibleBooks.map(book=>`阅读《${book.title}》`));
     for(const row of [spines.slice(0,booksPerRow),spines.slice(booksPerRow)]){
      assert.ok(row.every(({slot},index)=>Math.abs(slot.bottom-row[0].slot.bottom)<.5&&
       (index===0||Math.abs(slot.left-row[index-1].slot.right)<.5)));
     }
     assert.ok(spines.length<=booksPerRow||spines[booksPerRow].slot.top>spines[0].slot.bottom);
     for(const [position,visibleBook] of visibleBooks.entries()){
      const {art}=spines[position];
      if(visibleBook.id.startsWith('gazette-'))assert.equal(art,undefined);
      else {
       const asset=art?.match(/\/assets\/generated\/reading-spines\/([^/]+\.webp)$/)?.[1];
       assert.ok(asset&&fs.existsSync(path.join(root,'public/assets/generated/reading-spines',asset)),art);
      }
     }
     checkedShelfPage=shelfPage;
    }
    if(index===booksPerPage){await page.mouse.move(4,4);await page.screenshot({path:path.join(out,`shelf-page-2-${width}.png`)})}
    const bookButton=shelf(page).getByRole('button',{name:`阅读《${book.title}》`,exact:true});
    if(index===0&&width===1360){
     const spine=bookButton.locator('.reading-shelf-spine');
     const initial=await spine.evaluate(element=>getComputedStyle(element).boxShadow);
     await bookButton.hover();
     await expect.poll(()=>spine.evaluate(element=>getComputedStyle(element).boxShadow)).not.toBe(initial);
    }
    if(width<650)await bookButton.tap();else await bookButton.click();
    if(book.id==='supplies')await page.getByRole('button',{name:'查看原版书页',exact:true}).click();
    await ready(page,book,0);
    assert.equal(await page.locator('.reading-original-book header,.reading-original-book footer,.reading-original-book select').count(),0);
    await expect(page.getByRole('button',{name:'上一页',exact:true})).toBeDisabled();
    const last=width===1360?book.pages.length-1:Math.min(book.pages.length-1,2);
    for(let at=1;at<=last;at++){await corner(page,book.id,'next');await ready(page,book,at);turns++}
    if(width===1360)await expect(page.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();
    if(book.id==='rescue'||book.id==='ram-world'||book.id==='library-angelguidebook'||book.id==='library-naturalnessbook'){
     if(width===1360&&book.pages.length>2){await page.keyboard.press('Home');for(let at=last;at>1;at--){await page.keyboard.press('ArrowLeft');await ready(page,book,at-1)}}
     await page.mouse.move(4,4);await page.screenshot({path:path.join(out,`${book.id}-${width}.png`)});
    }
    const at=Number(await page.locator('.reading-original-book').getAttribute('data-page'));
    if(at>0){await corner(page,book.id,'previous');await ready(page,book,at-1)}
    await page.getByRole('button',{name:'合上书本',exact:true}).click();await expect(page.locator('.reading-original-book')).toHaveCount(0);
    if(book.id==='supplies')await page.getByRole('dialog',{name:'拉姆手册',exact:true}).getByRole('button',{name:'关闭面板',exact:true}).click();
    await expect(shelf(page).locator('.room-shelf-pages')).toHaveAttribute('aria-label',`书架第 ${shelfPage+1} 页，共 ${count} 页`);
    if(index%10===9)console.log(JSON.stringify({width,booksChecked:index+1,turns}));
   }
   await expect(shelf(page).getByRole('button',{name:'书架下一页',exact:true})).toBeDisabled();
   const lastShelf=await stored(page);assert.equal(lastShelf.room.placed[1].shelfPage,count-1);
   await page.reload();await expect(shelf(page).locator('.room-shelf-pages')).toHaveAttribute('aria-label',`书架第 ${count} 页，共 ${count} 页`);
   const finalBook=books.at(-1),bookmark=(await stored(page)).reading.pages[finalBook.id];await shelf(page).getByRole('button',{name:`阅读《${finalBook.title}》`,exact:true}).click();await ready(page,finalBook,bookmark);await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'布置小屋',exact:true}).click();await card(page).getByRole('button',{name:'放进小屋',exact:true}).click();
   const copied=page.locator('.room-placed-item[data-furniture="reading-shelf"]').nth(1);await copied.focus();
   for(let step=0;step<10;step++)await copied.press('Shift+ArrowRight');
   await page.locator('.room-side-tools').getByRole('button',{name:'完成布置',exact:true}).click();
   const shelves=page.locator('.room-piece').filter({has:page.locator('.room-placed-item[data-furniture="reading-shelf"]')});assert.equal(await shelves.count(),2);
   await expect(shelves.nth(1).locator('.room-shelf-pages')).toHaveAttribute('aria-label',`书架第 1 页，共 ${count} 页`);
   await goToShelfPage(page,0);await expect(shelves.nth(1).locator('.room-shelf-pages')).toHaveAttribute('aria-label',`书架第 1 页，共 ${count} 页`);
   await shelf(page).getByRole('button',{name:'书架下一页',exact:true}).click();await expect(shelves.nth(1).locator('.room-shelf-pages')).toHaveAttribute('aria-label',`书架第 1 页，共 ${count} 页`);
   const saved=await stored(page);assert.equal(saved.createdAt,old.createdAt);assert.equal(saved.coins,old.coins);assert.equal(saved.inventory.biscuit,old.inventory.biscuit);assert.deepEqual(saved.room.placed[0],old.room.placed[0]);assert.deepEqual(saved.room.owned,old.room.owned);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(width===1360){await page.goto(origin);await page.getByTestId('desktop-character').waitFor();await enterHome(page);await expect(shelf(page).locator('.room-shelf-pages')).toHaveAttribute('aria-label',`书架第 2 页，共 ${count} 页`)}
   report.rooms.push({width,allBooksReachable:true,readerTurns:turns,allPagesTurned:width===1360,independentShelfPages:true,pagesAndBookmarksSurviveReload:true,firstAndLastShelfBoundaries:true,existingPetAndFurniturePreserved:true,noOverflow:true});await context.close();page=null;
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.httpErrors,[]);report.passed=true;console.log(JSON.stringify(report));
 }catch(error){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});report.failure=error.stack;throw error}
 finally{await browser.close();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n')}
}
main().catch(error=>{console.error(error);process.exitCode=1});

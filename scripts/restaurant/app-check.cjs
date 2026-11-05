const {chromium,expect}=require('@playwright/test'),assert=require('assert/strict');
const {adopt,enterHome}=require('../smoke-helpers.cjs');
let browser;(async()=>{
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true});const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/');await adopt(page,'蓝色','紫紫');
 await page.addInitScript(()=>{if(localStorage.getItem('restaurant-check-seeded'))return;const p=JSON.parse(localStorage.getItem('ramu-house-save-v1'));Object.assign(p,{color:'#9b59d0',growth:180,highestGrowth:180,growthLocked:true,coins:1000});localStorage.setItem('ramu-house-save-v1',JSON.stringify(p));localStorage.setItem('restaurant-check-seeded','1')});await page.reload();await enterHome(page);
 await page.getByRole('button',{name:'进入拉姆餐厅',exact:true}).click();await expect(page.getByRole('dialog',{name:'拉姆餐厅',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'灶台 1 空闲',exact:true}).click();await page.getByRole('button',{name:'备菜 酱爆雪顶菇 20 摩尔豆',exact:true}).click();await page.getByRole('button',{name:'开始营业',exact:true}).click();
 await page.getByRole('button',{name:'离开餐厅',exact:true}).click();
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert.equal(saved.coins,980);assert.equal(saved.color,'#9b59d0');assert.equal(saved.growthLocked,true);assert(saved.restaurant.stoves[0]);
 await page.reload();await enterHome(page);await page.getByRole('button',{name:'进入拉姆餐厅',exact:true}).click();await expect(page.getByRole('button',{name:'开始营业',exact:true})).toBeVisible();
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));assert.equal(saved.coins,980);assert.equal(saved.color,'#9b59d0');assert.equal(saved.restaurant.stoves[0].dish,1340002);
 assert.deepEqual(errors,[]);console.log('PASS main app room entry, bean purchase, close/reopen without offline pay, persistent custom purple colour and cooking progress');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});

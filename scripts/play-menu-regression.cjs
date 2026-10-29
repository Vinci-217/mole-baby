const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium,expect}=require('@playwright/test');
const {adopt,enterHome,toDesktop,roomTab,openActions,enterBackpack,buy}=require('./smoke-helpers.cjs');
const {reloadWithStorage}=require('./smoke-storage.cjs');
const index=require('../public/assets/original/uploaded-actions/index.json');
const root=path.resolve(__dirname,'..'),url='http://127.0.0.1:5237',out=path.join(root,'artifacts/play-menu');
const baseline=process.argv.includes('--baseline');
const source=fs.readFileSync(path.join(root,'src/uploaded-item-data.ts'),'utf8');
const newItems=JSON.parse(source.slice(source.indexOf('=[')+1,source.lastIndexOf(']')+1));
let server,browser;
async function main(){
  fs.mkdirSync(out,{recursive:true});
  server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5237','--strictPort'],{cwd:root,stdio:'ignore'});
  for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
  const page=await browser.newPage({viewport:{width:1180,height:820}});page.setDefaultTimeout(15000);await page.goto(url);await adopt(page,'红色','小红');
  const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ramu-house-save-v1')));
  async function setup(growth=180,evolution,low=false,item){
    const snapshot=await page.evaluate(({growth,evolution,low,item})=>{const entries=Object.fromEntries(Object.entries(localStorage)),p=JSON.parse(entries['ramu-house-save-v1']);Object.assign(p,{growth,evolution,growthLocked:true,sleeping:false,wearing:undefined,activity:undefined,outing:undefined,coins:100000,lastTick:Date.now()});p.stats=item?{hunger:20,thirst:20,cleanliness:20,happiness:20,health:40,energy:95}:{hunger:low?20:95,thirst:95,cleanliness:95,happiness:70,health:100,energy:95};if(item)p.inventory={[item.id]:1};entries['ramu-house-save-v1']=JSON.stringify(p);entries['ramu-house-preferences-v2']=JSON.stringify({lively:false,presence:false,outings:false,sound:false,quiet:true});return entries},{growth,evolution,low,item});
    await reloadWithStorage(page,snapshot);await page.getByTestId('desktop-character').waitFor();
  }
  async function playPanel(){await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'玩耍',exact:true}).click();return page.getByTestId('companion-panel')}
  await setup();await enterHome(page);await roomTab(page,'游戏');await page.getByRole('button',{name:'一起翻翻书',exact:true}).click();await toDesktop(page);
  const panel=await playPanel(),football=panel.getByRole('button',{name:'原版踢足球',exact:true});await football.scrollIntoViewIfNeeded();
  await expect(football)[baseline?'toBeDisabled':'toBeEnabled']();
  await page.screenshot({path:path.join(out,baseline?'before-reading.png':'after-reading.png')});
  if(!baseline){await football.click();await expect(page.locator('.ram-uploaded')).toHaveAttribute('data-uploaded-action','180004');await page.keyboard.press('Escape')}
  console.log(baseline?'REPRODUCED: passive reading disables manual original play':'PASS: manual original play interrupts passive reading');
  await setup(180,undefined,true);await playPanel();const message=page.getByRole('status').filter({hasText:'先喂食'});
  await expect(football).toBeDisabled();await expect(message)[baseline?'toHaveCount':'toBeVisible'](...(baseline?[0]:[]));
  if(!baseline)await message.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,baseline?'before-low-need.png':'after-low-need.png')});
  console.log(baseline?'REPRODUCED: unmet needs disable original play without an explanation':'PASS: unmet needs show the exact reason and remedy');
  if(baseline)return;
  const interactions=[];
  for(const[growth,evolution,form]of [[60,undefined,'junior'],[180,undefined,'middle'],[420,undefined,'senior'],[840,'classic','classic']]){
    await setup(growth,evolution);await playPanel();
    const labels=await panel.locator('.uploaded-actions-menu>div>button').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-label')));assert.equal(labels.length,10);
    for(const[labelIndex,label]of labels.entries()){
      if(labelIndex)await playPanel();const button=panel.getByRole('button',{name:label,exact:true});await expect(button).toBeEnabled();await button.click();
      const frame=page.locator('.ram-uploaded canvas[data-sheet=uploaded]');await expect(frame).toHaveAttribute('data-form',form);await expect(frame).toHaveAttribute('data-loaded','true',{timeout:30000});const id=await frame.getAttribute('data-uploaded-id');assert.ok(index[form+'-'+id]);interactions.push({form,id,label});await page.keyboard.press('Escape');
    }
  }
  console.log('PASS: all 10 original play entries load real animated canvases in all four supplied forms (40 UI clicks)');
  await setup(840,'classic');await enterHome(page);
  const before=await save();const names={food:'食物',drink:'饮品',clean:'清洁',medicine:'药水'};
  for(const item of newItems){
    await buy(page,item.id,item.name,names[item.category]);
    await expect.poll(async()=>(await save()).inventory[item.id]).toBe((before.inventory[item.id]??0)+1);
  }
  const after=await save();assert.equal(before.coins-after.coins,newItems.reduce((n,i)=>n+i.price,0));
  console.log('PASS: all 28 added supplies are purchasable across shop categories/pages, inventory persists and prices settle exactly');
  const supplies=[];
  for(const item of newItems){
    const form=['middle','junior','senior','classic'].find(f=>index[f+'-'+item.sourceId]);assert.ok(form,item.name+' must have a supplied original form');
    await setup({junior:60,middle:180,senior:420,classic:840}[form],form==='classic'?'classic':undefined,false,item);await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'状态',exact:true}).click();const pocket=await enterBackpack(page);await pocket.locator('[role=tab][data-category='+item.category+']').click();await pocket.locator(`[data-item-id="${item.id}"]`).click();
    const frame=page.locator('.ram-uploaded canvas[data-sheet=uploaded]');await expect(frame).toHaveAttribute('data-loaded','true',{timeout:30000});await expect(frame).toHaveAttribute('data-uploaded-id',item.sourceId);await expect(frame).toHaveAttribute('data-form',form);
    const saved=await save();assert.equal(saved.inventory[item.id]??0,0,item.name+' must consume exactly one');assert.ok(['hunger','thirst','cleanliness','happiness','health'].some(key=>saved.stats[key]>(key==='health'?40:20)+.5),item.name+' must apply its care effect');supplies.push({id:item.id,name:item.name,category:item.category,form,clip:item.sourceId});await page.keyboard.press('Escape');
  }
  fs.writeFileSync(path.join(out,'verified-entries.json'),JSON.stringify({interactions,supplies},null,2)+'\n');
  console.log('PASS: all 28 added supplies consume once, load their actual source animation and increase care stats');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});

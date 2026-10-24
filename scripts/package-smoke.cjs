const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{_electron,expect}=require('@playwright/test'),asar=require('@electron/asar');
const{adopt,openActions}=require('./smoke-helpers.cjs'),{verifyCompactCare}=require('./compact-care-checks.cjs'),{version}=require('../package.json');
const root=path.resolve(__dirname,'..');
function requireFile(filename,magic){assert.ok(fs.existsSync(filename),`Missing ${filename}`);const bytes=fs.readFileSync(filename);assert.ok(bytes.length>0);if(magic)assert.deepEqual([...bytes.subarray(0,magic.length)],magic);return bytes}
async function verifyApplication({executable,archive,screenshot}){
 let desktop,profile,page;const errors=[];
 try{
  requireFile(archive);const paths=new Set(asar.listPackage(archive).map(p=>p.replace(/\\/g,'/').replace(/^\//,'')));
  for(const p of['package.json','electron/main.cjs','electron/preload.cjs','electron/desktop-geometry.cjs','electron/Mac 打开说明.html','dist/index.html','dist/favicon.png','dist/icons/tray.png','dist/icons/tray-mac.png','dist/icons/tray-mac@2x.png','dist/assets/original/seed/body.png','dist/assets/original/seed/pot.png','dist/assets/generated/v15-butterfly.png'])assert.ok(paths.has(p),p);
  for(const form of['junior','middle','senior','super','water','wood','fire'])for(const layer of['neutral','mask'])assert.ok(paths.has(`dist/assets/classic/${form}-${layer}.png`));
  for(const outfit of Object.values(require('../public/assets/original/wardrobe-motion/runtime.json').outfits))for(const kinds of Object.values(outfit.forms))for(const sheet of Object.values(kinds))assert.ok(paths.has(`dist/assets/original/wardrobe-motion/${sheet.file}`));
  for(const retired of['electron/deepseek.cjs','electron/speech.cjs'])assert.ok(!paths.has(retired),'Retired conversation backend must not be packaged');
  assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,version);console.log('PASS: complete original pet/outfit payload; retired AI and speech backends absent');
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'mole-package-'));fs.writeFileSync(path.join(profile,'companion-ai-key.json'),'retired-test-key');
  desktop=await _electron.launch({executablePath:executable,args:[`--user-data-dir=${profile}`],env:{...process.env,ELECTRON_DEV:'0'},cwd:root,timeout:30000});page=await desktop.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.waitForLoadState('domcontentloaded');await page.waitForFunction(()=>window.desktop?.isElectron===true,undefined,{polling:100,timeout:30000});
  assert.ok(!fs.existsSync(path.join(profile,'companion-ai-key.json')));assert.equal(await page.evaluate(()=>typeof window.companionAI+':'+typeof window.companionSpeech),'undefined:undefined');assert.equal(await desktop.evaluate(({app})=>app.getName()),'拉姆');
  if(process.platform==='darwin'){
   assert.equal(await desktop.evaluate(({app})=>app.dock.isVisible()),false);
   const tray=await desktop.evaluate(({app,nativeImage})=>{const load=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),{createTrayIcon}=load('./electron/tray-icon.cjs');const icon=createTrayIcon(nativeImage,process.platform,name=>app.getAppPath()+'/dist/icons/'+name);return{template:icon.isTemplateImage(),size:icon.getSize(),scales:icon.getScaleFactors()}});assert.equal(tray.template,true);assert.equal(tray.size.width,18);assert.ok(tray.scales.includes(1)&&tray.scales.includes(2));console.log('PASS: macOS menu-bar icon uses native template tint and 18pt/Retina representations');
  }
  await adopt(page,'蓝色','小叶');await verifyCompactCare(page,desktop);assert.deepEqual(errors,[]);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'喂食',exact:true}).click();await page.waitForTimeout(220);await page.screenshot({path:path.join(root,'artifacts',screenshot),omitBackground:true});await page.getByRole('button',{name:'关闭小窗',exact:true}).click();console.log(`PASS: packaged ${process.platform}/${process.arch} compact desktop, native cursor and four-edge interaction, tray lifecycle and no conversation services`);
 }catch(error){if(page&&!page.isClosed()){console.error('Renderer diagnostics:',await page.evaluate(()=>({url:location.href,ready:document.readyState,desktop:typeof window.desktop,body:document.body.innerText.slice(0,1800)})).catch(()=>null));await page.screenshot({path:path.join(root,'artifacts',screenshot)}).catch(()=>{});}throw error}
 finally{if(desktop){const closed=desktop.waitForEvent('close',{timeout:20000});await desktop.evaluate(({app})=>app.quit()).catch(()=>{});await closed;}if(profile)await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:15,retryDelay:250})}
}
module.exports={verifyApplication,requireFile};

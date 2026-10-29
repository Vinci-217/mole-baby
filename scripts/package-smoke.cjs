const{verifyUpdateSurface}=require('./update-surface-checks.cjs');
const{verifyV28}=require('./v28-companion-checks.cjs');
const{verifyWindowsChrome}=require('./windows-window-chrome.cjs');
const{verifyTransparentHover}=require('./transparent-hover-checks.cjs');
const{verifyRendererPolicy}=require('./renderer-policy-checks.cjs');
const{verifyElasticCare}=require('./elastic-care-checks.cjs');
const{verifyLivelyCompanion}=require('./lively-companion-checks.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{_electron,expect}=require('@playwright/test'),asar=require('@electron/asar');
const{adopt,openActions}=require('./smoke-helpers.cjs'),{verifyCompactCare}=require('./compact-care-checks.cjs'),{version}=require('../package.json');
const root=path.resolve(__dirname,'..');
function requireFile(filename,magic){assert.ok(fs.existsSync(filename),`Missing ${filename}`);const bytes=fs.readFileSync(filename);assert.ok(bytes.length>0);if(magic)assert.deepEqual([...bytes.subarray(0,magic.length)],magic);return bytes}
async function verifyApplication({executable,archive,screenshot}){
 let desktop,profile,page,primaryError,child;const errors=[];let mainOutput='';
 try{
  requireFile(archive);requireFile(path.join(path.dirname(archive),'app-update.yml'));const split=await require('./packaged-motion-assets.cjs').verifyMotionResources(archive);console.log(`PASS split original animation payload: ${split.files} exact external resources, core ASAR ${split.coreAsarBytes} bytes, original ZIP size/CRC/SHA checks retained`);const paths=new Set(asar.listPackage(archive).map(p=>p.replace(/\\/g,'/').replace(/^\//,'')));
  for(const p of['package.json','electron/main.cjs','electron/updates.cjs','electron/update-prompts.cjs','electron/windows-runtime.cjs','node_modules/electron-updater/package.json','electron/preload.cjs','electron/desktop-geometry.cjs','electron/Mac 打开说明.html','dist/index.html','dist/favicon.png','dist/icons/tray.png','dist/icons/tray-mac.png','dist/icons/tray-mac@2x.png','dist/assets/original/seed/body.webp','dist/assets/original/seed/pot.webp','dist/assets/generated/v15-butterfly.webp','dist/assets/original/football/head-poses.json'])assert.ok(paths.has(p),p);
  for(const form of['junior','middle','senior','super','water','wood','fire'])for(const layer of['neutral','mask'])assert.ok(paths.has(`dist/assets/classic/${form}-${layer}.webp`));
  for(const outfit of Object.values(require('../public/assets/original/wardrobe-motion/runtime.json').outfits))for(const kinds of Object.values(outfit.forms))for(const sheet of Object.values(kinds))assert.ok(paths.has(`dist/assets/original/wardrobe-motion/${sheet.file.replace(/\.png$/,'.webp')}`));
  for(const form of ['seed','junior','middle','senior','super','water','wood','fire'])for(const layer of ['neutral','mask'])assert.ok(paths.has(`dist/assets/original/gentle-care/${form}-${layer}.webp`));
  for(const form of ['junior','middle','senior','super','water','wood','fire'])for(const layer of ['neutral','mask'])assert.ok(paths.has(`dist/assets/original/affection/${form}-${layer}.webp`));
  assert.ok(![...paths].some(p=>p.includes('/node_modules/sharp/')||p.endsWith('.node-test.cjs')),'Build tools and tests must stay out of the installed app');
  for(const retired of['electron/deepseek.cjs','electron/speech.cjs'])assert.ok(!paths.has(retired),'Retired conversation backend must not be packaged');
  const metadata=JSON.parse(asar.extractFile(archive,'package.json'));
  assert.equal(metadata.version,version);console.log('PASS: complete original pet/outfit payload; retired AI and speech backends absent');
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'mole-package-'));fs.writeFileSync(path.join(profile,'companion-ai-key.json'),'retired-test-key');
  desktop=await _electron.launch({executablePath:executable,args:[`--user-data-dir=${profile}`],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},cwd:root,timeout:30000});
  const runtime=await desktop.evaluate(()=>({electron:process.versions.electron,node:process.versions.node,chrome:process.versions.chrome,platform:process.platform,arch:process.arch}));
  assert.ok(require('semver').satisfies(runtime.electron,metadata.windowsEdition==='legacy'?require('../electron/windows-runtime.cjs').LEGACY_ELECTRON_VERSION:require('../package.json').devDependencies.electron),'Packaged application must run its declared modern or legacy Electron');
  console.log('PASS packaged runtime '+JSON.stringify(runtime));
  child=desktop.process();for(const stream of[child.stdout,child.stderr])stream?.on('data',chunk=>{mainOutput=(mainOutput+chunk.toString()).slice(-20000)});
  page=await desktop.firstWindow({timeout:30000});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.waitForLoadState('domcontentloaded');await page.waitForFunction(()=>window.desktop?.isElectron===true,undefined,{polling:100,timeout:30000});await verifyRendererPolicy(page);
  assert.ok(!fs.existsSync(path.join(profile,'companion-ai-key.json')));assert.equal(await page.evaluate(()=>typeof window.companionAI+':'+typeof window.companionSpeech),'undefined:undefined');assert.equal(await desktop.evaluate(({app})=>app.getName()),metadata.windowsEdition==='legacy'?'拉姆兼容版':'拉姆');
  if(process.platform==='darwin'){
   assert.equal(await desktop.evaluate(({app})=>app.dock.isVisible()),false);
   const tray=await desktop.evaluate(({app,nativeImage})=>{const load=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),{createTrayIcon}=load('./electron/tray-icon.cjs');const icon=createTrayIcon(nativeImage,process.platform,name=>app.getAppPath()+'/dist/icons/'+name);return{template:icon.isTemplateImage(),size:icon.getSize(),scales:icon.getScaleFactors()}});assert.equal(tray.template,true);assert.equal(tray.size.width,18);assert.ok(tray.scales.includes(1)&&tray.scales.includes(2));console.log('PASS: macOS menu-bar icon uses native template tint and 18pt/Retina representations');
  }
  await adopt(page,'蓝色','小叶');await verifyCompactCare(page,desktop);await verifyElasticCare(page,desktop);await verifyLivelyCompanion(page);await verifyV28(page,desktop);await verifyUpdateSurface(page,desktop);await verifyWindowsChrome(page,desktop);await verifyTransparentHover(page,desktop);await require('./workflow-checks.cjs').verifyWorkflow(page);await require('./fixes-checks.cjs').verifyFixes(page,desktop);await require('./mac-update-live-check.cjs').verifyMacUpdateNetwork(desktop);assert.deepEqual(errors,[]);
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(false);await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  await openActions(page);await page.getByTestId('pet-actions').getByRole('button',{name:'状态',exact:true}).click();await page.waitForTimeout(220);await page.screenshot({path:path.join(root,'artifacts',screenshot),omitBackground:true});await page.getByRole('button',{name:'关闭小窗',exact:true}).click();console.log(`PASS: packaged ${process.platform}/${process.arch} compact desktop, native cursor and four-edge interaction, tray lifecycle and no conversation services`);
 }catch(error){primaryError=error;console.error('Packaged application failed:',error,'\nMain process output:',mainOutput);if(desktop)try{console.error('Electron startup state:',await Promise.race([desktop.evaluate(({app,BrowserWindow})=>({electron:process.versions.electron,arch:process.arch,ready:app.isReady(),gpuFlags:['disable-gpu','disable-gpu-sandbox','disable-software-rasterizer'].filter(flag=>app.commandLine.hasSwitch(flag)),windows:BrowserWindow.getAllWindows().map(w=>({id:w.id,visible:w.isVisible(),url:w.webContents.getURL(),loading:w.webContents.isLoadingMainFrame()}))})),new Promise(resolve=>setTimeout(()=>resolve('Diagnostic timed out'),3000))]))}catch(stateError){console.error('Startup state unavailable:',stateError.message)}if(child&&process.platform==='win32')try{console.error('Native startup windows:',require('./windows-startup-diagnostics.cjs').windowsStartupDiagnostics(child.pid))}catch(diagnosticError){console.error('Native diagnostic unavailable:',diagnosticError.message)}if(page&&!page.isClosed()){console.error('Renderer diagnostics:',await page.evaluate(()=>({url:location.href,ready:document.readyState,hidden:document.hidden,desktop:typeof window.desktop,canvases:[...document.querySelectorAll('canvas')].map(c=>({class:c.className,...c.dataset,rect:c.getBoundingClientRect().toJSON()})),body:document.body.innerText.slice(0,1800)})).catch(()=>null));await page.screenshot({path:path.join(root,'artifacts',screenshot)}).catch(()=>{});}throw error}
 finally{
  if(desktop&&child?.exitCode===null&&child?.signalCode===null){try{await Promise.all([desktop.waitForEvent('close',{timeout:10000}),desktop.evaluate(({app})=>app.quit())])}catch(error){child.kill();if(!primaryError)throw error;console.error('Cleanup after failed application:',error.message)}}
  if(profile)try{await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:15,retryDelay:250})}catch(error){if(!primaryError)throw error;console.error('Temporary profile cleanup:',error.message)}
 }
}
module.exports={verifyApplication,requireFile};

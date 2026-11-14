/** Run the shipped-app UI gates locally before paying for native packaging. */
const path=require('node:path'),fs=require('node:fs'),{_electron}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/current-desktop-smoke');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const app=await _electron.launch({args:[root,'--no-sandbox','--disable-gpu','--user-data-dir='+path.join(out,'qa-profile')],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'}});
 try{
  const page=await app.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>console.error('Renderer error:',error.message));
  if(await page.locator('#pet-name').count()||await page.getByRole('button',{name:'给它起名',exact:true}).count())await require('./smoke-helpers.cjs').adopt(page,'蓝色','本地发版检查');
  if(!await page.getByTestId('desktop-character').count())await page.evaluate(()=>window.desktop.setPetMode(true));
  for(const [file,method]of [['native-appearance-cache-checks','verifyNativeAppearanceCache'],['compact-care-checks','verifyCompactCare'],['room-pocket-checks','verifyRoomPocket'],['elastic-care-checks','verifyElasticCare'],['lively-companion-checks','verifyLivelyCompanion'],['v28-companion-checks','verifyV28'],['update-surface-checks','verifyUpdateSurface'],['transparent-hover-checks','verifyTransparentHover'],['workflow-checks','verifyWorkflow'],['fixes-checks','verifyFixes'],['v32-native-checks','verifyV32Native'],['uploaded-motion-checks','verifyUploadedMotion']]){
   if(method==='verifyUploadedMotion'&&process.argv.length===2)continue;
   if(process.argv.length>2&&!process.argv.slice(2).includes(method))continue;
   console.log('BEGIN:',method);await require('./'+file+'.cjs')[method](page,app);console.log('PASS:',method);
  }
 }finally{await app.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});

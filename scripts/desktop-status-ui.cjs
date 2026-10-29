const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const{chromium,_electron}=require('@playwright/test');
const{adopt}=require('./smoke-helpers.cjs');
const{verifyDesktopStatus}=require('./desktop-status-checks.cjs');
const root=path.resolve(__dirname,'..');let browser,desktop,server,profile;
async function main(){
 const index=process.argv.indexOf('--packaged'),exe=index<0?null:path.resolve(process.argv[index+1]);
 if(exe){
  profile=fs.mkdtempSync(path.join(os.tmpdir(),'mole-status-ui-'));
  for(const scale of[1,1.25,1.5]){
   desktop=await _electron.launch({executablePath:exe,args:[`--user-data-dir=${path.join(profile,String(scale))}`,...(scale===1?[]:[`--force-device-scale-factor=${scale}`])],env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},timeout:30000});
   const page=await desktop.firstWindow();page.setDefaultTimeout(20000);await page.waitForFunction(()=>window.desktop?.isElectron);await adopt(page,'红色','小红');
   await verifyDesktopStatus(page,desktop,{label:'native-'+scale});await desktop.close();desktop=null;
  }
 }else{
  const url='http://127.0.0.1:5241';server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','5241','--strictPort'],{cwd:root,stdio:'ignore'});
  for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
  for(const scale of[1,2]){const page=await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:scale});page.setDefaultTimeout(20000);await page.goto(url);await adopt(page,'红色','小红');await verifyDesktopStatus(page,null,{label:'browser-'+scale});await page.close()}
 }
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await desktop?.close().catch(()=>{});await browser?.close();server?.kill();if(profile)await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:250})});

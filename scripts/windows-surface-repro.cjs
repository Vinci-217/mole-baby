const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {_electron,expect}=require('@playwright/test');
const sharp=require('sharp');
const {adopt,enterHome,toDesktop}=require('./smoke-helpers.cjs');
const {reloadWithStorage}=require('./smoke-storage.cjs');
const root=path.resolve(__dirname,'..'),probe=path.join(__dirname,'windows-screen-probe.ps1');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const background=[18,36,54];
async function form(mode,dir,coordinates={}){
  const ready=path.join(dir,mode+'-'+Date.now()+'.ready');
  const args=['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',probe,'-Mode',mode,'-Ready',ready];
  for(const [key,value]of Object.entries(coordinates))args.push('-'+key,String(value));
  const child=spawn('powershell.exe',args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
  for(let i=0;i<200&&!fs.existsSync(ready)&&child.exitCode===null;i++)await pause(100);
  assert.ok(fs.existsSync(ready),'Real Windows surface probe failed: '+output);
  return child;
}
async function capture(desktop,page,out,name){
  const {handle,pids}=await desktop.evaluate(({BrowserWindow,app})=>{
    const h=BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
    return{handle:h.length===8?h.readBigUInt64LE().toString():String(h.readUInt32LE()),pids:app.getAppMetrics().map(m=>m.pid)};
  });
  const file=path.join(out,name+'.png');
  const result=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',probe,'-Mode','Capture','-Output',file,'-Handle',handle,'-OwnedIds',pids.join(',')],{encoding:'utf8',timeout:30000,windowsHide:true}).replace(/^\uFEFF/,''));
  const renderer=await page.screenshot({path:path.join(out,name+'-renderer.png'),omitBackground:true});
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const [left,top,width,height]=result.window;
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(renderer).resize(width,height).ensureAlpha().raw().toBuffer();
  // This compares physical desktop pixels with renderer transparency. capturePage
  // alone cannot detect a native white strip or stale DWM surface outside the DOM.
  let longest=0,white=0,bodyRed=0;
  const topLimit=Math.min(height,Math.floor(58*height/viewport.height));
  for(let y=0;y<height;y++){
    let run=0;
    for(let x=0;x<width;x++){
      const sx=left-result.screen[0]+x,sy=top-result.screen[1]+y;
      if(sx<0||sy<0||sx>=info.width||sy>=info.height)continue;
      const k=(sy*info.width+sx)*3,a=(y*width+x)*4;
      const rgb=[data[k],data[k+1],data[k+2]];
      if(y<topLimit&&alpha[a+3]<5&&Math.min(...rgb)>175&&Math.max(...rgb)-Math.min(...rgb)<50){white++;run++;longest=Math.max(longest,run)}else run=0;
      if(y>=topLimit&&rgb[0]>150&&rgb[0]>rgb[1]*1.5&&rgb[0]>rgb[2]*1.5)bodyRed++;
    }
  }
  assert.ok(bodyRed>20,'Physical screenshot must include the actual visible red pet');
  const sample=(Math.min(80,info.height-1)*info.width+Math.min(80,info.width-1))*3;
  assert.ok(background.every((v,i)=>Math.abs(data[sample+i]-v)<=2),'Physical desktop capture must show the controlled backdrop');
  return{name,...result,viewport,longestWhiteRun:longest,whitePixels:white,bodyRed};
}
async function main(){
  assert.equal(process.platform,'win32','This reproduction requires an actual Windows display');
  const exe=path.resolve(process.argv[2]);assert.ok(fs.existsSync(exe));
  const edition=process.argv[3]??'modern',scales=[1,1.25,1.5];
  const out=path.join(root,'artifacts/windows-surface-'+edition);fs.mkdirSync(out,{recursive:true});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-surface-'));const backdrop=await form('Backdrop',dir);const reports=[];
  let desktop,bar;
  try{
    for(const scale of scales){
      desktop=await _electron.launch({executablePath:exe,args:[`--user-data-dir=${path.join(dir,'profile-'+scale)}`,`--force-device-scale-factor=${scale}`],env:{...process.env,MOLE_BABY_DISABLE_UPDATES:'1',ELECTRON_DEV:'0'},timeout:30000});
      const page=await desktop.firstWindow();page.setDefaultTimeout(20000);await page.waitForFunction(()=>window.desktop?.isElectron);
      await adopt(page,'红色','小红');
      const state=await page.evaluate(()=>{const entries=Object.fromEntries(Object.entries(localStorage)),p=JSON.parse(entries['ramu-house-save-v1']);p.growth=60;p.growthLocked=true;delete p.evolution;p.sleeping=false;p.stats={hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95};p.lastTick=Date.now();entries['ramu-house-save-v1']=JSON.stringify(p);entries['ramu-house-preferences-v2']=JSON.stringify({quiet:true,lively:false,presence:false,sound:false});return entries});
      await reloadWithStorage(page,state);await expect(page.getByTestId('desktop-character')).toBeVisible();
      await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
      const location=await desktop.evaluate(({BrowserWindow,screen})=>({bounds:BrowserWindow.getAllWindows()[0].getBounds(),area:screen.getPrimaryDisplay().workArea}));
      await page.evaluate(async p=>window.desktop.movePet(p.area.x+Math.round(p.area.width/2)-p.bounds.x,p.area.y+Math.round(p.area.height/2)-p.bounds.y),location);
      await page.waitForTimeout(7000);
      const initial=await capture(desktop,page,out,`scale-${scale}-initial`);reports.push({scale,kind:'initial',...initial});
      // A separate native HWND deliberately injects a white strip invisible to
      // renderer captures. Verify our detector sees it before trusting a clean run.
      bar=await form('Bar',dir,{Left:initial.window[0]+8,Top:initial.window[1]+8,Width:80,Height:4});
      const calibration=await capture(desktop,page,out,`scale-${scale}-probe`);
      assert.ok(calibration.longestWhiteRun>=60,'Detector must catch a real native strip not painted by React');bar.kill();bar=null;await pause(300);
      for(let cycle=0;cycle<2;cycle++){
        await enterHome(page);await page.waitForTimeout(500);
        if(cycle===1){await page.evaluate(()=>window.desktop.setRoomFullscreen(true));await page.evaluate(()=>window.desktop.setRoomFullscreen(false))}
        await toDesktop(page);await page.waitForTimeout(1000);
        const started=Date.now();
        for(let point=0;point<6;point++){
          if(point)await pause(15000);
          if(cycle===1&&point)await page.evaluate(delta=>window.desktop.movePet(delta,0),point%2?18:-18);
          const row={scale,kind:'return',cycle,elapsed:Date.now()-started,...await capture(desktop,page,out,`scale-${scale}-cycle-${cycle}-${point}`)};reports.push(row);
          console.log(JSON.stringify(row));
          fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(reports,null,2)+'\n');
        }
      }
      await desktop.close();desktop=null;
    }
    assert.ok(reports.every(r=>r.longestWhiteRun<12),'Native white strip reproduced; inspect physical captures and measurements');
    console.log('PASS physical Windows surface: 100/125/150% Chromium scales, normal/fullscreen room returns, timed captures and movement; native-strip detector calibrated with a separate HWND');
  }finally{bar?.kill();await desktop?.close().catch(()=>{});backdrop.kill();fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:250})}
}
main().catch(error=>{console.error(error);process.exitCode=1});

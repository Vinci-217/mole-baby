const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {_electron,expect}=require('@playwright/test');
const sharp=require('sharp');
const {adopt,enterHome,toDesktop}=require('./smoke-helpers.cjs');
const {reloadWithStorage}=require('./smoke-storage.cjs');
const root=path.resolve(__dirname,'..'),probe=path.join(__dirname,'windows-screen-probe.ps1');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rendererMasks=new Map();
const blackSurface=process.env.MOLE_TEST_BLACK_SURFACE==='1';
const baseline=process.argv.includes('--baseline');
async function form(mode,dir,coordinates={}){
  const ready=path.join(dir,mode+'-'+Date.now()+'.ready');
  const args=['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',probe,'-Mode',mode,'-Ready',ready];
  for(const [key,value]of Object.entries(coordinates))args.push('-'+key,String(value));
  const child=spawn('powershell.exe',args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
  for(let i=0;i<200&&!fs.existsSync(ready)&&child.exitCode===null;i++)await pause(100);
  assert.ok(fs.existsSync(ready),'Real Windows surface probe failed: '+output);
  child.readyFile=ready;
  return child;
}
async function capture(desktop,page,out,name,{rendererSnapshot=true}={}){
  const {handle,pids}=await desktop.evaluate(({BrowserWindow,app})=>{
    const h=BrowserWindow.getAllWindows()[0].getNativeWindowHandle();
    return{handle:h.length===8?h.readBigUInt64LE().toString():String(h.readUInt32LE()),pids:app.getAppMetrics().map(m=>m.pid)};
  });
  const file=path.join(out,name+'.png');
  const result=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',probe,'-Mode','Capture','-Output',file,'-Handle',handle,'-OwnedIds',pids.join(',')],{encoding:'utf8',timeout:30000,windowsHide:true}).replace(/^\uFEFF/,''));
  const viewport=await page.evaluate(()=>{const r=document.querySelector('[data-testid="desktop-character"]')?.getBoundingClientRect();return{width:innerWidth,height:innerHeight,character:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null}});
  const [left,top,width,height]=result.window;
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const background=await sharp(path.join(out,'background-desktop.png')).removeAlpha().raw().toBuffer();
  const maskKey=width+'x'+height;
  if(rendererSnapshot||rendererMasks.size===0){
    const renderer=await page.screenshot({path:path.join(out,name+'-renderer.png'),omitBackground:true});
    rendererMasks.set(maskKey,{data:await sharp(renderer).resize(width,height).ensureAlpha().raw().toBuffer(),width,height});
  }else if(!rendererMasks.has(maskKey)){
    // A growing native window is itself part of the regression. Do not let a
    // new size trigger capturePage and repaint away the residue being observed.
    const previous=rendererMasks.values().next().value;
    rendererMasks.set(maskKey,{data:await sharp(previous.data,{raw:{width:previous.width,height:previous.height,channels:4}}).resize(width,height).raw().toBuffer(),width,height});
  }
  const alpha=rendererMasks.get(maskKey).data;
  // This compares physical desktop pixels with renderer transparency. capturePage
  // alone cannot detect a native white strip or stale DWM surface outside the DOM.
  let longest=0,white=0,bodyRed=0,black=0,longestBlack=0,transparentSamples=0,backgroundMatches=0;
  const topLimit=Math.min(height,Math.floor(58*height/viewport.height));
  for(let y=0;y<height;y++){
    let run=0,blackRun=0;
    for(let x=0;x<width;x++){
      const sx=left-result.screen[0]+x,sy=top-result.screen[1]+y;
      if(sx<0||sy<0||sx>=info.width||sy>=info.height)continue;
      const k=(sy*info.width+sx)*3,a=(y*width+x)*4;
      const rgb=[data[k],data[k+1],data[k+2]];
      if(y<topLimit&&alpha[a+3]<5&&Math.min(...rgb)>175&&Math.max(...rgb)-Math.min(...rgb)<50&&rgb.some((v,c)=>Math.abs(v-background[k+c])>25)){white++;run++;longest=Math.max(longest,run)}else run=0;
      if(y>=topLimit&&rgb[0]>150&&rgb[0]>rgb[1]*1.5&&rgb[0]>rgb[2]*1.5)bodyRed++;
      const cx=x*viewport.width/width,cy=y*viewport.height/height,r=viewport.character;
      const inArt=r&&cx>=r.x-3&&cx<=r.x+r.width+3&&cy>=r.y-3&&cy<=r.y+r.height+3;
      // The pet animation can change its alpha between the physical capture
      // and the DOM snapshot. Exclude its WHOLE viewport, not a single pose.
      if(blackSurface&&alpha[a+3]<5&&!inArt){
        transparentSamples++;
        const difference=Math.max(...rgb.map((v,c)=>Math.abs(v-background[k+c])));
        if(difference<=20)backgroundMatches++;
        if(Math.max(...rgb)<45&&difference>40){black++;blackRun++;longestBlack=Math.max(longestBlack,blackRun)}else blackRun=0;
      }else blackRun=0;
    }
  }
  const desktopState=await page.evaluate(()=>window.desktop.getState());
  const nativeState=await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return{bounds:w.getBounds(),focused:w.isFocused(),runtime:process.versions.electron}});
  const measurement={name,...result,viewport,nativeState,desktopState,longestWhiteRun:longest,whitePixels:white,bodyRed,
    ...(blackSurface?{blackPixels:black,longestBlackRun:longestBlack,transparentSamples,backgroundMatchFraction:transparentSamples?backgroundMatches/transparentSamples:null}:{} )};
  console.log('PHYSICAL_CAPTURE '+JSON.stringify(measurement));
  assert.ok(bodyRed>20,'Physical screenshot must include the actual visible red pet');
  return measurement;
}
async function main(){
  assert.equal(process.platform,'win32','This reproduction requires an actual Windows display');
  const exe=path.resolve(process.argv[2]);assert.ok(fs.existsSync(exe));
  const edition=process.argv[3]??'modern',scales=[1,1.25,1.5];
  const out=path.join(root,'artifacts/windows-surface-'+(baseline?'baseline':edition));fs.mkdirSync(out,{recursive:true});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-surface-'));const reports=[];
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',probe,'-Mode','Capture','-Output',path.join(out,'background-desktop.png')],{stdio:'pipe',timeout:30000,windowsHide:true});
  let desktop,bar,work,backdrop,processOutput='';
  const captureBackground=()=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',probe,'-Mode','Capture','-Output',path.join(out,'background-desktop.png')],{stdio:'pipe',timeout:30000,windowsHide:true});
  const changeBackdrop=async mode=>{
    if(desktop)await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());
    backdrop?.kill();backdrop=await form(mode,dir);await pause(250);captureBackground();
    fs.copyFileSync(path.join(out,'background-desktop.png'),path.join(out,mode.toLowerCase()+'.png'));
    if(desktop)await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
  };
  try{
    for(const scale of scales){
      console.log('START_SCALE '+scale);
      if(blackSurface)await changeBackdrop('BackdropLight');
      rendererMasks.clear();
      desktop=await _electron.launch({executablePath:exe,args:[`--user-data-dir=${path.join(dir,'profile-'+scale)}`,...(scale===1?[]:[`--force-device-scale-factor=${scale}`])],env:{...process.env,MOLE_BABY_DISABLE_UPDATES:'1',ELECTRON_DEV:'0'},timeout:30000});
      for(const stream of[desktop.process().stdout,desktop.process().stderr])stream?.on('data',c=>{processOutput=(processOutput+c.toString()).slice(-12000)});
      let page=await desktop.firstWindow();page.setDefaultTimeout(20000);await page.waitForFunction(()=>window.desktop?.isElectron);
      let environment={os:os.release(),baseline,...await desktop.evaluate(({app,screen})=>({runtime:process.versions.electron,displayScale:screen.getPrimaryDisplay().scaleFactor,disableGpuSwitch:app.commandLine.hasSwitch('disable-gpu'),gpuFeatures:app.getGPUFeatureStatus()}))};
      console.log('SURFACE_ENVIRONMENT '+JSON.stringify(environment));
      if(blackSurface&&!baseline)assert.equal(environment.disableGpuSwitch,true,'Both Windows editions must request software mode before startup');
      await adopt(page,'红色','小红');
      const state=await page.evaluate(seed=>{const entries=Object.fromEntries(Object.entries(localStorage)),p=JSON.parse(entries['ramu-house-save-v1']);p.growth=seed?0:60;p.growthLocked=true;delete p.evolution;p.sleeping=false;p.stats={hunger:95,thirst:95,cleanliness:95,happiness:95,health:100,energy:95};p.lastTick=Date.now();entries['ramu-house-save-v1']=JSON.stringify(p);entries['ramu-house-preferences-v2']=JSON.stringify({quiet:true,lively:false,presence:false,sound:false});return entries},blackSurface);
      await reloadWithStorage(page,state);await expect(page.getByTestId('desktop-character')).toBeVisible();
      if(blackSurface){
        // A saved seed must appear correctly on a genuinely cold process,
        // not just after a page reload or after the adoption page paints.
        await desktop.close();desktop=null;
        desktop=await _electron.launch({executablePath:exe,args:[`--user-data-dir=${path.join(dir,'profile-'+scale)}`,...(scale===1?[]:[`--force-device-scale-factor=${scale}`])],env:{...process.env,MOLE_BABY_DISABLE_UPDATES:'1',ELECTRON_DEV:'0'},timeout:30000});
        page=await desktop.firstWindow();page.setDefaultTimeout(20000);await expect(page.getByTestId('desktop-character')).toBeVisible();
        assert.equal(await page.locator('.ram-sprite').first().getAttribute('data-stage'),'0');
      }
      await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
      const location=await desktop.evaluate(({BrowserWindow,screen})=>({bounds:BrowserWindow.getAllWindows()[0].getBounds(),area:screen.getPrimaryDisplay().workArea}));
      await page.evaluate(async p=>window.desktop.movePet(p.area.x+Math.round(p.area.width/2)-p.bounds.x,p.area.y+Math.round(p.area.height/2)-p.bounds.y),location);
      await page.waitForTimeout(7000);
      if(blackSurface)await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].moveTop());
      if(blackSurface){
        environment={os:os.release(),baseline,...await desktop.evaluate(({app,screen})=>({runtime:process.versions.electron,displayScale:screen.getPrimaryDisplay().scaleFactor,disableGpuSwitch:app.commandLine.hasSwitch('disable-gpu'),gpuFeatures:app.getGPUFeatureStatus()}))};
        console.log('WARM_RENDERING_STATE '+JSON.stringify(environment));
        if(!baseline){
          assert.equal(environment.disableGpuSwitch,true,'Cold restart must preserve the software composition policy');
          assert.match(environment.gpuFeatures.gpu_compositing,/^(disabled|unavailable)/,'Native GPU compositing must actually be disabled');
        }
      }
      const initial=await capture(desktop,page,out,`scale-${scale}-initial`);reports.push({scale,kind:'initial',environment,...initial});
      // A separate native HWND deliberately injects a white strip invisible to
      // renderer captures. Verify our detector sees it before trusting a clean run.
      bar=await form('Bar',dir,{Left:initial.window[0]+8,Top:initial.window[1]+8,Width:80,Height:4});
      const calibration=await capture(desktop,page,out,`scale-${scale}-probe`);
      assert.ok(calibration.longestWhiteRun>=60,'Detector must catch a real native strip not painted by React');bar.kill();bar=null;await pause(300);
      if(blackSurface){
        bar=await form('Black',dir,{Left:initial.window[0]+8,Top:initial.window[1]+8,Width:80,Height:12});
        const blackProbe=await capture(desktop,page,out,`scale-${scale}-black-probe`);
        assert.ok(blackProbe.blackPixels>400&&blackProbe.longestBlackRun>=60,'Detector must catch a native black surface outside React');
        bar.kill();bar=null;await pause(300);
      }
      for(let cycle=0;cycle<2;cycle++){
        if(blackSurface&&cycle===1){
          await changeBackdrop('BackdropBlue');
          const entries=await page.evaluate(()=>{const e=Object.fromEntries(Object.entries(localStorage)),p=JSON.parse(e['ramu-house-save-v1']);p.growth=60;e['ramu-house-save-v1']=JSON.stringify(p);return e});
          await reloadWithStorage(page,entries);await expect(page.getByTestId('desktop-character')).toBeVisible();
          await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false)});
        }
        await enterHome(page);await page.waitForTimeout(500);
        if(cycle===1){await page.evaluate(()=>window.desktop.setRoomFullscreen(true));await page.evaluate(()=>window.desktop.setRoomFullscreen(false))}
        await toDesktop(page);await page.waitForTimeout(1000);
        // Only establish the test z-order once before observation. A normal
        // backdrop stays below this app and above the runner console; do not
        // change the user's always-on-top preference or repaint on each shot.
        if(blackSurface)await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].moveTop());
        // Work in a different, non-overlapping native application. A page-only
        // screenshot or window.blur() misses WM_NCACTIVATE and DWM focus damage.
        work=await form('Work',dir,{Left:8,Top:8,Width:200,Height:90});
        await expect.poll(()=>desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFocused())).toBe(false);
        if(cycle===1)await page.evaluate(()=>window.desktop.wander(true));
        const started=Date.now();
        const points=blackSurface?(scale===1.25&&cycle===0?[0,1000,10000,30000,60000]:[0,1000,3000,8000]):scale===1.25&&cycle===0?[0,15000,45000,90000,180000]:[0,15000,30000,45000,60000,75000];
        for(let point=0;point<points.length;point++){
          if(point)await pause(Math.max(0,points[point]-(Date.now()-started)));
          if(cycle===1&&point)await page.evaluate(delta=>window.desktop.movePet(delta,0),point%2?18:-18);
          const row={scale,kind:'return',cycle,elapsed:Date.now()-started,...await capture(desktop,page,out,`scale-${scale}-cycle-${cycle}-${point}`,{rendererSnapshot:point===points.length-1})};reports.push(row);
          console.log(JSON.stringify(row));
          fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(reports,null,2)+'\n');
        }
        await page.evaluate(()=>window.desktop.wander(false));work.kill();work=null;
      }
      await desktop.close();desktop=null;
    }
    if(!baseline)assert.ok(reports.every(r=>r.longestWhiteRun<12),'Native white strip reproduced; inspect physical captures and measurements');
    if(blackSurface){
      const failures=reports.filter(r=>r.blackPixels>Math.max(12,r.transparentSamples*.003));
      const summary={sourceSha:process.env.GITHUB_SHA??null,edition,baseline,measurements:reports.length,blackBackgroundObserved:failures.length>0,maxBlackPixels:Math.max(...reports.map(r=>r.blackPixels)),minBackgroundMatch:Math.min(...reports.map(r=>r.backgroundMatchFraction)),coldSavedSeed:true,lightAndBlueBackdrops:true,calibratedNativeBlack:true,environments:reports.filter(r=>r.kind==='initial').map(r=>({scale:r.scale,...r.environment}))};
      fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
      console.log('BLACK_SURFACE_RESULT '+JSON.stringify(summary));
      assert.ok(reports.every(r=>r.transparentSamples>1000),'Detector must inspect substantial transparent space');
      if(!baseline)assert.equal(failures.length,0,'Black fill appears where the physical desktop must show through');
    }
    assert.ok(reports.every(r=>Math.abs(r.nativeState.bounds.width-160)<=1&&Math.abs(r.nativeState.bounds.height-240)<=1),'Native window dimensions accumulate rounding error during movement; inspect timed bounds');
    console.log('PASS physical Windows surface: 100/125/150% Chromium scales, normal/fullscreen room returns, real focus loss, autonomous walking, stable window size and timed captures; native-strip detector calibrated with a separate HWND');
  }catch(error){
    console.error('Application output before cleanup:',processOutput);
    if(desktop)try{console.error('Native state before cleanup:',await Promise.race([desktop.evaluate(({app,BrowserWindow})=>({ready:app.isReady(),version:process.versions.electron,windows:BrowserWindow.getAllWindows().map(w=>({bounds:w.getBounds(),visible:w.isVisible(),title:w.getTitle(),loading:w.webContents.isLoadingMainFrame(),url:w.webContents.getURL()}))})),pause(3000).then(()=>'state timeout')]))}catch(e){console.error(e.message)}
    throw error;
  }finally{bar?.kill();work?.kill();backdrop?.kill();await desktop?.close().catch(()=>{});fs.rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:250})}
}
main().catch(error=>{console.error(error);process.exitCode=1});

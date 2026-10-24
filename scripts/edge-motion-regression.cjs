const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { _electron } = require('playwright');
const { expect } = require('@playwright/test');
const { adopt, verifyEdgePeek } = require('./smoke-helpers.cjs');

const root = path.resolve(__dirname, '..');
const cloud = '/workspace/.ramu-env';
const profile = path.join(cloud, 'v19-edge-test-config');
const artifacts = path.join(root, 'artifacts');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let desktop, page, virtualDisplay, windowManager;
const env = { ...process.env, ELECTRON_DEV: '0', DISPLAY: ':98', XDG_CONFIG_HOME: profile,
  XDG_CACHE_HOME: path.join(cloud, 'cache'), FONTCONFIG_FILE: path.join(cloud, 'fonts.conf') };

function displayReady() {
  try { execFileSync('xdpyinfo', ['-display', env.DISPLAY], { stdio: 'ignore' }); return true; }
  catch { return false; }
}
function managerReady() {
  try {
    const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const property = execFileSync('xprop', ['-display', env.DISPLAY, '-root', '_NET_SUPPORTING_WM_CHECK'], options);
    const id = property.match(/window id # (0x[1-9a-f][0-9a-f]*)/i)?.[1];
    return Boolean(id && execFileSync('xprop', ['-display', env.DISPLAY, '-id', id, '_NET_SUPPORTING_WM_CHECK'], options).includes(id));
  } catch { return false; }
}
const bounds = () => desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
const state = () => page.evaluate(() => window.desktop.getState());
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ramu-house-save-v1')));
const interactions = () => page.evaluate(() => {
  const pet=JSON.parse(localStorage.getItem('ramu-house-save-v1'));
  const memory=JSON.parse(localStorage.getItem(`ramu-companion-memory-v1:${pet.createdAt}`)||'{"events":[]}');
  return memory.events.filter(event=>['pet','play','game','feed','drink'].includes(event.kind));
});
async function moveTo(point) {
  const current = await bounds();
  await page.evaluate(({ dx, dy }) => window.desktop.movePet(dx, dy), { dx: point.x-current.x, dy: point.y-current.y });
}
async function screenshot(form, side, pose) {
  // A renderer screenshot includes the transparent offscreen padding. Capture
  // the physical display so these artifacts show what the user actually sees.
  const { x, y, width, height } = await bounds();
  const area = await desktop.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds);
  const cropWidth = 360, cropHeight = 360;
  const cropX = Math.round(Math.max(area.x, Math.min(x+width/2-cropWidth/2, area.x+area.width-cropWidth)));
  const cropY = Math.round(Math.max(area.y, Math.min(y+height/2-cropHeight/2, area.y+area.height-cropHeight)));
  execFileSync('import', ['-display', env.DISPLAY, '-window', 'root', '-crop', `${cropWidth}x${cropHeight}+${cropX}+${cropY}`,
    path.join(artifacts, `v19-edge-${form}-${side}-${pose}.png`)], { stdio: 'ignore' });
}
async function fixture(form, growth) {
  await page.evaluate(({ form, growth }) => {
    const pet = JSON.parse(localStorage.getItem('ramu-house-save-v1'));
    pet.growth=growth;pet.color='blue';pet.sleeping=false;pet.lastTick=Date.now();
    pet.stats={hunger:90,thirst:90,cleanliness:90,happiness:85,health:100,energy:90};
    if(growth>=840)pet.evolution=form;else delete pet.evolution;
    localStorage.setItem('ramu-house-save-v1',JSON.stringify(pet));
    const prefs=JSON.parse(localStorage.getItem('ramu-house-preferences-v2')||'{}');
    Object.assign(prefs,{sound:false,quiet:false,presence:false,lively:false});
    localStorage.setItem('ramu-house-preferences-v2',JSON.stringify(prefs));
  },{form,growth});
  await page.reload();
  await expect(page.getByTestId('desktop-character').locator('canvas:not(.ram-wear)[data-loaded=true]')).toBeVisible();
  await page.evaluate(async()=>{await window.desktop.wander(false);await window.desktop.setEdgeHiding(false);});
}
async function bodyBoundary() {
  const area=await desktop.evaluate(({screen})=>screen.getPrimaryDisplay().workArea);
  const midpoint={x:area.x+Math.round((area.width-160)/2),y:area.y+Math.round((area.height-240)/2)};
  for(const [side,point,expected] of [
    ['left',{x:area.x-1000,y:midpoint.y},{x:area.x-30,y:midpoint.y}],
    ['right',{x:area.x+area.width+1000,y:midpoint.y},{x:area.x+area.width-130,y:midpoint.y}],
    ['top',{x:midpoint.x,y:area.y-1000},{x:midpoint.x,y:area.y-71}],
    ['bottom',{x:midpoint.x,y:area.y+area.height+1000},{x:midpoint.x,y:area.y+area.height-179}],
  ]) {
    await moveTo(point);const result=await bounds();
    assert.equal(result.x,expected.x,`${side}: body-aligned horizontal clamp`);
    assert.equal(result.y,expected.y,`${side}: body-aligned vertical clamp`);
    assert.deepEqual({width:result.width,height:result.height},{width:160,height:240});
    const body=await page.getByTestId('desktop-character').boundingBox();
    assert.ok(result.x+body.x>=area.x-.5&&result.x+body.x+body.width<=area.x+area.width+.5);
    assert.ok(result.y+body.y>=area.y-.5&&result.y+body.y+body.height<=area.y+area.height+.5);
    assert.equal((await state()).edgeSide,null,'clamping with edge hiding disabled must stay free');
  }
  await moveTo(midpoint);
  console.log('PASS manual bounds allow transparent margins offscreen while the 100×108 body remains inside all four work-area edges');
}

(async()=>{
  assert.equal(process.platform,'linux','This actual Electron regression uses the isolated Linux cloud display');
  assert.ok(fs.existsSync(path.join(root,'dist/index.html')),'Run npm run build before native regression');
  fs.rmSync(profile,{recursive:true,force:true});fs.mkdirSync(profile,{recursive:true});fs.mkdirSync(artifacts,{recursive:true});
  if(!displayReady()) {
    virtualDisplay=spawn('/usr/lib/xorg/Xorg',[env.DISPLAY,'-config',path.join(cloud,'xorg.conf'),'-logfile',path.join(profile,'xorg.log'),'-noreset','-nolisten','tcp','-novtswitch','-sharevts'],{stdio:'ignore'});
    for(let n=0;n<50&&!displayReady();n++)await pause(100);
    assert.ok(displayReady(),'The cloud display did not become ready');
  }
  if(!managerReady()) {
    windowManager=spawn('dbus-run-session',['--','xfwm4','--compositor=off','--sm-client-disable'],{env,stdio:'ignore',detached:true});
    for(let n=0;n<50&&!managerReady();n++)await pause(100);
    assert.ok(managerReady(),'The cloud window manager did not become ready');
  }
  desktop=await _electron.launch({args:[root,'--no-sandbox','--disable-gpu'],env,cwd:root,timeout:30000});
  page=await desktop.firstWindow();page.setDefaultTimeout(15000);
  const errors=[],failed=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>{
    // Reloading a saved-stage fixture cancels Chromium's streaming BGM probe;
    // a deliberate navigation abort is different from a missing media file.
    if(/\.(?:png|mp3)(?:[?#]|$)/.test(request.url())&&request.failure()?.errorText!=='net::ERR_ABORTED')failed.push({url:request.url(),reason:request.failure()?.errorText});
  });
  await adopt(page,'蓝色','小海');
  const initial=await saved();
  await fixture('seed',0);await bodyBoundary();
  for(const [form,growth] of [['seed',0],['junior',60],['middle',180],['senior',420],['super',840]]) {
    await fixture(form,growth);
    const sprite=page.getByTestId('desktop-character').locator('.ram-sprite');
    if(growth>=420)await expect(sprite).toHaveClass(/is-flying/);
    const before=await saved(),beforeInteractions=await interactions();
    for(const side of ['left','right','top','bottom']) {
      await verifyEdgePeek(page,desktop,side,{onPose:async pose=>{
        if(pose==='tucking') {
          await page.waitForTimeout(400);
          assert.equal((await state()).edgePose,'tucking','entry remains a finite visible action before hiding');
          await expect(sprite).toHaveAttribute('data-action',growth===0||side==='top'||side==='bottom'?'waiting':`walk-${side}`);
          if(growth===0)assert.equal(await sprite.locator('.seed-pot-original').evaluate(n=>getComputedStyle(n).transform),'none','seed entry hops keep the pot upright');
          const moving=await page.locator('.compact-pet').evaluate(n=>{
            const m=new DOMMatrix(getComputedStyle(n).transform);return {x:m.m41,y:m.m42};
          });
          const magnitude=Math.abs(side==='left'||side==='right'?moving.x:moving.y);
          assert.ok(magnitude>0&&magnitude<(side==='left'||side==='right'?82:92),'entry must visibly travel instead of snapping');
        }
        if((form==='seed'||form==='super')&&['tucking','peek','released'].includes(pose))await screenshot(form,side,pose);
        if(growth===0)assert.equal((await state()).wandering,false,'a seed never walks by itself');
        if(growth>=420&&pose!=='hidden')await expect(sprite).toHaveClass(/is-flying/);
      }});
    }
    const after=await saved();
    for(const key of ['name','createdAt','color','coins','inventory','completedGames'])assert.deepEqual(after[key],before[key]);
    assert.ok(Math.abs(after.growth-before.growth)<.1,'docking does not grant fake interaction growth');
    assert.deepEqual(await interactions(),beforeInteractions,'edge clicks and dragging never pretend that the user petted, fed or played');
    console.log(`PASS ${form}: four finite entries, hover/click peeks only, exact physical drag release and preserved pet identity/rewards`);
  }
  const final=await saved();assert.equal(final.createdAt,initial.createdAt);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const sheet=['-background','#ecebe7','-fill','#403a2e','-font','DejaVu-Sans','-pointsize','14'];
  for(const form of ['seed','super'])for(const side of ['left','right','top','bottom'])sheet.push('-label',`${form} - ${side}`,path.join(artifacts,`v19-edge-${form}-${side}-peek.png`));
  sheet.push('-tile','4x2','-geometry','+6+8',path.join(artifacts,'v19-edge-peeks.png'));
  execFileSync('montage',sheet,{stdio:'ignore'});
  console.log('PASS actual production Electron has no renderer errors, broken media or artificial item/currency rewards during edge actions');
})().catch(async error=>{
  console.error(error);process.exitCode=1;
  if(page)await page.screenshot({path:path.join(artifacts,'v19-edge-failure.png'),omitBackground:true}).catch(()=>{});
}).finally(async()=>{
  if(desktop)await desktop.evaluate(({app})=>app.quit()).catch(()=>{});
  if(windowManager){try{process.kill(-windowManager.pid,'SIGTERM');}catch{}}
  if(virtualDisplay)virtualDisplay.kill();
});

/** A retried source is not ready merely because its predecessor was. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,expect}=require('@playwright/test');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium'});let release;
try{const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5173/?preview=size-review&form=super&outfit=warm-scarf');
 const subject=p.locator('[data-review-subject]'),player=subject.locator('.official-ram-clip');await expect(player).toHaveAttribute('data-loaded','true',{timeout:45000});
 let routed=false;const gate=new Promise(r=>release=r);await p.route('**/files/resource/petcloth/swf2/1200052.swf',async r=>{routed=true;await gate;await r.continue().catch(()=>{})});
 await player.dispatchEvent('ram-original-retry');await expect.poll(()=>routed).toBe(true);await p.evaluate(()=>animationSizeReview.select({form:'super',outfit:'warm-scarf',action:'dizzy'}));await p.waitForTimeout(650);
 const waiting=await subject.evaluate(n=>({loaded:n.querySelector('.official-ram-clip').dataset.loaded,elapsed:Number(n.querySelector('[data-motion-elapsed]').dataset.motionElapsed)}));assert.equal(waiting.loaded,'false');assert.equal(waiting.elapsed,0,'a loading retry must not consume visible action time');await expect(subject).toHaveAttribute('data-finished','false');
 release();await expect(player).toHaveAttribute('data-loaded','true',{timeout:45000});await expect.poll(async()=>Number(await subject.locator('[data-motion-elapsed]').getAttribute('data-motion-elapsed'))).toBeGreaterThan(1000);await expect(subject).toHaveAttribute('data-finished','false');await expect(subject).toHaveAttribute('data-finished','true',{timeout:6000});
 await p.unroute('**/files/resource/petcloth/swf2/1200052.swf');
 // A superseded loading outfit must not finish or recolour its replacement.
 let releaseOld,held=false;const old=new Promise(r=>releaseOld=r);await p.route('**/files/resource/petcloth/swf2/1200020.swf',async r=>{held=true;await old;await r.continue().catch(()=>{})});
 await p.evaluate(()=>animationSizeReview.select({form:'super',outfit:'wizard-cap',action:'pet'}));await expect.poll(()=>held).toBe(true);
 await p.evaluate(()=>animationSizeReview.select({form:'super',outfit:'warm-scarf',action:'sleep'}));releaseOld();await expect(player).toHaveAttribute('data-loaded','true',{timeout:45000});await p.waitForTimeout(3500);await expect(subject).toHaveAttribute('data-finished','false');await expect(player).toHaveAttribute('data-source','resource/petcloth/swf2/1200052.swf');
 assert.deepEqual(errors,[]);const out=path.resolve(__dirname,'../artifacts/costume-state-review');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'loading-clock-checks.json'),JSON.stringify({heldLoadingMs:650,waiting,fullVisibleDizziness:true,supersededLoadCannotFinishNewSleep:true,errors},null,2));console.log('PASS retry readiness, full visible clock and superseded outfit cancellation');
}finally{release?.();await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

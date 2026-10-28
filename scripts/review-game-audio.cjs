const {chromium}=require('@playwright/test'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage();await page.goto(process.env.REVIEW_URL||'http://127.0.0.1:5230');
  const result=await page.evaluate(async()=>{
   const {GAME_SOUND_FILES,gameSoundUrl}=await import('/src/game-audio.ts');
   const {configurePetSound,playGameSound,stopGameSounds}=await import('/src/pet-audio.ts');
   const audio=new OfflineAudioContext(1,1,48000),files=[...new Set(Object.values(GAME_SOUND_FILES))],stats=[];
   for(const file of files){
    const response=await fetch(`./assets/original/game-audio/${file}.mp3`);if(!response.ok)throw Error('Missing original audio '+file);
    const buffer=await audio.decodeAudioData(await response.arrayBuffer()),data=buffer.getChannelData(0);let energy=0,peak=0;
    for(const value of data){energy+=value*value;peak=Math.max(peak,Math.abs(value))}
    stats.push({file,duration:buffer.duration,rms:Math.sqrt(energy/data.length),peak});
   }
   const BaseAudio=window.Audio,BaseContext=window.AudioContext,voices=[];let oscillators=0;
   window.Audio=class extends BaseAudio{constructor(...args){super(...args);voices.push(this)}};
   window.AudioContext=class extends BaseContext{createOscillator(){oscillators++;return super.createOscillator()}};
   configurePetSound({enabled:false,volume:.5});playGameSound('start',true);const mutedBefore=voices.length;
   configurePetSound({enabled:true,volume:.5});playGameSound('start',true);await new Promise(resolve=>setTimeout(resolve,200));
   const live=voices.map(a=>({source:a.src,playing:!a.paused,volume:a.volume}));
   configurePetSound({enabled:false,volume:.5});const stopped=voices.every(a=>a.paused);stopGameSounds();
   window.Audio=BaseAudio;window.AudioContext=BaseContext;
   return{stats,events:Object.keys(GAME_SOUND_FILES).length,uniqueFiles:files.length,mutedBefore,live,stopped,oscillators,startUrl:gameSoundUrl('start')};
  });
  assert.equal(result.mutedBefore,0);assert.equal(result.oscillators,0);assert.equal(result.stopped,true);assert.equal(result.uniqueFiles,12);assert.equal(result.events,15);
  assert.equal(result.live.length,1);assert.ok(result.live[0].source.endsWith('/original/game-audio/start.mp3'));assert.equal(result.live[0].playing,true);assert.equal(result.live[0].volume,.5);
  for(const sample of result.stats)assert.ok(sample.duration>0&&sample.rms>.0001&&Number.isFinite(sample.peak),sample.file);
  const out=path.resolve(__dirname,'../artifacts/original-game-audio');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(result,null,2)+'\n');
  console.log('PASS 12 original game recordings / 15 event mappings, decoded non-silent streams, zero synthesized oscillators, muted before playback and stopped immediately in flight');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

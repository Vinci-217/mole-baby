/** Launch the actual app on the mounted preview disk with an isolated profile. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const http=require('node:http');
const {setTimeout:delay}=require('node:timers/promises');

async function waitFor(check,message,timeout=40000){
 const started=Date.now();
 while(Date.now()-started<timeout){
  try{const result=await check();if(result)return result}catch{}
  await delay(150);
 }
 throw Error(message);
}
async function freePort(){
 const server=http.createServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const {port}=server.address();
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 return port;
}
async function connect(url){
 const socket=new WebSocket(url);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;
 return {
  close:()=>socket.close(),
  evaluate(expression){
   return new Promise((resolve,reject)=>{
    const id=++sequence;
    const finish=(event)=>{
     const reply=JSON.parse(event.data);
     if(reply.id!==id)return;
     clearTimeout(timer);socket.removeEventListener('message',finish);
     if(reply.error||reply.result?.exceptionDetails)reject(Error('Renderer evaluation failed'));
     else resolve(reply.result.result.value);
    };
    const timer=setTimeout(()=>{socket.removeEventListener('message',finish);reject(Error('Renderer request timed out'));},4000);
    socket.addEventListener('message',finish);
    socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));
   });
  },
 };
}
async function main(){
 assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
 const [executable,profile,source]=process.argv.slice(2),port=await freePort();
 const child=spawn(executable,[`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`],{
  env:{...process.env,ELECTRON_DEV:'0',MOLE_BABY_DISABLE_UPDATES:'1'},stdio:['ignore','ignore','pipe'],
 });
 let diagnostics='',actor;
 child.stderr.on('data',chunk=>diagnostics=(diagnostics+chunk).slice(-4500));
 try{
  const page=await waitFor(async()=>{
   const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
   return pages.find(target=>target.type==='page'&&target.url.endsWith('/dist/index.html'));
  },'The mounted app did not load its renderer');
  actor=await connect(page.webSocketDebuggerUrl);
  const adoption="Boolean(window.desktop?.isElectron&&window.desktop.platform==='darwin'&&document.querySelector('.adoption-screen'))";
  await waitFor(()=>actor.evaluate(adoption),'The mounted app did not reach the adoption screen');
  const now=Date.now();
  const pet={version:1,name:'Mac 自测',color:'blue',createdAt:now-720000,lastTick:now,growth:840,naturalGrowth:840,
    highestGrowth:840,evolution:'super',growthLocked:true,stats:{hunger:92,thirst:96,cleanliness:94,health:99,energy:95,happiness:95},
    inventory:{biscuit:2},coins:1000,sleeping:false,completedGames:0,lastRewardAt:0};
  const prefs={lively:false,roomWander:false,presence:false,sound:false,outings:false};
  await actor.evaluate(`localStorage.setItem('ramu-house-save-v1',${JSON.stringify(JSON.stringify(pet))});
   localStorage.setItem('ramu-house-preferences-v2',${JSON.stringify(JSON.stringify(prefs))});
   setTimeout(()=>location.reload(),50);true`);
  await waitFor(()=>actor.evaluate("Boolean(document.querySelector('[data-testid=desktop-character] canvas[data-loaded=true]'))"),
   'The native desktop pet did not paint');
  const state=await actor.evaluate('window.desktop.getState()');
  assert.equal(state.petMode,true);
  await actor.evaluate('window.desktop.setPetMode(false)');
  await waitFor(()=>actor.evaluate("Boolean(document.querySelector('.cottage-scene .scene-character canvas[data-loaded=true]'))"),
   'The native room pet did not paint');
  console.log(`PASS launched and painted the desktop pet and room from the ${source} (arm64)`);
 }catch(error){
  if(diagnostics)console.error(diagnostics);
  throw error;
 }finally{
  actor?.close();
  if(child.exitCode===null&&child.signalCode===null){
   child.kill('SIGTERM');
   await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)]);
   if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  }
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

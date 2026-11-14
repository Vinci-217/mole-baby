/** Compare identical original atlas pixels in the same browser; no quality reduction. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/original-tools-review');
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/share/ms-playwright/chromium-1223/chrome-linux64/chrome'});
 try{
  // Only this isolated benchmark context permits its injected comparison
  // function. The application's shipping CSP is never modified.
  const page=await browser.newPage({bypassCSP:true});await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:5173/');
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/atlas-tint.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('export async function tintAtlas','async function tintAtlas');
  await page.addScriptTag({content:code+'\nwindow.qaTintAtlas=tintAtlas;'});
  const spec=require('../public/assets/original/uploaded-actions/index.json')['junior-tuya1'];
  const table=require('../public/assets/original/uploaded-actions/'+spec.assetKey+'/clip.json');
  const report=await page.evaluate(async({assetKey,source})=>{
   const read=async name=>{const image=new Image();image.src='./assets/original/uploaded-actions/'+assetKey+'/'+name;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);return c.getImageData(0,0,canvas.width,canvas.height).data};
   const[pixels,mask]=await Promise.all([read(source.neutral),read(source.mask)]),offsets=[-240,-75,0];
   const yieldInput=async()=>{if(globalThis.scheduler?.yield)return scheduler.yield();await new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve()};c.port2.postMessage(null)})};
   const former=async pixels=>{
    const clamp=n=>Math.max(0,Math.min(255,n)),deltas=[255,204,153].map(base=>offsets.map(offset=>clamp(base+offset)-base));let began=performance.now();
    for(let start=0;start<pixels.length;start+=65536){const end=Math.min(pixels.length,start+65536);for(let i=start;i<end;i+=4){pixels[i+3]=mask[i+3];const white=mask[i]/255,gray=mask[i+1]/255,dark=mask[i+2]/255;if(!(white||gray||dark))continue;for(let c=0;c<3;c++)pixels[i+c]=clamp(pixels[i+c]+deltas[0][c]*white+deltas[1][c]*gray+deltas[2][c]*dark)}if(performance.now()-began>=4){await yieldInput();began=performance.now()}}
   };
   const before=[],after=[];
   for(let index=0;index<5;index++){
    const a=pixels.slice(),b=pixels.slice();let began=performance.now();await former(a);before.push(performance.now()-began);began=performance.now();await window.qaTintAtlas(b,mask,offsets,true);after.push(performance.now()-began);
    if(a.some((value,index)=>value!==b[index]))throw Error('Optimized tint changed an original pixel');
   }
   const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
   return {atlas:[source.width,source.height],originalFormulaMs:before,lookupFormulaMs:after,originalMedianMs:median(before),lookupMedianMs:median(after),byteIdentical:true};
  },{assetKey:spec.assetKey,source:table.pages[0]});
  assert(report.byteIdentical);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'tint-performance.json'),JSON.stringify({checkedAt:new Date().toISOString(),...report},null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});

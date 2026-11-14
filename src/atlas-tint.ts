/** Keep the original pixels and colour formula, but yield during large atlas
 * recolours so input and the loading/transition animation can still paint. */
async function yieldToInput(){
 const scheduler=(globalThis as typeof globalThis&{scheduler?:{yield?:()=>Promise<void>}}).scheduler;
 if(scheduler?.yield)return scheduler.yield();
 // Nested setTimeout(0) is clamped by browsers. A message task yields to
 // input/painting without adding that delay to every slice of a large atlas.
 if(typeof window!=='undefined'&&typeof MessageChannel!=='undefined')return new Promise<void>(resolve=>{
  const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve()};channel.port2.postMessage(null);
 });
 await new Promise<void>(resolve=>setTimeout(resolve,0));
}
export async function tintAtlas(pixels:Uint8ClampedArray,mask:Uint8ClampedArray,offsets:readonly number[],replaceAlpha=false){
 const clamp=(n:number)=>Math.max(0,Math.min(255,n));
 const deltas=[255,204,153].map(base=>offsets.map(offset=>clamp(base+offset)-base));
 // Masks have only 256 possible channel values. Keep the original operation
 // order, but calculate each weighted colour delta once instead of per pixel.
 const weights=deltas.map(row=>row.map(delta=>Float64Array.from({length:256},(_,value)=>delta*(value/255))));
 const [white,gray,dark]=weights;
 let began=performance.now();
 for(let start=0;start<pixels.length;start+=65536){
  const end=Math.min(pixels.length,start+65536);
  for(let i=start;i<end;i+=4){
   if(replaceAlpha)pixels[i+3]=mask[i+3];
   const w=mask[i],g=mask[i+1],d=mask[i+2];
   if(!(w||g||d))continue;
   // Uint8ClampedArray applies exactly the same final range/rounding clamp.
   pixels[i]=pixels[i]+white[0][w]+gray[0][g]+dark[0][d];
   pixels[i+1]=pixels[i+1]+white[1][w]+gray[1][g]+dark[1][d];
   pixels[i+2]=pixels[i+2]+white[2][w]+gray[2][g]+dark[2][d];
  }
  if(performance.now()-began>=4){await yieldToInput();began=performance.now()}
 }
}

/** Keep the original pixels and colour formula, but yield during large atlas
 * recolours so input and the loading/transition animation can still paint. */
export async function tintAtlas(pixels:Uint8ClampedArray,mask:Uint8ClampedArray,offsets:readonly number[],replaceAlpha=false){
 const clamp=(n:number)=>Math.max(0,Math.min(255,n));
 const deltas=[255,204,153].map(base=>offsets.map(offset=>clamp(base+offset)-base));
 let began=performance.now();
 for(let start=0;start<pixels.length;start+=65536){
  const end=Math.min(pixels.length,start+65536);
  for(let i=start;i<end;i+=4){
   if(replaceAlpha)pixels[i+3]=mask[i+3];
   const white=mask[i]/255,gray=mask[i+1]/255,dark=mask[i+2]/255;
   if(!(white||gray||dark))continue;
   for(let c=0;c<3;c++)pixels[i+c]=clamp(pixels[i+c]+deltas[0][c]*white+deltas[1][c]*gray+deltas[2][c]*dark);
  }
  if(performance.now()-began>=4){await new Promise<void>(resolve=>setTimeout(resolve,0));began=performance.now()}
 }
}

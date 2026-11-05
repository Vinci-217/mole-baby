/** Runs in the browser. Measure real mask/garment pixels through their rendered
 * canvas rectangles, independently of the renderer's declared contact gap. */
module.exports=async function wardrobeContactMetrics(){
 const hats=['party-cap','gold-feather','wizard-cap','warm-scarf','flower-crown','leaf-hood','sport-goggles'];
 const cache=window.__wardrobeContactCache??=( {masks:new Map(),bodies:new Map(),wear:new WeakMap()} );
 const result=[];
 for(const wear of document.querySelectorAll('.wardrobe-motion-grid .ram-wear')){
  if(!hats.includes(wear.dataset.outfit))continue;
  const body=wear.parentElement.querySelector('canvas:not(.ram-wear)'),kind=body.dataset.sheet??'classic',form=body.dataset.form;
  const cell=Number(body.dataset.frame),column=kind==='flight'?cell%8:cell,row=Number(body.dataset.row??0),key=`${form}:${kind}:${row}:${column}`;
  if(getComputedStyle(wear).objectFit!=='fill'||getComputedStyle(body).objectFit!=='fill')throw Error('Registered canvas coordinates must not be letterboxed');
  let contour=cache.bodies.get(key);
  if(!contour){
   const base=`/assets/${kind==='classic'?'classic':`original/${kind}`}/${form}-mask`;
   if(!cache.masks.has(base))cache.masks.set(base,new Promise((resolve,reject)=>{const image=new Image();const canvas=document.createElement('canvas');const load=(url,second=false)=>{image.onload=()=>{canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);resolve(ctx.getImageData(0,0,image.width,image.height))};image.onerror=()=>second?reject(new Error(`Mask unavailable: ${base}`)):load(`${base}.png`,true);image.src=url};load(`${base}.webp`)}));
   const mask=await cache.masks.get(base),tops=Array(192).fill(null);let left=192,right=0;
   for(let x=0;x<192;x++)for(let y=0;y<208;y++){
    const i=((row*208+y)*mask.width+column*192+x)*4;
    if(mask.data[i+3]>120&&mask.data[i]+mask.data[i+1]+mask.data[i+2]>90){tops[x]=y;left=Math.min(left,x);right=Math.max(right,x);break}
   }
   contour={tops,left,right};cache.bodies.set(key,contour);
  }
  let cloth=cache.wear.get(wear);
  if(!cloth||cloth.key!==wear.dataset.paint){
   const pixels=wear.getContext('2d').getImageData(0,0,wear.width,wear.height).data,bottom=Array(wear.width).fill(null);
   for(let x=0;x<wear.width;x++)for(let y=wear.height-1;y>=0;y--)if(pixels[(y*wear.width+x)*4+3]>120){bottom[x]=y;break}
   cloth={key:wear.dataset.paint,bottom};cache.wear.set(wear,cloth);
  }
  const b=body.getBoundingClientRect(),w=wear.getBoundingClientRect(),gaps=[],center=(contour.left+contour.right)/2,width=contour.right-contour.left+1;
  for(let x=Math.ceil(center-width*.35);x<=Math.floor(center+width*.35);x++){
   const top=contour.tops[x],pageX=b.left+x/192*b.width,cx=Math.round((pageX-w.left)/w.width*wear.width),bottom=cloth.bottom[cx];
   if(top==null||bottom==null)continue;
   gaps.push(b.top+top/208*b.height-(w.top+bottom/wear.height*w.height));
  }
  gaps.sort((a,b)=>a-b);
  result.push({outfit:wear.dataset.outfit,form,kind,row,column,contactColumns:gaps.length,gap:gaps.length?gaps[Math.floor(gaps.length/2)]:null});
 }
 return result;
};

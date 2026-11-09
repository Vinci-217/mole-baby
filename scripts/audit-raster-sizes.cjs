/** Inspect every retained source frame via the independent tint mask. Props
 * cannot determine anatomical width. Reconstruct tile bounds without changing
 * image data or registrations; unused legacy atlases are reported separately. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/all-animation-sizes'),visibility=require('../electron/edge-visibility.json');
const quantile=(v,q)=>v.slice().sort((a,b)=>a-b)[Math.min(v.length-1,Math.floor(v.length*q))];
async function scan(group,key,spec){
 const folder=path.join(root,'public/assets/original',group,spec.assetKey),clip=JSON.parse(fs.readFileSync(path.join(folder,'clip.json'))),k=spec.registration.cssPixelsPerAtlasPixel*(spec.registration.displayScale??1),target=visibility.forms[spec.form].body[2]-visibility.forms[spec.form].body[0];
 const tileBounds=[];
 for(let p=0;p<clip.pages.length;p++){
  const {data,info}=await sharp(path.join(folder,clip.pages[p].mask)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const [index,[page,sx,sy,w,h]] of clip.rectangles.entries())if(page===p){
   let x0=w,y0=h,x1=-1,y1=-1,count=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((sy+y)*info.width+sx+x)*4;if(data[i+3]>128&&Math.max(data[i],data[i+1],data[i+2])>50){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);count++;}}
   tileBounds[index]=count?[x0,y0,x1+1,y1+1,count]:null;
  }
 }
 const bounds=clip.poses.map(pose=>{
  let x0=clip.width,y0=clip.height,x1=-1,y1=-1,count=0;
  for(const [tile,x,y] of pose){const b=tileBounds[tile];if(!b)continue;x0=Math.min(x0,x+b[0]);y0=Math.min(y0,y+b[1]);x1=Math.max(x1,x+b[2]);y1=Math.max(y1,y+b[3]);count+=b[4]}
  return count?{width:(x1-x0)*k,height:(y1-y0)*k,bounds:[x0,y0,x1,y1],count,edge:x0<1||y0<1||x1>=clip.width-1||y1>=clip.height-1}:null;
 });
 const frames=clip.frameMap.map(i=>bounds[i]),widths=frames.filter(Boolean).map(b=>b.width),median=quantile(widths,.5),p10=quantile(widths,.1),p90=quantile(widths,.9),ratio=median/target;
 return {key,group,form:spec.form,id:spec.id,frames:spec.frames,uniquePoses:clip.poses.length,nonempty:widths.length,target,median,p10,p90,ratio,first:frames.find(Boolean),registration:spec.registration,flags:[...(!widths.length?['no-body-mask']:[]),...(ratio<.8||ratio>1.25?['median-body-size']:[]),...(frames.some(f=>f?.edge)?['body-clipped-at-export-edge']:[])],bounds};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const rows=[];
 for(const group of ['daily-frames','uploaded-actions']){
  const index=require(path.join(root,'public/assets/original',group,'index.json'));
  for(const [key,spec] of Object.entries(index)){const row=await scan(group,key,spec);rows.push(row);if(row.flags.length)console.log('REVIEW',group,key,row.ratio.toFixed(3),row.flags);if(rows.length%20===0)console.log('Scanned',rows.length);}
 }
 fs.writeFileSync(path.join(out,'raster-report.json'),JSON.stringify({clips:rows.length,frames:rows.reduce((n,r)=>n+r.frames,0),flagged:rows.filter(r=>r.flags.length).map(({bounds,...r})=>r),rows},null,2));
 console.log(JSON.stringify({clips:rows.length,frames:rows.reduce((n,r)=>n+r.frames,0),flagged:rows.filter(r=>r.flags.length).length}));
})().catch(e=>{console.error(e);process.exitCode=1});

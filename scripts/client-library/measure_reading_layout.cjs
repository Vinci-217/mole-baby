/** Match original button coordinates to the already verified, trimmed pages. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
(async()=>{
 const request=JSON.parse(fs.readFileSync(0,'utf8')),result=[];
 for(const [index,file]of request.files.entries()){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
  if(right<0)throw Error('Empty source page');
  const box={left,top,width:right-left+1,height:bottom-top+1};
  const cropped=await sharp(file).extract(box).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const saved=await sharp(path.join(request.saved,String(index+1)+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(cropped.info.width!==saved.info.width||cropped.info.height!==saved.info.height||!cropped.data.equals(saved.data))throw Error('Rendering differs from archived page: '+file);
  // getDisplayRectWithFilters already includes FrameExporter's margins.
  const origin=request.probe.bounds;
  result.push({rect:[origin[0]+left,origin[1]+top,box.width,box.height],controls:request.probe.frames[index].controls.filter(c=>c.rect[2]>0&&c.rect[3]>0)});
 }
 const x=Math.min(...result.map(f=>f.rect[0])),y=Math.min(...result.map(f=>f.rect[1]));
 const right=Math.max(...result.map(f=>f.rect[0]+f.rect[2])),bottom=Math.max(...result.map(f=>f.rect[1]+f.rect[3]));
 fs.writeFileSync(request.output,JSON.stringify({viewport:[x,y,right-x,bottom-y],frames:result},null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1});

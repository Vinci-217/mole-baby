/** Keep page registration; ignore detached marks outside the paper in its view. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
(async()=>{
 const request=JSON.parse(fs.readFileSync(0,'utf8')),probe=request.probe,result=[],pages=[];
 fs.mkdirSync(request.output,{recursive:true});
 for(const [index,originalFrame]of request.selected.entries()){
  const file=request.files.find(file=>Number(path.basename(file,'.png'))===originalFrame+1);
  if(!file)throw Error('Missing source frame '+originalFrame);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y)}
  if(right<0)throw Error('Empty source page '+file);
  const visited=new Uint8Array(info.width*info.height),queue=new Int32Array(info.width*info.height);let best=null,total=0;
  for(let start=0;start<visited.length;start++){
   if(visited[start]||data[start*4+3]<24)continue;
   let count=0,head=0,tail=1,l=info.width,t=info.height,r=0,b=0;queue[0]=start;visited[start]=1;
   while(head<tail){const at=queue[head++],x=at%info.width,y=Math.floor(at/info.width);count++;l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);
    for(const next of[at-1,at+1,at-info.width,at+info.width])if(next>=0&&next<visited.length&&!visited[next]&&data[next*4+3]>=24&&Math.abs(next%info.width-x)<=1){visited[next]=1;queue[tail++]=next}
   }
   total+=count;if(!best||count>best.count)best={count,left:l,top:t,right:r,bottom:b};
  }
  let view={left,top,right,bottom};
  if(best&&best.count>total*.8&&((right-left)-(best.right-best.left)>50||(bottom-top)-(best.bottom-best.top)>50))view={left:Math.max(left,best.left-2),top:Math.max(top,best.top-2),right:Math.min(right,best.right+2),bottom:Math.min(bottom,best.bottom+2)};
  const rect=[probe.bounds[0]+left,probe.bounds[1]+top,right-left+1,bottom-top+1];
  const viewRect=[probe.bounds[0]+view.left,probe.bounds[1]+view.top,view.right-view.left+1,view.bottom-view.top+1];
  result.push({rect,viewRect,controls:probe.frames[originalFrame].controls.filter(c=>c.rect[2]>0&&c.rect[3]>0)});
  const webp=request.pageFormat==='webp',destination=path.join(request.output,`${index+1}.${webp?'webp':'png'}`);
  const page=sharp(file).extract({left,top,width:rect[2],height:rect[3]});
  await (webp?page.webp({quality:94,alphaQuality:100,smartSubsample:true,effort:3}):page.png()).toFile(destination);pages.push(destination);
 }
 fs.writeFileSync(request.layout,JSON.stringify({frames:result},null,2)+'\n');
 console.log(JSON.stringify({pages,frames:result.length}));
})().catch(error=>{console.error(error);process.exitCode=1});

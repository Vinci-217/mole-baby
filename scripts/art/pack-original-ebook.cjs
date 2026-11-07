const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'artifacts/original-reading-runtime'),out=path.join(root,'public/assets/original/reading-book');
const meta=JSON.parse(fs.readFileSync(path.join(work,'captures.json'))),sourcePath='root/resource/petcloth/swf2/1200026.swf';
const palettes={yellow:[0,-21,-255],blue:[-215,-57,31],purple:[-115,-171,-55],red:[255,-199,-250],pink:[51,-148,0]},clamp=(v,lo=0,hi=255)=>Math.max(lo,Math.min(hi,v));
(async()=>{
 const manifest={source:sourcePath,url:'https://mole.61.com/resource/petcloth/swf2/1200026.swf',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'local-assets/raw',sourcePath))).digest('hex'),name:'Ebook',fps:24,captureEngine:`Ruffle ${meta.ruffle}`,view:'down',adaptation:'Original costume timelines played with LamuUIManage bone synchronization and the source stand/flight rule. Browser final-render screenshots preserve Flash filters/masks. Neutralized body and colour coverage recovered from original yellow/blue/red/pink rendered probes; verified against a separate original custom-purple render. Identity-transform screenshots are retained only as research evidence; normalized runtime artwork follows the actual coloured final renders and their filter/alpha results. One shared crop/scale per form; no page drawing, artificial page turns, opening, closing, body deformation or motion interpolation. Seed has no source costume. This is an isolated source-asset playback, not a recording of a logged-in game session.',forms:{}};
 fs.mkdirSync(out,{recursive:true});const colourChecks={};
 for(const[form,m]of Object.entries(meta.forms)){
  const frames=Array.from({length:m.loopFrames},(_,i)=>m.loopStart+i),dir=path.join(work,'captures',form),raw=[];let x0=560,y0=500,x1=0,y1=0;const checks={};
  for(const frame of frames){const files={};for(const colour of ['full',...Object.keys(palettes)])files[colour]=await sharp(path.join(dir,`${String(frame).padStart(4,'0')}-${colour}.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});const n=files.full.data,y=files.yellow.data,b=files.blue.data,mask=Buffer.alloc(n.length);
   const delta=offsets=>[255,204,153].map(base=>offsets.map(v=>clamp(base+v)-base));
   const dy=delta(palettes.yellow),probeNames=['blue','red','pink'],rows=probeNames.flatMap(name=>[0,1,2].map(c=>delta(palettes[name]).map((col,j)=>col[c]-dy[j][c])));
   const normal=Array.from({length:3},(_,i)=>Array.from({length:6},(_,j)=>j<3?rows.reduce((sum,row)=>sum+row[i]*row[j],0):Number(j-3===i)));
   for(let i=0;i<3;i++){const div=normal[i][i];for(let j=0;j<6;j++)normal[i][j]/=div;for(let k=0;k<3;k++)if(k!==i){const factor=normal[k][i];for(let j=0;j<6;j++)normal[k][j]-=factor*normal[i][j];}}
   const inverse=normal.map(row=>row.slice(3)),pinv=inverse.map(row=>rows.map(values=>row.reduce((sum,v,k)=>sum+v*values[k],0)));
   const normalized=Buffer.from(y);
   for(let i=0;i<n.length;i+=4){mask[i+3]=y[i+3];if(!y[i+3])continue;
    const differences=probeNames.flatMap(name=>[0,1,2].map(c=>files[name].data[i+c]-y[i+c]));
    let weights=pinv.map(row=>clamp(row.reduce((sum,v,j)=>sum+v*differences[j],0),0,1));const total=weights.reduce((sum,v)=>sum+v,0);if(total>1)weights=weights.map(v=>v/total);
    for(let k=0;k<3;k++)mask[i+k]=Math.round(weights[k]*255);
    for(let c=0;c<3;c++)normalized[i+c]=clamp(Math.round(y[i+c]-weights.reduce((sum,w,k)=>sum+dy[k][c]*w,0)));
   }
   n.set(normalized);

   for(const[colour,offsets]of Object.entries(palettes)){
    const target=files[colour].data,deltas=[255,204,153].map(base=>offsets.map(v=>clamp(base+v)-base)),check=checks[colour]??={max:0,squared:0,channels:0,over8:0};
    for(let i=0;i<n.length;i+=4)if(n[i+3])for(let c=0;c<3;c++){
     const reconstructed=clamp(Math.round(n[i+c]+deltas[0][c]*mask[i]/255+deltas[1][c]*mask[i+1]/255+deltas[2][c]*mask[i+2]/255));
     const error=Math.abs(reconstructed-target[i+c])*target[i+3]/255;check.max=Math.max(check.max,error);check.squared+=error*error;check.channels++;if(error>8)check.over8++;
    }
   }
   const info=files.full.info;for(let py=0;py<info.height;py++)for(let px=0;px<info.width;px++)if(n[(py*info.width+px)*4+3]){x0=Math.min(x0,px);y0=Math.min(y0,py);x1=Math.max(x1,px+1);y1=Math.max(y1,py+1)}
   raw.push({neutral:n,mask,info});
  }
  colourChecks[form]=Object.fromEntries(Object.entries(checks).map(([key,v])=>[key,{...v,rmse:Math.sqrt(v.squared/v.channels)}]));
  for(const[colour,check]of Object.entries(colourChecks[form]))assert(check.rmse<1.5,`${form}/${colour}: colour RMSE ${check.rmse}`);
  x0=Math.max(0,x0-3);y0=Math.max(0,y0-3);x1=Math.min(560,x1+3);y1=Math.min(500,y1+3);
  const width=320,height=Math.round((y1-y0)/(x1-x0)*width),columns=6,rows=Math.ceil(frames.length/columns),crop={left:x0,top:y0,width:x1-x0,height:y1-y0},hashes={};
  for(const layer of ['neutral','mask']){
   const pieces=[];for(const[i,item]of raw.entries())pieces.push({input:await sharp(item[layer],{raw:item.info}).extract(crop).resize(width,height,{kernel:layer==='mask'?'lanczos3':'lanczos3'}).png().toBuffer(),left:i%columns*width,top:Math.floor(i/columns)*height});
   const png=await sharp({create:{width:columns*width,height:rows*height,channels:4,background:'#00000000'}}).composite(pieces).png().toBuffer(),name=`${form}-${layer}.png`;fs.writeFileSync(path.join(out,name),png);hashes[name]=crypto.createHash('sha256').update(png).digest('hex');
  }
  for(const colour of ['neutral','yellow']){
   const exportDir=path.join(work,'png-sequence',colour,form);fs.mkdirSync(exportDir,{recursive:true});
   for(const[i,frame]of frames.entries())await sharp(path.join(dir,`${String(frame).padStart(4,'0')}-${colour==='neutral'?'full':colour}.png`)).extract(crop).png().toFile(path.join(exportDir,`${String(i+1).padStart(3,'0')}.png`));
  }
  manifest.forms[form]={width,height,columns,frames:frames.length,sourceLoopStart:m.loopStart,sourceLoopFrames:m.loopFrames,crop:[x0,y0,x1,y1],sha256:hashes};console.log(`${form}: ${frames.length} original frames, ${width}×${height}; colour RMSE ${Math.max(...Object.values(colourChecks[form]).map(c=>c.rmse)).toFixed(3)}`);
 }
 assert.equal(Object.keys(manifest.forms).length,8);fs.writeFileSync(path.join(out,'source.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(work,'png-sequence/source.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(work,'colour-checks.json'),JSON.stringify(colourChecks,null,2)+'\n');
 for(const f of fs.readdirSync(out))if(f==='pages.png'||/-(back|body|front)[.]png$/.test(f))fs.rmSync(path.join(out,f));
})().catch(e=>{console.error(e);process.exitCode=1});

const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'artifacts/original-reading-source'),out=path.join(root,'public/assets/original/reading-book');
function pngs(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?pngs(path.join(dir,e.name)):e.name.endsWith('.png')?[path.join(dir,e.name)]:[])}
(async()=>{
 const files=pngs(path.join(work,'original-pages')).sort((a,b)=>parseInt(path.basename(a))-parseInt(path.basename(b)));assert.equal(files.length,15);
 const originals=await Promise.all(files.map(f=>sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true})));
 let x0=Infinity,y0=Infinity,x1=0,y1=0;
 for(const {data,info}of originals)for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1)}
 const width=384,height=Math.round((y1-y0)/(x1-x0)*width),pieces=[];
 for(const[i,f]of files.entries())pieces.push({input:await sharp(f).extract({left:x0,top:y0,width:x1-x0,height:y1-y0}).resize(width,height).png().toBuffer(),left:i%5*width,top:Math.floor(i/5)*height});
 fs.mkdirSync(out,{recursive:true});await sharp({create:{width:5*width,height:3*height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(pieces).png().toFile(path.join(out,'pages.png'));
 const source=JSON.parse(fs.readFileSync(path.join(work,'source.json')));fs.writeFileSync(path.join(out,'source.json'),JSON.stringify({...source,width,height,columns:5,frames:15,crop:[x0,y0,x1,y1],sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'pages.png'))).digest('hex')},null,2)+'\n');
 console.log(`Packed 15 original frames: ${width}x${height}; shared crop preserves registration.`);
})().catch(e=>{console.error(e);process.exitCode=1});

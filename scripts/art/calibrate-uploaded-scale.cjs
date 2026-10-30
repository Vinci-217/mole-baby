/** Measure the isolated body in the first original pose, independent of later
 * squash/shrink frames. Changes registration only, never source frames. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'public/assets/original/uploaded-actions');
const visibility=require('../../electron/edge-visibility.json');
async function firstBody(clip,directory){
 const pages=new Map();let left=Infinity,right=-Infinity;
 for(const[tile,x]of clip.poses[clip.frameMap[0]]){
  const[page,sx,sy,w,h]=clip.rectangles[tile];
  if(!pages.has(page))pages.set(page,await sharp(path.join(directory,clip.pages[page].mask)).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
  const{data,info}=pages.get(page);
  for(let y=0;y<h;y++)for(let dx=0;dx<w;dx++){
   const i=((sy+y)*info.width+sx+dx)*4;
   if(data[i+3]>150&&data[i]+data[i+1]+data[i+2]>115){left=Math.min(left,x+dx);right=Math.max(right,x+dx+1)}
  }
 }
 if(!Number.isFinite(left)||right<=left)throw Error('Original first pose has no body');
 return right-left;
}
async function calibrate(){
 const indexFile=path.join(base,'index.json'),index=JSON.parse(fs.readFileSync(indexFile,'utf8')),records=[];
 for(const[key,spec]of Object.entries(index).filter(([,s])=>/^tuya[1-4]$/.test(s.id))){
  const directory=path.join(base,spec.assetKey),file=path.join(directory,'clip.json'),clip=JSON.parse(fs.readFileSync(file,'utf8'));
  const width=await firstBody(clip,directory),target=visibility.forms[spec.form].body[2]-visibility.forms[spec.form].body[0];
  const before=width*spec.registration.cssPixelsPerAtlasPixel;
  spec.registration.displayScale=target/before;clip.registration=spec.registration;
  fs.writeFileSync(file,JSON.stringify(clip));records.push({key,referenceFrame:1,bodyAtlasWidth:width,originalCssWidth:before,targetCssWidth:target,displayScale:target/before});
 }
 fs.writeFileSync(indexFile,JSON.stringify(index));
 fs.writeFileSync(path.join(root,'research/tuya-size-calibration.json'),JSON.stringify({method:'One fixed display scale per clip, from isolated original first-pose body; complete timelines and atlas bytes unchanged',records},null,2)+'\n');
 console.log('Calibrated',records.length,'original graffiti clips');
}
if(require.main===module)calibrate().catch(e=>{console.error(e);process.exitCode=1});
module.exports={firstBody};

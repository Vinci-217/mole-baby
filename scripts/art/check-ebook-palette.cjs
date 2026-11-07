const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),assets=path.join(root,'public/assets/original/reading-book'),work=path.join(root,'artifacts/original-reading-runtime'),meta=require('../../public/assets/original/reading-book/source.json'),offsets=[-115,-171,-55],clamp=v=>Math.max(0,Math.min(255,v));
(async()=>{const result={};for(const[form,spec]of Object.entries(meta.forms)){
 const[neutral,mask]=await Promise.all(['neutral','mask'].map(layer=>sharp(path.join(assets,`${form}-${layer}.png`)).raw().toBuffer({resolveWithObject:true})));let square=0,count=0;
 for(let f=0;f<spec.frames;f++){
  const expected=await sharp(path.join(work,'captures',form,`${String(spec.sourceLoopStart+f).padStart(4,'0')}-purple.png`)).extract({left:spec.crop[0],top:spec.crop[1],width:spec.crop[2]-spec.crop[0],height:spec.crop[3]-spec.crop[1]}).resize(spec.width,spec.height).raw().toBuffer();
  const ox=f%spec.columns*spec.width,oy=Math.floor(f/spec.columns)*spec.height,deltas=[255,204,153].map(base=>offsets.map(v=>clamp(base+v)-base));
  for(let y=0;y<spec.height;y++)for(let x=0;x<spec.width;x++){
   const i=((oy+y)*neutral.info.width+ox+x)*4,j=(y*spec.width+x)*4;if(!expected[j+3])continue;
   for(let c=0;c<3;c++){const actual=clamp(Math.round(neutral.data[i+c]+deltas.reduce((sum,d,k)=>sum+d[c]*mask.data[i+k]/255,0))),error=(actual-expected[j+c])*expected[j+3]/255;square+=error*error;count++;}
  }
 }
 const rmse=Math.sqrt(square/count);assert(rmse<2,`${form} final atlas lost original custom-colour render: ${rmse}`);result[form]={frames:spec.frames,purpleAlphaWeightedRMSE:rmse};
 }fs.writeFileSync(path.join(work,'final-palette-checks.json'),JSON.stringify(result,null,2)+'\n');console.log('PASS: all 178 final atlas frames preserve the independent original purple render (alpha-weighted RMSE < 2/255).');console.log(result);})().catch(e=>{console.error(e);process.exitCode=1});

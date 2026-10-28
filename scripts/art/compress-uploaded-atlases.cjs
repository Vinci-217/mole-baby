/** Offline frame-atlas storage. The colour-neutral pages permit a maximum
 * one-level RGB change; their exact alpha is restored from the lossless mask
 * by the runtime player. Masks, including every alpha byte, stay lossless. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp'),assert=require('node:assert/strict');
(async()=>{
 const folder=process.argv[2],records=[];
 for(const name of fs.readdirSync(folder).filter(n=>/^(neutral|mask)-\d+\.png$/.test(n))){
  const file=path.join(folder,name),target=file.replace(/\.png$/,'.webp'),mask=name.startsWith('mask-'),original=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const pipeline=mask?sharp(file):sharp(file).removeAlpha();
  await pipeline.webp(mask?{lossless:true,alphaQuality:100,effort:4}:{nearLossless:true,quality:90,effort:4}).toFile(target);
  let decoded=await sharp(target).ensureAlpha().raw().toBuffer();let max=0,alpha=true;
  for(let i=0;i<decoded.length;i+=4){if(decoded[i+3]!==original.data[i+3])alpha=false;if(original.data[i+3])for(let c=0;c<3;c++)max=Math.max(max,Math.abs(decoded[i+c]-original.data[i+c]));}
  if(mask){assert.ok(alpha,name+' mask alpha');assert.equal(max,0,name+' mask RGB');}else if(max>1){await sharp(file).removeAlpha().webp({lossless:true,effort:4}).toFile(target);decoded=await sharp(target).ensureAlpha().raw().toBuffer();max=0;for(let i=0;i<decoded.length;i+=4)if(original.data[i+3])for(let c=0;c<3;c++)max=Math.max(max,Math.abs(decoded[i+c]-original.data[i+c]));assert.equal(max,0,name+' opaque RGB fallback');}
  records.push({file:path.basename(target),sourcePngSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),before:fs.statSync(file).size,after:fs.statSync(target).size,exactMask:mask,maxVisibleRgbError:max,exactStoredAlpha:alpha,alphaRestoredFromLosslessMask:!mask});
  fs.unlinkSync(file);
 }
 fs.writeFileSync(path.join(folder,'compression.json'),JSON.stringify(records,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1});

const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),sharp=require('sharp');
async function verifyUploadedAtlases(){
 const root=path.resolve(__dirname,'..'),library=path.join(root,'public/assets/original/uploaded-actions'),index=JSON.parse(fs.readFileSync(path.join(library,'index.json'))),sources=JSON.parse(fs.readFileSync(path.join(root,'research/references/uploaded-lamu-actions/sources.json'))),proofs=JSON.parse(fs.readFileSync(path.join(root,'research/references/uploaded-lamu-actions/render-proofs.json'))).clips,seen=new Set();let sourceFrames=0,samples=0;
 assert.equal(sources.files.length,247);assert.equal(Object.keys(index).length,247);
 for(const file of sources.files){const spec=index[file.form+'-'+file.id];assert.ok(spec,file.file);sourceFrames+=spec.frames;const key=spec.assetKey;if(seen.has(key))continue;seen.add(key);
  const directory=path.join(library,key),clip=JSON.parse(fs.readFileSync(path.join(directory,'clip.json'))),proof=proofs[key];assert.equal(clip.sourceSha256,file.sha256);assert.equal(proof.sourceSha256,file.sha256);assert.equal(clip.frames,clip.frameMap.length);assert.equal(clip.fps,24);assert.equal(proof.frames,clip.frames);
  const pages=await Promise.all(clip.pages.map(async page=>{assert.ok(page.width<=2048&&page.height<=2048);const {data,info}=await sharp(path.join(directory,page.mask)).ensureAlpha().extractChannel(3).raw().toBuffer({resolveWithObject:true});assert.equal(info.width,page.width);assert.equal(info.height,page.height);return {data,width:info.width}}));
  for(const index of clip.frameMap){assert.ok(Number.isInteger(index)&&index>=0&&index<clip.poses.length);for(const[tile,x,y]of clip.poses[index]){const[page,sx,sy,w,h]=clip.rectangles[tile];assert.ok(page>=0&&page<clip.pages.length);assert.ok(x>=0&&y>=0&&x+w<=clip.width&&y+h<=clip.height);assert.ok(sx>=0&&sy>=0&&sx+w<=clip.pages[page].width&&sy+h<=clip.pages[page].height)}}
  for(const[time,expected]of Object.entries(proof.sourceAlphaSha256)){
   const canvas=Buffer.alloc(clip.width*clip.height);for(const[tile,x,y]of clip.poses[clip.frameMap[Number(time)]]){const[page,sx,sy,w,h]=clip.rectangles[tile],source=pages[page];for(let row=0;row<h;row++)source.data.copy(canvas,(y+row)*clip.width+x,(sy+row)*source.width+sx,(sy+row)*source.width+sx+w)}
   assert.equal(crypto.createHash('sha256').update(canvas).digest('hex'),expected,key+' full-frame alpha at '+time);samples++;
  }
  const compression=JSON.parse(fs.readFileSync(path.join(directory,'compression.json')));for(const record of compression){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,record.file))).digest('hex'),record.sha256);if(record.exactMask){assert.equal(record.maxVisibleRgbError,0);assert.equal(record.exactStoredAlpha,true)}else assert.ok(record.maxVisibleRgbError<=1)}
 }
 assert.equal(sourceFrames,47204);assert.equal(seen.size,238);console.log(`PASS supplied atlases: all 247 files / 238 distinct SWFs / ${sourceFrames} time frames, ${samples} source-alpha reconstructions, bounded-copy playback of overlapping component bounds, preserved masks, RGB tolerance <=1, texture bounds <=2048`);
 return {files:247,distinct:seen.size,sourceFrames,sourceAlphaSamples:samples};
}
if(require.main===module)verifyUploadedAtlases().catch(error=>{console.error(error);process.exitCode=1});module.exports={verifyUploadedAtlases};

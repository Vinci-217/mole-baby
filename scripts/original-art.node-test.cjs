const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),clips=require('../public/assets/original/element-skills/clips.json'),receipt=require('../research/references/original-element-skills/source-receipt.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('all eighteen original source clips preserve the complete nested timeline and have bounded transparent atlases',()=>{
 assert.equal(Object.keys(clips).length,18);assert.equal(Object.values(clips).reduce((n,c)=>n+c.frames,0),1711);
 for(const clip of Object.values(clips)){
  const original=fs.readFileSync(path.join(root,'research/references/original-element-skills/raw',clip.sourceId+'.swf'));
  assert.ok(['CWS','FWS','ZWS'].includes(original.subarray(0,3).toString()));assert.equal(sha(original),clip.sourceSha256);assert.equal(receipt.assets.find(a=>a.id===clip.sourceId).sha256,clip.sourceSha256);
  assert.equal(clip.rootFrame,68);assert.equal(clip.fps,24);assert.equal(clip.frameMap.length,clip.frames);assert.equal(clip.durationMs,Math.ceil(clip.frames/24*1000));assert.ok(clip.clearedRuntimeItemSprites.length>0);
  for(const index of clip.frameMap)assert.ok(Number.isInteger(index)&&index>=0&&Math.floor(index/clip.pageFrames)<clip.pages.length);
  for(const file of clip.pages){const png=fs.readFileSync(path.join(root,'public/assets/original/element-skills',clip.id,file));assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.readUInt32BE(16)<=4096&&png.readUInt32BE(20)<=4096,'legacy graphics texture bound');assert.equal(png[25],6,'RGBA transparency preserved')}
 }
});
test('shared magic swaps only on opaque smoke and reuses the same forward/backward drawings',()=>{
 const runtime=require('../public/assets/generated/magic-box/runtime.json');assert.equal(runtime.durationMs,runtime.timeline.reduce((n,f)=>n+f.ms,0));
 const swaps=runtime.timeline.filter((f,i)=>i>0&&f.subject!==runtime.timeline[i-1].subject);assert.equal(swaps.length,2);assert.ok(swaps.every(f=>f.smoke===7));
 const used=runtime.timeline.filter(f=>f.smoke!==null).map(f=>f.smoke);assert.deepEqual(used.slice(0,16),used.slice(16));
 for(const [kind,count]of[['box',4],['smoke',16]])for(let i=1;i<=count;i++)assert.ok(fs.existsSync(path.join(root,'public/assets/generated/magic-box',kind,String(i).padStart(2,'0')+'.png')));
});
test('new furniture and room images match their archived source receipts',()=>{
 const record=require('../public/assets/original/furniture/source-record.json'),catalog=require('../public/assets/original/furniture/catalog.json');assert.equal(catalog.length,19);assert.equal(record.items.filter(i=>i.kind!=='furniture').length,5);
 for(const item of record.items)assert.equal(sha(fs.readFileSync(path.join(root,item.output))),item.output_sha256);
});

const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{gzipSync}=require('node:zlib');
const{buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
const{parseBlockMap}=require('./differential-download.cjs');
const{createUpdates}=require('./updates.cjs');
const{createUpdateServer,mappedFetch}=require('../scripts/incremental-test-server.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function fixture(t,{baseline=true,corruptBase=false,corruptIndex=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-delta-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const cache=path.join(dir,'cache');fs.mkdirSync(cache);
 const oldName='mole-baby-1.0.0-mac-arm64.dmg',name='mole-baby-1.0.1-mac-arm64.dmg';
 const before=crypto.randomBytes(4*1024*1024),after=Buffer.concat([before.subarray(0,100000),Buffer.from('A real insertion changes offsets'),before.subarray(100000)]);
 const oldFile=path.join(dir,oldName),file=path.join(dir,name);fs.writeFileSync(oldFile,before);fs.writeFileSync(file,after);
 for(const f of[oldFile,file])await buildBlockMap(f,'gzip',f+'.blockmap');
 const map=fs.readFileSync(file+'.blockmap'),oldMap=fs.readFileSync(oldFile+'.blockmap');
 const sums=Buffer.from(`${hash(after)}  ${name}\n${hash(map)}  ${name}.blockmap\n`);
 const files=new Map([[`/releases/download/v1.0.1/${name}`,file],[`/releases/download/v1.0.1/${name}.blockmap`,corruptIndex?Buffer.from('bad map'):map],[`/releases/download/v1.0.0/${oldName}.blockmap`,oldMap],['/releases/download/v1.0.1/SHA256SUMS.txt',sums]]);
 if(baseline){const bytes=Buffer.from(before);if(corruptBase)bytes.fill(0);fs.writeFileSync(path.join(cache,oldName),bytes);fs.writeFileSync(path.join(cache,oldName+'.blockmap'),oldMap)}
 const server=await createUpdateServer(files);t.after(()=>server.close());
 const states=[];let opened;
 const updates=createUpdates({version:'1.0.0',platform:'darwin',arch:'arm64',macSigned:false,configFile:path.join(dir,'updates.json'),cacheDirectory:cache,fetch:mappedFetch(server.origin,'1.0.1'),openPath:async file=>{opened=file;return''},onChange:state=>states.push(state)});t.after(()=>updates.dispose());
 return{updates,server,states,cache,name,oldName,before,after,map,file,dir,get opened(){return opened}};
}
test('Mac reconstructs a byte-identical package with range downloads and retains separate consent',async t=>{
 const f=await fixture(t);await f.updates.check();assert.equal(f.updates.getState().status,'available');
 assert.equal(await f.updates.download(false),false);assert.equal(await f.updates.install(true),false);assert.equal(f.server.requests.some(r=>r.path.endsWith('.dmg')),false);
 assert.equal(await f.updates.download(true),true);const state=f.updates.getState();
 assert.equal(state.downloadMode,'differential');assert.ok(state.reusedBytes>f.after.length*.9);assert.ok(state.transferredBytes<f.after.length*.1);
 assert.deepEqual(fs.readFileSync(path.join(f.cache,f.name)),f.after);assert.deepEqual(fs.readFileSync(path.join(f.cache,f.oldName)),f.before);
 assert.deepEqual(fs.readFileSync(path.join(f.cache,f.name+'.blockmap')),f.map);
 const requests=f.server.requests.filter(r=>r.path.endsWith('.dmg'));assert.ok(requests.length>0);assert.ok(requests.every(r=>r.status===206&&r.range));
 assert.equal(requests.reduce((sum,r)=>sum+r.bodyBytes,0),state.transferredBytes);
 assert.equal(f.opened,undefined);assert.equal(await f.updates.install(true),true);assert.equal(f.opened,path.join(f.cache,f.name));
});
test('missing cached baseline downloads and verifies the complete package',async t=>{
 const f=await fixture(t,{baseline:false});await f.updates.check();assert.equal(await f.updates.download(true),true);
 assert.equal(f.updates.getState().downloadMode,'full');assert.deepEqual(fs.readFileSync(path.join(f.cache,f.name)),f.after);
 assert.deepEqual(f.server.requests.filter(r=>r.path.endsWith('.dmg')).map(r=>[r.range,r.status]),[[null,200]]);
});
test('server without Range support falls back to a complete verified package',async t=>{
 const f=await fixture(t);f.server.behavior.range='unsupported';await f.updates.check();assert.equal(await f.updates.download(true),true);
 assert.equal(f.updates.getState().downloadMode,'full');assert.equal(f.updates.getState().fallbackReason,'range-unsupported');
 assert.deepEqual(fs.readFileSync(path.join(f.cache,f.name)),f.after);assert.ok(f.server.requests.some(r=>r.path.endsWith('.dmg')&&!r.range));
});
test('corrupted baseline fails final verification and recovers without changing the old cache',async t=>{
 const f=await fixture(t,{corruptBase:true});await f.updates.check();assert.equal(await f.updates.download(true),true);
 assert.equal(f.updates.getState().downloadMode,'full');assert.ok(f.states.some(s=>s.fallbackReason==='incremental-unavailable'));
 assert.deepEqual(fs.readFileSync(path.join(f.cache,f.name)),f.after);assert.deepEqual(fs.readFileSync(path.join(f.cache,f.oldName)),Buffer.alloc(f.before.length));
});
test('an invalid new index never enters the cache and falls back to the full download',async t=>{
 const f=await fixture(t,{corruptIndex:true});await f.updates.check();assert.equal(await f.updates.download(true),true);
 assert.equal(f.updates.getState().downloadMode,'full');assert.equal(fs.existsSync(path.join(f.cache,f.name+'.blockmap')),false);
});
test('aborting a range request removes partial files and never offers installation',async t=>{
 const f=await fixture(t);f.server.behavior.range='wait';await f.updates.check();let rangeStarted;
 const range=new Promise(resolve=>rangeStarted=resolve);f.server.behavior.onRange=rangeStarted;
 const download=f.updates.download(true);await range;f.updates.dispose();assert.equal(await download,false);
 assert.equal(fs.existsSync(path.join(f.cache,f.name)),false);assert.equal(fs.existsSync(path.join(f.cache,f.name+'.part')),false);assert.equal(await f.updates.install(true),false);
 assert.deepEqual(fs.readFileSync(path.join(f.cache,f.oldName)),f.before);
});
test('a validated already-downloaded target is reused without fetching package bytes',async t=>{
 const f=await fixture(t);fs.writeFileSync(path.join(f.cache,f.name),f.after);await f.updates.check();assert.equal(await f.updates.download(true),true);
 assert.equal(f.updates.getState().downloadMode,'cached');assert.equal(f.server.requests.some(r=>r.path.endsWith('.dmg')),false);
});
test('rejects invalid blockmaps before constructing filesystem copy operations',()=>{
 const valid={version:'2',files:[{name:'file',offset:0,sizes:[10],checksums:[Buffer.alloc(18).toString('base64')]}]};
 assert.equal(parseBlockMap(gzipSync(JSON.stringify(valid))).size,10);
 for(const mutate of[m=>m.version='3',m=>m.files[0].offset=-1,m=>m.files[0].sizes=[-1],m=>m.files[0].sizes=[1024**3+1],m=>m.files[0].checksums=['not a checksum'],m=>m.files.push(m.files[0])]){
  const copy=JSON.parse(JSON.stringify(valid));mutate(copy);assert.throws(()=>parseBlockMap(gzipSync(JSON.stringify(copy))));
 }
 assert.throws(()=>parseBlockMap(gzipSync(Buffer.alloc(9*1024*1024))),/larger|size|length/i);
});

test('cache cleanup preserves the installed baseline and removes unrelated old release packages only',async t=>{
 const f=await fixture(t),stale='mole-baby-0.9.0-mac-arm64.dmg';
 fs.writeFileSync(path.join(f.cache,stale),'old');fs.writeFileSync(path.join(f.cache,stale+'.blockmap'),'old index');fs.writeFileSync(path.join(f.cache,'preferences.json'),'keep');
 await f.updates.check();assert.equal(await f.updates.download(true),true);
 assert.equal(fs.existsSync(path.join(f.cache,stale)),false);assert.equal(fs.existsSync(path.join(f.cache,stale+'.blockmap')),false);
 assert.equal(fs.readFileSync(path.join(f.cache,'preferences.json'),'utf8'),'keep');assert.ok(fs.existsSync(path.join(f.cache,f.oldName)));
});

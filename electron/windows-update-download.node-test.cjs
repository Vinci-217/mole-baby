const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const{NodeHttpExecutor}=require('builder-util/out/nodeHttpExecutor');
// Loopback fixture traffic must reach its local server instead of inheriting
// the cloud host's outbound HTTP proxy. Production uses Electron's executor.
class LocalHttpExecutor extends NodeHttpExecutor{createRequest(options,callback){assert.equal(options.hostname,'127.0.0.1');return require('node:http').request(options,callback)}}
const{CancellationToken}=require('builder-util-runtime');
const{buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
const{createUpdateServer}=require('../scripts/incremental-test-server.cjs');
const{downloadWindowsDifference}=require('./windows-update-download.cjs');
async function fixture(t,{replacement=false,missing=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mole-windows-plan-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const before=crypto.randomBytes(2*1024*1024),after=replacement?crypto.randomBytes(before.length):Buffer.concat([before.subarray(0,100000),Buffer.from('New art and shifted bytes'),before.subarray(100000)]);
 const old=path.join(dir,'installer.exe'),next=path.join(dir,'next.exe');fs.writeFileSync(old,before);fs.writeFileSync(next,after);
 for(const file of[old,next])await buildBlockMap(file,'gzip',file+'.blockmap');
 fs.copyFileSync(old+'.blockmap',path.join(dir,'current.blockmap'));
 const server=await createUpdateServer(new Map([['/new.exe',next],['/old.blockmap',old+'.blockmap'],['/new.blockmap',next+'.blockmap']]));t.after(()=>server.close());
 if(missing)fs.unlinkSync(old);
 const pending=path.join(dir,'pending'),target=path.join(dir,'target.exe'),plans=[],progress=[];
 const engine={app:{version:'1.0.0'},httpExecutor:new LocalHttpExecutor(),downloadedUpdateHelper:{cacheDir:dir,cacheDirForPendingUpdate:pending},logger:{info(){},warn(){},error(){}},emit:(name,state)=>{if(name==='download-progress')progress.push(state)}};
 const provider={getBlockMapFiles:async()=>[new URL('/old.blockmap',server.origin),new URL('/new.blockmap',server.origin)]};
 const args=[{url:new URL('/new.exe',server.origin),info:{size:after.length,sha512:crypto.createHash('sha512').update(after).digest('base64')}},{cancellationToken:new CancellationToken(),updateInfoAndProvider:{info:{version:'1.0.1'},provider}},target,provider,'installer.exe'];
 return{engine,args,target,pending,server,after,before,old,plans,progress,run:()=>downloadWindowsDifference(engine,args,p=>plans.push(p))};
}
test('Windows uses the real pinned SHA512 downloader with the optimized difference plan',async t=>{
 const f=await fixture(t);assert.equal(await f.run(),false);assert.deepEqual(fs.readFileSync(f.target),f.after);assert.deepEqual(fs.readFileSync(f.old),f.before);assert.equal(f.plans[0].mode,'differential');
 assert.ok(f.server.requests.filter(r=>r.path==='/new.exe').every(r=>r.range&&r.status===206));assert.ok(fs.existsSync(path.join(f.pending,'current.blockmap')));assert.ok(f.progress.length>0);
});
test('Windows selects full replacement before downloading package ranges and keeps the new baseline map for successful promotion',async t=>{
 const f=await fixture(t,{replacement:true});assert.equal(await f.run(),true);assert.equal(f.plans[0].reason,'large-change');assert.equal(f.server.requests.some(r=>r.path==='/new.exe'),false);assert.ok(fs.existsSync(path.join(f.pending,'current.blockmap')));
});
test('Windows without an old installer skips difference indexes and selects a full download',async t=>{
 const f=await fixture(t,{missing:true});assert.equal(await f.run(),true);assert.equal(f.plans[0].reason,'baseline-missing');assert.equal(f.server.requests.length,0);
});

const{test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const{planUpdate}=require('./update-plan.cjs');
const{OperationKind}=require('electron-updater/out/differentialDownloader/downloadPlanBuilder');
const chunk=size=>crypto.randomBytes(size);
function map(chunks){return{size:chunks.reduce((n,b)=>n+b.length,0),map:{version:'2',files:[{name:'file',offset:0,sizes:chunks.map(b=>b.length),checksums:chunks.map(b=>crypto.createHash('sha256').update(b).digest('base64').slice(0,24))}]}}}
function reconstruct(plan,before,after){return Buffer.concat(plan.operations.map(op=>(op.kind===OperationKind.COPY?before:after).subarray(op.start,op.end)))}
test('difference plans handle added, removed and moved content without modifying the installed base',()=>{
 const a=chunk(128*1024),b=chunk(128*1024),c=chunk(128*1024),d=chunk(128*1024),x=chunk(128*1024),before=Buffer.concat([a,b,c,d]);
 for(const parts of[[d,a,x,c],[a,c],[a,b,x,c,d],[a,b,c,d]]){
  const after=Buffer.concat(parts),plan=planUpdate(map([a,b,c,d]),map(parts));assert.equal(plan.mode,'differential');assert.deepEqual(reconstruct(plan,before,after),after);
  assert.equal(plan.downloadBytes+plan.reusedBytes,after.length);
 }
});
test('nearby changed ranges are coalesced across a small unchanged gap, preserving shifted copy offsets',()=>{
 const a=chunk(128*1024),b=chunk(16*1024),c=chunk(8*1024),d=chunk(16*1024),e=chunk(128*1024),x=chunk(b.length),y=chunk(d.length);
 const before=Buffer.concat([a,b,c,d,e]),after=Buffer.concat([a,x,c,y,e]),plan=planUpdate(map([a,b,c,d,e]),map([a,x,c,y,e]));
 assert.equal(plan.mode,'differential');assert.equal(plan.requests,1);assert.equal(plan.downloadBytes,40*1024);assert.deepEqual(reconstruct(plan,before,after),after);
});
test('large changes and tiny fragmented transfers select a full package before range requests',()=>{
 const a=chunk(128*1024),b=chunk(128*1024),x=chunk(a.length),y=chunk(b.length);
 assert.equal(planUpdate(map([a,b]),map([x,y])).reason,'large-change');
 const small=chunk(4096),extra=chunk(4096),plan=planUpdate(map([small]),map([small,extra]));assert.equal(plan.mode,'full');assert.equal(plan.reason,'request-overhead');
});

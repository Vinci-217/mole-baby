const fs=require('node:fs'),fsp=fs.promises,crypto=require('node:crypto'),{gunzipSync}=require('node:zlib');
// This internal planner is shared with NSIS. Its version is pinned and tested.
const {OperationKind}=require('electron-updater/out/differentialDownloader/downloadPlanBuilder');
const {planUpdate}=require('./update-plan.cjs');
const MAX_PACKAGE_BYTES=1024*1024*1024,MAX_BLOCKMAP_BYTES=4*1024*1024;
function parseBlockMap(bytes){
 if(bytes.length>MAX_BLOCKMAP_BYTES)throw Error('Update blockmap too large');
 const map=JSON.parse(gunzipSync(bytes,{maxOutputLength:8*1024*1024}).toString('utf8'));
 if(map.version!=='2'||!Array.isArray(map.files)||map.files.length!==1)throw Error('Invalid update blockmap');
 const file=map.files[0];
 if(file.name!=='file'||file.offset!==0||!Array.isArray(file.sizes)||!Array.isArray(file.checksums)||!file.sizes.length||file.sizes.length>150000||file.sizes.length!==file.checksums.length)throw Error('Invalid update blockmap entries');
 let size=0;
 for(let i=0;i<file.sizes.length;i++){
  if(!Number.isSafeInteger(file.sizes[i])||file.sizes[i]<=0||file.sizes[i]>MAX_PACKAGE_BYTES||typeof file.checksums[i]!=='string'||!/^[A-Za-z0-9+/]{24}$/.test(file.checksums[i]))throw Error('Invalid update block');
  size+=file.sizes[i];if(size>MAX_PACKAGE_BYTES)throw Error('Update package too large');
 }
 return{map,size};
}
async function readBlockMapResponse(response){
 if(!response.ok||!response.body)throw Error('Update blockmap unavailable');
 const chunks=[];let size=0;
 for await(const chunk of response.body){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>MAX_BLOCKMAP_BYTES)throw Error('Update blockmap too large');chunks.push(bytes)}
 return Buffer.concat(chunks);
}
function rangeError(){const error=Error('Update server does not support the requested byte range');error.code='ERR_UPDATE_RANGE';return error}
async function downloadDifferential({oldFile,newFile,oldMap,newMap,url,digest,request,signal,onProgress=()=>{},plan=planUpdate(oldMap,newMap)}){
 signal.throwIfAborted();
 const stat=await fsp.stat(oldFile);if(!stat.isFile()||stat.size!==oldMap.size)throw Error('Update base package missing or changed');
 const operations=plan.operations;
 const totalDownload=operations.filter(op=>op.kind===OperationKind.DOWNLOAD).reduce((sum,op)=>sum+op.end-op.start,0);
 let input,output,processed=0,transferred=0;
 const hash=crypto.createHash('sha256');
 const progress=()=>onProgress({percent:Math.min(99,Math.floor(processed/newMap.size*100)),transferredBytes:transferred,totalBytes:totalDownload,fullSize:newMap.size,reusedBytes:newMap.size-totalDownload});
 const write=async(bytes)=>{signal.throwIfAborted();await output.writeFile(bytes);hash.update(bytes);processed+=bytes.length;progress()};
 try{
  input=await fsp.open(oldFile,'r');output=await fsp.open(newFile,'w',0o600);progress();
  const buffer=Buffer.allocUnsafe(256*1024);
  for(const op of operations){
   signal.throwIfAborted();
   if(op.kind===OperationKind.COPY){
    let offset=op.start;
    while(offset<op.end){const{bytesRead}=await input.read(buffer,0,Math.min(buffer.length,op.end-offset),offset);if(!bytesRead)throw Error('Update base package truncated');await write(buffer.subarray(0,bytesRead));offset+=bytesRead}
   }else{
    // A changed range can include hundreds of MB of new animation data.
    // Use the same transfer deadline as a full download on slower networks.
    const pending=await request(url,{headers:{Range:`bytes=${op.start}-${op.end-1}`}},20*60000);
    try{
     const response=pending.response,expected=op.end-op.start;
     if(response.status!==206||response.headers.get('content-range')!==`bytes ${op.start}-${op.end-1}/${newMap.size}`||!response.body){await response.body?.cancel?.();throw rangeError()}
     let received=0;
     for await(const chunk of response.body){const bytes=Buffer.from(chunk);received+=bytes.length;transferred+=bytes.length;if(received>expected)throw rangeError();await write(bytes)}
     if(received!==expected)throw rangeError();
    }finally{pending.finish()}
   }
  }
  if(processed!==newMap.size||hash.digest('hex')!==digest)throw Error('Update checksum mismatch after differential download');
  await output.sync();
  return{transferredBytes:transferred,totalBytes:totalDownload,fullSize:newMap.size,reusedBytes:newMap.size-totalDownload};
 }finally{await output?.close();await input?.close()}
}
async function downloadFull({url,newFile,digest,request,signal,onProgress=()=>{}}){
 const pending=await request(url,{},20*60000);let output;
 try{
  const response=pending.response;if(!response.ok||!response.body)throw Error('Download unavailable');
  const total=Number(response.headers.get('content-length'))||0;if(total>MAX_PACKAGE_BYTES)throw Error('Update too large');
  output=await fsp.open(newFile,'w',0o600);const hash=crypto.createHash('sha256');let received=0;
  for await(const chunk of response.body){signal.throwIfAborted();const bytes=Buffer.from(chunk);received+=bytes.length;if(received>MAX_PACKAGE_BYTES)throw Error('Update too large');hash.update(bytes);await output.writeFile(bytes);onProgress({percent:total?Math.min(99,Math.floor(received/total*100)):0,transferredBytes:received,totalBytes:total,fullSize:total,reusedBytes:0})}
  if(total&&received!==total||hash.digest('hex')!==digest)throw Error('Update checksum mismatch');
  await output.sync();return{transferredBytes:received,totalBytes:received,fullSize:received,reusedBytes:0};
 }finally{await output?.close();pending.finish()}
}
module.exports={parseBlockMap,readBlockMapResponse,downloadDifferential,downloadFull,MAX_BLOCKMAP_BYTES};

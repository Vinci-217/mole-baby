const path=require('node:path'),fs=require('node:fs');
const MIME={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.swf':'application/x-shockwave-flash','.json':'application/json'};
function originalAssetPath(url,root){
 try{
  const parsed=new URL(url);if(parsed.protocol!=='ram-original:'||parsed.hostname!=='assets')return null;
  const relative=decodeURIComponent(parsed.pathname).slice(1);
  if(!relative||relative.includes('\\')||relative.split('/').some(part=>part==='..'||part==='.')||!MIME[path.extname(relative)])return null;
  const target=path.resolve(root,relative);return target.startsWith(path.resolve(root)+path.sep)?target:null;
 }catch{return null}
}
/** Cache immutable bundled bytes for this process, including concurrent reads.
 * Do not cache failures or retain an unbounded collection of decoded assets. */
function createOriginalAssetReader({readFile=fs.promises.readFile,maxBytes=64*1024*1024}={}){
 const entries=new Map(),pending=new Map();let bytes=0;
 const read=async file=>{
  const hit=entries.get(file);if(hit){entries.delete(file);entries.set(file,hit);return hit}
  if(pending.has(file))return pending.get(file);
  const request=Promise.resolve().then(()=>readFile(file)).then(data=>{
   if(data.length<=maxBytes){while(bytes+data.length>maxBytes&&entries.size){const first=entries.keys().next().value;bytes-=entries.get(first).length;entries.delete(first)}entries.set(file,data);bytes+=data.length}
   return data;
  }).finally(()=>pending.delete(file));
  pending.set(file,request);return request;
 };
 return {read,get size(){return bytes}};
}
function registerOriginalAssets(protocol,root){
 const cache=createOriginalAssetReader();
 protocol.registerBufferProtocol('ram-original',(request,respond)=>{
  const file=originalAssetPath(request.url,root);if(!file){respond({error:-6});return}
  // Only content-hashed Ruffle files can outlive an application update in the
  // HTTP cache. Runtime/controller/SWF paths are reused by subsequent builds.
  const immutable=/^(?:[a-f0-9]{20}\.wasm|core\.ruffle\.[a-f0-9]+\.js)$/.test(path.basename(file));
  cache.read(file).then(data=>respond({data,mimeType:MIME[path.extname(file)],headers:{'Access-Control-Allow-Origin':'*','Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache'}}),()=>respond({error:-6}));
 });
}
module.exports={originalAssetPath,registerOriginalAssets,createOriginalAssetReader};

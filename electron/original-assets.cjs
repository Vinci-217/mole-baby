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
function registerOriginalAssets(protocol,root){
 protocol.registerBufferProtocol('ram-original',(request,respond)=>{
  const file=originalAssetPath(request.url,root);if(!file){respond({error:-6});return}
  fs.readFile(file,(error,data)=>respond(error?{error:-6}:{data,mimeType:MIME[path.extname(file)],headers:{'Access-Control-Allow-Origin':'*'}}));
 });
}
module.exports={originalAssetPath,registerOriginalAssets};

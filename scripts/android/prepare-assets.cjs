#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {buildBlockMap}=require('app-builder-lib/out/targets/blockmap/blockmap');
const root=path.resolve(__dirname,'../..'),source=path.join(root,'dist'),target=path.join(root,'android/app/src/main/assets/web');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
async function prepare(){
 if(!fs.existsSync(path.join(source,'index.html')))throw Error('先运行 npm run build');
 fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
 const media=[],entries=[],renderer=[];
 for(const file of files(source)){
  const name=path.relative(source,file).split(path.sep).join('/');
  if(/\.(?:js|css)$/.test(name)||!name.startsWith('assets/')){const out=path.join(target,name);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(file,out);if(/\.(?:js|css|html)$/.test(name))renderer.push({path:name,sha256:digest(file)});continue;}
  if(!/\.(?:webp|png|jpg|jpeg|gif|mp3|ogg|wav|json|svg|woff2?|ttf|xml|md)$/i.test(name))throw Error('未归类的安卓素材: '+name);
  media.push(name);entries.push({path:name,size:fs.statSync(file).size,sha256:digest(file)});
 }
 const index={schema:1,revision:crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,24),rendererHash:crypto.createHash('sha256').update(JSON.stringify(renderer)).digest('hex'),files:entries};
 const listFile=path.join(target,'pack-input.json');fs.writeFileSync(listFile,JSON.stringify(media));
 cp.execFileSync('python3',['-c',String.raw`import json,sys,zipfile,pathlib
source,out,listing=sys.argv[1:]
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
 for name in json.loads(pathlib.Path(listing).read_text()):
  info=zipfile.ZipInfo(name,date_time=(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,(pathlib.Path(source)/name).read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
`,source,path.join(target,'resources.zip'),listFile],{stdio:'inherit'});
 fs.rmSync(listFile);index.pack={size:fs.statSync(path.join(target,'resources.zip')).size,sha256:digest(path.join(target,'resources.zip'))};
 fs.writeFileSync(path.join(target,'resource-index.json'),JSON.stringify(index));
 await buildBlockMap(path.join(target,'resources.zip'),'gzip',path.join(target,'resources.zip.blockmap'));
 console.log(`Android: ${entries.length} 素材，${Math.round(index.pack.size/1024/1024)} MiB，revision ${index.revision}`);
}
if(require.main===module)prepare().catch(e=>{console.error(e);process.exitCode=1});
module.exports={prepare};

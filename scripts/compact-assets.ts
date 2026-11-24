/** Build-only lossless raster compression. Authoring PNGs stay untouched. */
import {readdirSync} from 'node:fs'
import {readdir,stat,writeFile,mkdir,copyFile,readFile,rm} from 'node:fs/promises'
import path from 'node:path'
import {transformAsync,type PluginObj} from '@babel/core'
import sharp from 'sharp'
import type {Plugin} from 'vite'
import {writeOfflineResources} from './offline-resources'
import {writeWebAppFiles} from './web-app-assets'
import {fileDigest} from './file-digest'
import {findSharedFrameAtlases,isFrameClipManifest,shareFrameAtlasUrls,type SharedFrameAtlas} from './frame-atlas-assets'

const root=process.cwd(),sourceRoot=path.join(root,'public'),publicRoot=path.join(sourceRoot,'assets')
const names=new Set<string>()
function inventory(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())inventory(file);else if(entry.name.endsWith('.png')){names.add(entry.name);names.add(path.relative(publicRoot,file).replaceAll('\\','/'))}}}
inventory(publicRoot)
export function compactUrl(value:string):string {
 if(!value.endsWith('.png')||/^(https?:|data:)|^(?:\.\/|\/)?icons\//.test(value))return value
 const relative=value.replace(/^\.?\/?assets\//,'')
 return names.has(relative)||names.has(value)||names.has(path.posix.basename(value))?value.slice(0,-4)+'.webp':value
}
/** CSS lives under assets/, while packaged apps and subpath previews have no
 * website root. Resolve bundled art from the emitted stylesheet itself. */
export function bundledCssUrls(code:string,cssFile:string):string {
 return code.replace(/url\((['"]?)([^)'"\s]+)\1\)/g,(original,quote:string,url:string)=>{
  if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url))return original;
  let target=compactUrl(url);
  if(target.startsWith('/assets/')){
   target=path.posix.relative(path.posix.dirname(cssFile.replaceAll('\\','/')),target.slice(1));
   if(!target.startsWith('.'))target='./'+target;
  }
  return `url(${quote}${target}${quote})`;
 });
}
function imageLiterals():PluginObj {return {name:'lossless-image-urls',visitor:{
 StringLiteral(p){p.node.value=compactUrl(p.node.value)},
 TemplateLiteral(p){if(p.node.quasis.map(q=>q.value.cooked??q.value.raw).join('').includes('assets/'))for(const q of p.node.quasis){q.value.raw=q.value.raw.replaceAll('.png','.webp');if(q.value.cooked)q.value.cooked=q.value.cooked.replaceAll('.png','.webp')}}
}}}
async function files(dir:string):Promise<string[]>{const lists=await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]));return lists.flat()}
const sourceOnlyManifests=new Set([
 'assets/original/reading-books/layout.json', // The reader chunk includes the paper and hit boxes.
 'assets/original/reading-books/source.json',
 'assets/original/uploaded-actions/clips.json',
]);
function isSourceOnlyManifest(name:string){
 // The frame player loads the pose tables from bundled lazy modules.
 return sourceOnlyManifests.has(name)||isFrameClipManifest(name);
}
const publicName=(sourceRoot:string,file:string)=>path.relative(sourceRoot,file).split(path.sep).join('/');
function installedName(name:string){return name.startsWith('assets/')&&name.endsWith('.png')?name.slice(0,-4)+'.webp':name}

async function encodeLossless(file:string,target:string){
 const original=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 await sharp(file).webp({lossless:true,effort:4,alphaQuality:100}).toFile(target);
 const decoded=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(original.info.width!==decoded.info.width||original.info.height!==decoded.info.height)throw Error('Image dimensions changed: '+file);
 const source=original.data,output=decoded.data;
 for(let i=0;i<source.length;i+=4){
  const alpha=source[i+3];
  if(alpha!==output[i+3])throw Error('Alpha changed: '+file);
  if(alpha&&(source[i]!==output[i]||source[i+1]!==output[i+1]||source[i+2]!==output[i+2]))throw Error('Visible pixels changed: '+file);
 }
}

async function finishAssets(output:string,sharedFrameAtlases:SharedFrameAtlas[],webPanelFiles:string[]=[]){
  console.log('Compacting and verifying local assets…');
  // Stream the public library into the package, avoiding a multi-GB intermediate
  // copy of retired atlases. Source artwork and player data are never modified.
  const candidates=await files(sourceRoot);
  const shared=new Map(sharedFrameAtlases.map(atlas=>[atlas.file,atlas]));
  const omitted:string[]=[],expected:string[]=[];
  for(const {file,sharedWith,sha256} of sharedFrameAtlases){
   if(await fileDigest(path.join(sourceRoot,file))!==sha256)throw Error('Shared atlas changed during build: '+file);
   expected.push(sharedWith);
   await rm(path.join(output,file),{force:true});
  }
  let before=0,after=0;
  let previous:{files?:{file:string;sourceSha256:string;sha256:string;before:number;after:number}[]}={};
  try{previous=JSON.parse(await readFile(path.join(output,'asset-size-report.json'),'utf8'));}catch{}
  const verified=new Map((previous.files??[]).map(row=>[row.file,row]));
  const report:{file:string;before:number;after:number;sourceSha256:string;sha256:string}[]=[];
  // Verification needs two raw pixel buffers. Bound it to one image pair and
  // release libvips' cached operations before moving on to another atlas.
  const cache=sharp.cache(),concurrency=sharp.concurrency();
  sharp.cache(false);sharp.concurrency(1);
  try{
   for(const file of candidates){
    const relative=publicName(sourceRoot,file);
    if(isSourceOnlyManifest(relative)){
     omitted.push(relative);
     await rm(path.join(output,relative),{force:true});
     continue;
    }
    if(shared.has(relative))continue;
    const name=installedName(relative),target=path.join(output,name);
    expected.push(name);
    await mkdir(path.dirname(target),{recursive:true});
    if(name===relative){await copyFile(file,target);continue;}
    const sourceSha256=await fileDigest(file),old=verified.get(name);
    if(old?.sourceSha256===sourceSha256){try{if(await fileDigest(target)===old.sha256){report.push(old);before+=old.before;after+=old.after;continue;}}catch{}}
    await encodeLossless(file,target);
    const a=(await stat(file)).size,b=(await stat(target)).size;
    before+=a;after+=b;
    report.push({file:name,before:a,after:b,sourceSha256,sha256:await fileDigest(target)});
   }
  }finally{
   sharp.cache({memory:cache.memory.max,files:cache.files.max,items:cache.items.max});sharp.concurrency(concurrency);
  }
  for(const {sharedWith,sha256} of sharedFrameAtlases){
   if(await fileDigest(path.join(output,sharedWith))!==sha256)throw Error('Shared atlas output changed during build: '+sharedWith);
  }
  // Clean retired files from incremental build outputs as well.
  const directory=path.join(output,'assets');
  for(const file of await files(directory)){
   if(file.endsWith('.css')){const text=await readFile(file,'utf8');await writeFile(file,bundledCssUrls(text,path.relative(output,file)));}
  }
  const sharedAtlasBytes=sharedFrameAtlases.reduce((sum,atlas)=>sum+atlas.bytes,0);
  await writeFile(path.join(output,'asset-size-report.json'),JSON.stringify({format:'lossless WebP + original SWF',pixelVerification:'identical visible RGBA and all alpha values',omitted:omitted.sort(),sharedFrameAtlases,sharedAtlasBytes,supersededAtlasBytes:0,count:report.length,before,after,saved:before-after,files:report.sort((a,b)=>a.file.localeCompare(b.file))},null,2));
  if(process.env.VITE_WEB_APP==='1')await writeWebAppFiles(output,webPanelFiles);
  const bundled=await writeOfflineResources(output,expected);
  console.log(`Offline resources: ${bundled.files.length} local files; ${(bundled.bytes/1e6).toFixed(2)} MB; complete installation coverage verified.`);
  console.log(`Shared frame atlases: ${sharedFrameAtlases.length} identical copies; ${(sharedAtlasBytes/1e6).toFixed(2)} MB saved.`);
  console.log(`Lossless assets: ${report.length} images; ${(before/1e6).toFixed(2)} → ${(after/1e6).toFixed(2)} MB; all application raster fallbacks retained. Authoring library unchanged.`);
}

export function compactAssets():Plugin {
 let output='',emitted=false;
 let webPanelFiles:string[]=[];
 let shared:Map<string,SharedFrameAtlas>|undefined;
 const sharedAtlases=()=>shared??=new Map(findSharedFrameAtlases(sourceRoot).map(atlas=>[atlas.file,atlas]));
 return {name:'compact-original-assets',enforce:'pre',apply:'build',api:{finishAssets},
  config(){return {publicDir:false}},
  configResolved(config){output=path.resolve(config.root,config.build.outDir)},
  async transform(code,id){
   if(id.includes('node_modules'))return
   if(id.endsWith('.json')){
    let data;try{data=JSON.parse(code)}catch{return}
    const relative=publicName(sourceRoot,id);
    if(isFrameClipManifest(relative))data=shareFrameAtlasUrls(relative,data,sharedAtlases());
    return JSON.stringify(data,(_key,value)=>typeof value==='string'?compactUrl(value):value);
   }
   if(!id.includes('/src/')||!/[.]tsx?$/.test(id))return
   const result=await transformAsync(code,{filename:id,configFile:false,babelrc:false,plugins:[imageLiterals],parserOpts:{plugins:['typescript','jsx']},sourceMaps:true})
   return result?.code?{code:result.code,map:result.map}:undefined
  },
  generateBundle:{order:'post',handler(_options,bundle){
   if(process.env.VITE_WEB_APP!=='1')return;
   const panelEntry=[...this.getModuleIds()].find(id=>id.endsWith('/src/deferred-views.tsx'));
   const panelModules=new Set(panelEntry?this.getModuleInfo(panelEntry)?.dynamicallyImportedIds:[]);
   const files=new Set<string>();
   function include(file:string){
    if(files.has(file)||!bundle[file])return;
    files.add(file);
    const chunk=bundle[file];
    if(chunk.type!=='chunk')return;
    chunk.imports.forEach(include);
    chunk.viteMetadata?.importedCss.forEach(include);
   }
   for(const chunk of Object.values(bundle))if(chunk.type==='chunk'&&chunk.facadeModuleId&&
    (panelModules.has(chunk.facadeModuleId)||chunk.facadeModuleId.endsWith('/src/reading-page-layout.ts')))include(chunk.fileName);
   webPanelFiles=[...files].sort();
  }},
  writeBundle(){emitted=true},
  async closeBundle(){
   if(!emitted)return;
   const plan=process.env.MOLE_ASSET_BUILD_PLAN;
   const sharedFrameAtlases=[...sharedAtlases().values()];
   if(plan)await writeFile(plan,JSON.stringify({output,sharedFrameAtlases,webPanelFiles}));
   else await finishAssets(output,sharedFrameAtlases,webPanelFiles);
  },
 };
}

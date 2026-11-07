/** Build-only lossless raster compression. Authoring PNGs stay untouched. */
import {readdirSync,readFileSync} from 'node:fs'
import {readdir,stat,writeFile,unlink,mkdir,copyFile,readFile} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {transformAsync,type PluginObj} from '@babel/core'
import sharp from 'sharp'
import type {Plugin} from 'vite'

const root=process.cwd(),publicRoot=path.join(root,'public','assets')
const uploaded=JSON.parse(readFileSync(path.join(publicRoot,'original/uploaded-actions/index.json'),'utf8')) as Record<string,{id:string;form:string;assetKey:string}>
const manifest=JSON.parse(readFileSync(path.join(publicRoot,'original/official/manifest.json'),'utf8')) as {clips:{kind:string;path:string;level:number}[]}
const superseded=new Set(Object.values(uploaded).filter(spec=>spec.id!=='180005'&&manifest.clips.some(clip=>clip.kind==='care'&&clip.path.endsWith('/'+spec.id+'.swf')&&clip.level===({seed:1,junior:2,middle:3,senior:4,classic:101} as Record<string,number>)[spec.form])).map(spec=>spec.assetKey))
const names=new Set<string>()
function inventory(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())inventory(file);else if(entry.name.endsWith('.png')){names.add(entry.name);names.add(path.relative(publicRoot,file).replaceAll('\\','/'))}}}
inventory(publicRoot)
export function compactUrl(value:string):string {
 if(!value.endsWith('.png')||/^(https?:|data:)|^(?:\.\/|\/)?icons\//.test(value))return value
 const relative=value.replace(/^\.?\/?assets\//,'')
 return names.has(relative)||names.has(value)||names.has(path.posix.basename(value))?value.slice(0,-4)+'.webp':value
}
function imageLiterals():PluginObj {return {name:'lossless-image-urls',visitor:{
 StringLiteral(p){p.node.value=compactUrl(p.node.value)},
 TemplateLiteral(p){if(p.node.quasis.map(q=>q.value.cooked??q.value.raw).join('').includes('assets/'))for(const q of p.node.quasis){q.value.raw=q.value.raw.replaceAll('.png','.webp');if(q.value.cooked)q.value.cooked=q.value.cooked.replaceAll('.png','.webp')}}
}}}
async function files(dir:string):Promise<string[]>{const lists=await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]));return lists.flat()}
export function compactAssets():Plugin {
 let output=''
 return {name:'compact-original-assets',enforce:'pre',apply:'build',
 config(){return {publicDir:false}},
 configResolved(config){output=path.resolve(config.root,config.build.outDir)},
 async transform(code,id){
  if(id.includes('node_modules'))return
  if(id.endsWith('.json')){try{return JSON.stringify(JSON.parse(code),(_key,value)=>typeof value==='string'?compactUrl(value):value)}catch{return}}
  if(!id.includes('/src/')||!/[.]tsx?$/.test(id))return
  const result=await transformAsync(code,{filename:id,configFile:false,babelrc:false,plugins:[imageLiterals],parserOpts:{plugins:['typescript','jsx']},sourceMaps:true})
  return result?.code?{code:result.code,map:result.map}:undefined
 },
 async closeBundle(){
  // Stream the public library into the package, avoiding a multi-GB intermediate
  // copy of retired atlases. Source artwork and player data are never modified.
  const sourceRoot=path.join(root,'public'),candidates=await files(sourceRoot);
  let cursor=0,before=0,after=0;
  let previous:{files?:{file:string;sourceSha256:string;sha256:string;before:number;after:number}[]}={};
  try{previous=JSON.parse(await readFile(path.join(output,'asset-size-report.json'),'utf8'));}catch{}
  const verified=new Map((previous.files??[]).map(row=>[row.file,row]));
  const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
  const report:{file:string;before:number;after:number;sourceSha256:string;sha256:string}[]=[],omitted:{file:string;bytes:number}[]=[];
  async function worker(){while(cursor<candidates.length){
   const file=candidates[cursor++],relative=path.relative(sourceRoot,file).replaceAll('\\','/');
   const match=relative.match(/^assets\/original\/uploaded-actions\/([^/]+)\/(.+)$/);
   if(relative.startsWith('assets/original/wardrobe-motion/')||match&&superseded.has(match[1])&&/^(neutral|mask)[^/]*\.(png|webp)$/.test(match[2])){
    omitted.push({file:relative,bytes:(await stat(file)).size});continue;
   }
   const compress=relative.startsWith('assets/')&&file.endsWith('.png');
   const target=path.join(output,compress?relative.slice(0,-4)+'.webp':relative);
   await mkdir(path.dirname(target),{recursive:true});
   if(!compress){await copyFile(file,target);continue;}
   const sourceSha256=digest(await readFile(file)),old=verified.get(path.relative(output,target));
   if(old?.sourceSha256===sourceSha256){try{if(digest(await readFile(target))===old.sha256){report.push(old);before+=old.before;after+=old.after;continue;}}catch{}}
   const original=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   await sharp(file).webp({lossless:true,effort:4,alphaQuality:100}).toFile(target);
   const decoded=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   if(original.info.width!==decoded.info.width||original.info.height!==decoded.info.height)throw Error('Image dimensions changed: '+file);
   for(let i=0;i<original.data.length;i+=4){if(original.data[i+3]!==decoded.data[i+3])throw Error('Alpha changed: '+file);if(original.data[i+3]&&[0,1,2].some(k=>original.data[i+k]!==decoded.data[i+k]))throw Error('Visible pixels changed: '+file);}
   const a=(await stat(file)).size,b=(await stat(target)).size;before+=a;after+=b;report.push({file:path.relative(output,target),before:a,after:b,sourceSha256,sha256:digest(await readFile(target))});
  }}
  await Promise.all([worker(),worker()]);
  // Clean retired files from incremental build outputs as well.
  const directory=path.join(output,'assets');
  for(const file of await files(directory)){
   const relative=path.relative(directory,file).replaceAll('\\','/'),match=relative.match(/^original\/uploaded-actions\/([^/]+)\/(.+)$/);
   if(relative.startsWith('original/wardrobe-motion/')||match&&superseded.has(match[1])&&/^(neutral|mask)[^/]*\.(png|webp)$/.test(match[2]))await unlink(file);
   else if(file.endsWith('.css')){const {readFile}=await import('node:fs/promises');const text=await readFile(file,'utf8');await writeFile(file,text.replace(/url\((['"]?)([^)'"\s]+\.png)\1\)/g,(_all,quote,url)=>`url(${quote}${url.slice(0,-4)}.webp${quote})`));}
  }
  await writeFile(path.join(output,'asset-size-report.json'),JSON.stringify({format:'lossless WebP + original SWF',pixelVerification:'identical visible RGBA and all alpha values',omitted,supersededAtlasBytes:omitted.reduce((sum,row)=>sum+row.bytes,0),count:report.length,before,after,saved:before-after,files:report.sort((a,b)=>a.file.localeCompare(b.file))},null,2));
  console.log(`Lossless assets: ${report.length} images; ${(before/1e6).toFixed(2)} → ${(after/1e6).toFixed(2)} MB; ${omitted.length} superseded atlas files omitted. Authoring library unchanged.`);
 }
 }
}

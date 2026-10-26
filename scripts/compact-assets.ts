/** Build-only lossless raster compression. Authoring PNGs stay untouched. */
import {readdirSync,existsSync} from 'node:fs'
import {readdir,stat,writeFile,unlink} from 'node:fs/promises'
import path from 'node:path'
import {transformAsync,type PluginObj} from '@babel/core'
import sharp from 'sharp'
import type {Plugin} from 'vite'

const root=process.cwd(),publicRoot=path.join(root,'public','assets')
const names=new Set<string>()
function inventory(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())inventory(file);else if(entry.name.endsWith('.png')){names.add(entry.name);names.add(path.relative(publicRoot,file).replaceAll('\\','/'))}}}
inventory(publicRoot)
export function compactUrl(value:string):string {
 if(!value.endsWith('.png')||/^(https?:|data:)|(?:^|\/)icons\//.test(value))return value
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
 configResolved(config){output=path.resolve(config.root,config.build.outDir)},
 async transform(code,id){
  if(id.includes('node_modules'))return
  if(id.endsWith('.json')){try{return JSON.stringify(JSON.parse(code),(_key,value)=>typeof value==='string'?compactUrl(value):value)}catch{return}}
  if(!id.includes('/src/')||!/[.]tsx?$/.test(id))return
  const result=await transformAsync(code,{filename:id,configFile:false,babelrc:false,plugins:[imageLiterals],parserOpts:{plugins:['typescript','jsx']},sourceMaps:true})
  return result?.code?{code:result.code,map:result.map}:undefined
 },
 async closeBundle(){
  const directory=path.join(output,'assets');if(!existsSync(directory))return
  const candidates=(await files(directory)).filter(file=>file.endsWith('.png'));let cursor=0,before=0,after=0
  const report:{file:string;before:number;after:number}[]=[]
  async function worker(){while(cursor<candidates.length){const file=candidates[cursor++],target=file.slice(0,-4)+'.webp',original=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   await sharp(file).webp({lossless:true,effort:4,alphaQuality:100}).toFile(target)
   const decoded=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(original.info.width!==decoded.info.width||original.info.height!==decoded.info.height)throw Error('Image dimensions changed: '+file)
   for(let i=0;i<original.data.length;i+=4){if(original.data[i+3]!==decoded.data[i+3])throw Error('Alpha changed: '+file);if(original.data[i+3]&&[0,1,2].some(k=>original.data[i+k]!==decoded.data[i+k]))throw Error('Visible pixels changed: '+file)}
   const a=(await stat(file)).size,b=(await stat(target)).size;before+=a;after+=b;report.push({file:path.relative(output,target),before:a,after:b});await unlink(file)
  }}
  await Promise.all([worker(),worker(),worker(),worker()]);
  // Let Vite resolve public URLs relative to base:'./' first. Rewriting CSS
  // before that pass leaves absolute /assets URLs broken in packaged file://.
  for(const css of (await files(directory)).filter(file=>file.endsWith('.css'))){const {readFile}=await import('node:fs/promises');const text=await readFile(css,'utf8');await writeFile(css,text.replace(/url\((['"]?)([^)'"\s]+\.png)\1\)/g,(_all,quote,url)=>`url(${quote}${url.slice(0,-4)}.webp${quote})`))}
  await writeFile(path.join(output,'asset-size-report.json'),JSON.stringify({format:'lossless WebP',pixelVerification:'identical visible RGBA and all alpha values',count:report.length,before,after,saved:before-after,files:report.sort((a,b)=>a.file.localeCompare(b.file))},null,2))
  console.log(`Lossless assets: ${report.length} images; ${(before/1e6).toFixed(2)} → ${(after/1e6).toFixed(2)} MB; alpha and visible pixels verified.`)
 }
 }
}

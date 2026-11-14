import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {bundleFiles} from './bundle-files';
/** Called after all lossless art has finished, before the final resource index. */
export async function writeWebAppFiles(output:string){
 await mkdir(path.join(output,'icons'),{recursive:true});
 for(const size of [180,192,512])await sharp(path.join(output,'icons/ramu.png')).resize(size,size,{fit:'contain',background:'#fff5d9'}).png().toFile(path.join(output,`icons/ramu-${size}.png`));
 const manifest={id:'./',name:'拉姆小屋',short_name:'拉姆',description:'在小屋里照料拉姆、换装、玩耍和记录日常。',lang:'zh-CN',start_url:'./',scope:'./',display:'standalone',background_color:'#fff5d9',theme_color:'#f6d28d',icons:[192,512].map(size=>({src:`./icons/ramu-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))};
 await writeFile(path.join(output,'manifest.webmanifest'),JSON.stringify(manifest,null,2));
 await copyFile(path.resolve('docs/WEB-EXPERIENCE.md'),path.join(output,'部署说明.md'));
 const html=await readFile(path.join(output,'index.html'),'utf8');
 const shell=['index.html','manifest.webmanifest','icons/ramu.png','icons/ramu-180.png','icons/ramu-192.png','icons/ramu-512.png'];
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"[^>]*>/g))if(match[1].startsWith('./assets/')||match[1].startsWith('/assets/'))shell.push(match[1].replace(/^\.?\//,''));
 const template=await readFile(path.resolve('scripts/web-service-worker.js'),'utf8'),hash=createHash('sha256').update(template);
 for(const file of (await bundleFiles(output)).sort()){
  const name=path.relative(output,file).split(path.sep).join('/');if(name==='offline-resources.json'||name==='sw.js')continue;
  hash.update(name);hash.update(createHash('sha256').update(await readFile(file)).digest());
 }
 const version=hash.digest('hex').slice(0,24);
 await writeFile(path.join(output,'sw.js'),template.replace('/*__WEB_CONFIG__*/null',JSON.stringify({version,shell:[...new Set(shell)]})));
 return {version,manifest,shell:[...new Set(shell)]};
}

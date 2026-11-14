import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {bundleFiles} from './bundle-files';

export interface OfflineResource {path:string;bytes:number;sha256:string}
export interface OfflineResources {schema:1;revision:string;bytes:number;files:OfflineResource[]}
/** Index the final installation bytes, including the engine and every raster
 * fallback. This is a verification list, never an on-demand download list. */
export async function writeOfflineResources(root:string,expected:string[]=[]):Promise<OfflineResources>{
 const relative=(file:string)=>path.relative(root,file).split(path.sep).join('/');
 const names=(await bundleFiles(root)).filter(file=>relative(file)!=='offline-resources.json');
 const found=new Set(names.map(relative));
 for(const name of expected)if(!found.has(name))throw Error('安装包缺少本地素材：'+name);
 const entries:OfflineResource[]=[];
 for(const file of names.sort())entries.push({path:relative(file),bytes:(await stat(file)).size,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 const output:OfflineResources={schema:1,revision:createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,24),bytes:entries.reduce((sum,entry)=>sum+entry.bytes,0),files:entries};
 await writeFile(path.join(root,'offline-resources.json'),JSON.stringify(output));return output;
}

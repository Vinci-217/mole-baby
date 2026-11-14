import {afterEach,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeOfflineResources} from './offline-resources';
const roots:string[]=[];afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})))});
it('indexes exact final bytes and rejects a material omitted from installation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ram-offline-'));roots.push(root);await mkdir(path.join(root,'assets'));
 await writeFile(path.join(root,'assets/engine.wasm'),'original engine');await writeFile(path.join(root,'index.html'),'local shell');
 const first=await writeOfflineResources(root,['assets/engine.wasm','index.html']);
 expect(first.files).toHaveLength(2);expect(first.files.find(row=>row.path==='assets/engine.wasm')?.sha256).toBe(createHash('sha256').update('original engine').digest('hex'));
 expect((await writeOfflineResources(root)).revision).toBe(first.revision);
 await expect(writeOfflineResources(root,['assets/missing.swf'])).rejects.toThrow('安装包缺少');
 expect(JSON.parse(await readFile(path.join(root,'offline-resources.json'),'utf8')).revision).toBe(first.revision);
});

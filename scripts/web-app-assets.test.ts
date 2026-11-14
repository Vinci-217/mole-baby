import {afterEach,expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {writeWebAppFiles} from './web-app-assets';
import {writeOfflineResources} from './offline-resources';

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})))});
async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'ram-web-bundle-'));roots.push(root);
 await mkdir(path.join(root,'icons'));await mkdir(path.join(root,'assets'));
 await copyFile('public/icons/ramu.png',path.join(root,'icons/ramu.png'));
 await writeFile(path.join(root,'index.html'),'<script type="module" src="./assets/main.js"></script><link rel="stylesheet" href="./assets/main.css">');
 await writeFile(path.join(root,'assets/main.js'),'original application');await writeFile(path.join(root,'assets/main.css'),'original style');return root;
}
it('ships installable icons and a relative shell that works under a deployed subdirectory',async()=>{
 const root=await fixture(),{manifest,shell}=await writeWebAppFiles(root);
 expect(manifest.display).toBe('standalone');expect(manifest.start_url).toBe('./');expect(manifest.scope).toBe('./');
 expect(shell).toContain('assets/main.js');expect(shell).toContain('assets/main.css');
 for(const size of [180,192,512]){const meta=await sharp(path.join(root,`icons/ramu-${size}.png`)).metadata();expect([meta.width,meta.height]).toEqual([size,size])}
 for(const base of ['https://example.com/','https://example.com/mole-baby/']){
  const url=new URL('manifest.webmanifest',base);expect(new URL(manifest.start_url,url).href).toBe(base);
  for(const icon of manifest.icons)expect(new URL(icon.src,url).href).toBe(base+icon.src.slice(2));
 }
});
it('versions changed original bytes even when the asset filename stays the same',async()=>{
 const root=await fixture(),first=await writeWebAppFiles(root);
 expect((await writeWebAppFiles(root)).version).toBe(first.version);
 await writeFile(path.join(root,'assets/main.js'),'updated original application');
 const second=await writeWebAppFiles(root);expect(second.version).not.toBe(first.version);
 const worker=await readFile(path.join(root,'sw.js'),'utf8');expect(worker).toContain(second.version);expect(worker).not.toContain('/*__WEB_CONFIG__*/null');
});
it('keeps local installer downloads and symlinks out of the PWA version and runtime index',async()=>{
 const root=await fixture(),first=await writeWebAppFiles(root);
 await mkdir(path.join(root,'downloads'));
 await writeFile(path.join(root,'downloads','Setup.exe'),'installer delivery');
 await symlink(path.join(root,'assets'),path.join(root,'downloads','windows'),'dir');
 expect((await writeWebAppFiles(root)).version).toBe(first.version);
 const index=await writeOfflineResources(root,['assets/main.js']);
 expect(index.files.some(file=>file.path.startsWith('downloads/'))).toBe(false);
 expect(index.files.find(file=>file.path==='assets/main.js')).toBeDefined();
});

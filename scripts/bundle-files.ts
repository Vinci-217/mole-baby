import {readdir} from 'node:fs/promises';
import path from 'node:path';

/** Only runtime output participates in resource hashes and PWA versions.
 * A local downloads/ directory can contain symlinks to large release files;
 * those are a delivery service and must never enter the application bundle. */
export async function bundleFiles(root:string):Promise<string[]>{
 const visit=async(directory:string):Promise<string[]>=>{
  const lists=await Promise.all((await readdir(directory,{withFileTypes:true})).filter(entry=>directory!==root||entry.name!=='downloads').map(entry=>{
   const file=path.join(directory,entry.name);
   if(entry.isDirectory())return visit(file);
   if(entry.isFile())return [file];
   throw Error('Unexpected link in application output: '+path.relative(root,file));
  }));
  return lists.flat();
 };
 return visit(root);
}

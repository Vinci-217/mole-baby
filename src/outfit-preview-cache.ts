/** Exact painted original frames cover engine startup, including after a
 * restart. This bounded cache has its own database, separate from pet saves. */
const entries=new Map<string,string>();
const listeners=new Map<string,Set<()=>void>>(),pending=new Map<string,Promise<string|undefined>>();
const MAX_BYTES=12*1024*1024,MAX_ENTRIES=32;
const DISK_BYTES=64*1024*1024,DISK_ENTRIES=96;
let bytes=0;
let database:Promise<IDBDatabase>|undefined,writes=Promise.resolve();
const validImage=(image:unknown):image is string=>typeof image==='string'&&image.startsWith('data:image/png;base64,')&&image.length>=100&&image.length*2<=8*1024*1024;
function openCache():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')return Promise.reject(new Error('Image cache unavailable'));
 return database??=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('ramu-original-frame-cache-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('frames',{keyPath:'key'});
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=undefined};resolve(db)};
  request.onerror=()=>{database=undefined;reject(request.error)};
  request.onblocked=()=>{database=undefined;reject(new Error('Image cache busy'))};
 });
}
async function persist(key:string,image:string){
 const db=await openCache();
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('frames','readwrite'),store=tx.objectStore('frames'),request=store.getAll();
  request.onsuccess=()=>{
   store.put({key,image,at:Date.now()});let total=image.length*2,count=1;
   for(const row of request.result.filter(row=>row.key!==key).sort((a,b)=>b.at-a.at)){
    if(validImage(row.image)&&count<DISK_ENTRIES&&total+row.image.length*2<=DISK_BYTES){count++;total+=row.image.length*2}
    else store.delete(row.key);
   }
  };
  tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);
 });
}
export const outfitPreviewKey=(source:string,color:readonly number[])=>`${source}:${color.join(',')}`;
export function outfitPreview(key:string):string|undefined{
 const value=entries.get(key);if(value){entries.delete(key);entries.set(key,value)}return value;
}
function cache(key:string,image:unknown):boolean{
 if(!validImage(image))return false;
 const previous=entries.get(key);if(previous){entries.delete(key);bytes-=previous.length*2}
 while(entries.size&&(bytes+image.length*2>MAX_BYTES||entries.size>=MAX_ENTRIES)){
  const oldest=entries.keys().next().value!,value=entries.get(oldest)!;entries.delete(oldest);bytes-=value.length*2;
 }
 entries.set(key,image);bytes+=image.length*2;return true;
}
export function subscribeOutfitPreview(key:string,listener:()=>void){
 const group=listeners.get(key)??new Set<()=>void>();group.add(listener);listeners.set(key,group);
 return()=>{group.delete(listener);if(!group.size)listeners.delete(key)};
}
function announce(key:string){for(const listener of listeners.get(key)??[])listener();}
export function rememberOutfitPreview(key:string,image:unknown):boolean{
 if(!validImage(image))return false;
 const unchanged=entries.get(key)===image;cache(key,image);
 if(!unchanged)announce(key);
 if(!unchanged&&typeof indexedDB!=='undefined')writes=writes.then(()=>persist(key,image)).catch(()=>{/* Optional cache failures never affect the live animation or save. */});
 return true;
}
export async function loadOutfitPreview(key:string):Promise<string|undefined>{
 const hit=outfitPreview(key);if(hit)return hit;
 const existing=pending.get(key);if(existing)return existing;
 const request=readPreview(key).finally(()=>{pending.delete(key)});pending.set(key,request);return request;
}
async function readPreview(key:string):Promise<string|undefined>{
 try{
  const db=await openCache();
  const row=await new Promise<{image?:unknown}|undefined>((resolve,reject)=>{const tx=db.transaction('frames','readonly'),request=tx.objectStore('frames').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  // A slow disk read must not overwrite a newer live frame of this outfit.
  const current=outfitPreview(key);if(current)return current;
  if(row&&cache(key,row.image)){announce(key);return row.image as string;}
 }catch{/* Rebuild a missing or unavailable cache from the bundled original. */}
 return undefined;
}

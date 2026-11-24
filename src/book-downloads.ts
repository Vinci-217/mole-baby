import {useEffect,useState} from 'react';

export interface CachedBookPages {sources:Record<string,string>;dispose?:()=>void}
export interface BookDownloads {
 getStatus():Promise<BookDownloadStatus>;
 downloadAll():Promise<BookDownloadStatus>;
 pauseAll():Promise<BookDownloadStatus>;
 onStatus(callback:(status:BookDownloadStatus)=>void):()=>void;
 prepare(id:string):Promise<CachedBookPages|null>;
}

interface Page {file:string;offset:number;bytes:number}
interface Pack {id:string;sha256:string;bytes:number;pages:Page[]}
interface Index {schema:1;release:string;books:Pack[]}
const cacheName='mole-baby-optional-books-v1';
const maxBook=32*1024*1024;
const url=(relative:string)=>new URL(relative,document.baseURI).href;
const cacheKey=(pack:Pack)=>url(`./book-cache/${pack.sha256}.zip`);
const sha256=async (buffer:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),
 byte=>byte.toString(16).padStart(2,'0')).join('');

function validated(index:Index){
 if(index?.schema!==1||!/^assets-[a-f0-9]{24}$/.test(index.release)||!Array.isArray(index.books)||!index.books.length)throw Error('Invalid book catalog');
 const books=new Map<string,Pack>();
 for(const book of index.books){
  if(!/^[a-z0-9-]+$/.test(book.id)||!/^[a-f0-9]{64}$/.test(book.sha256)||books.has(book.id)||
     !Number.isSafeInteger(book.bytes)||book.bytes<1||book.bytes>maxBook||!Array.isArray(book.pages)||!book.pages.length)throw Error('Invalid book pack');
  for(const page of book.pages)if(!/^[a-z0-9_-]+\.(?:png|webp)$/.test(page.file)||
     !Number.isSafeInteger(page.offset)||page.offset<1||!Number.isSafeInteger(page.bytes)||page.bytes<1||
     page.bytes>book.bytes-page.offset)throw Error('Invalid book page');
  books.set(book.id,book);
 }
 return {books,release:index.release,totalBytes:index.books.reduce((sum,book)=>sum+book.bytes,0)};
}

async function readBook(response:Response,pack:Pack){
 if(!response.ok||!response.body)throw Error('Book download failed');
 const reader=response.body.getReader(),bytes=new Uint8Array(pack.bytes);
 let length=0;
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   if(length+value.length>bytes.length)throw Error('Unexpected book size');
   bytes.set(value,length);length+=value.length;
  }
 }finally{await reader.cancel().catch(()=>{})}
 if(length!==pack.bytes||await sha256(bytes.buffer)!==pack.sha256)throw Error('Book verification failed');
 return bytes;
}

/** A separate cache survives replacement of the PWA shell and the Android APK. */
function browserBookDownloads():BookDownloads{
 let catalogue:Promise<ReturnType<typeof validated>>|undefined;
 let phase:BookDownloadStatus['phase']='idle',batch:{pause:boolean}|undefined;
 const listeners=new Set<(status:BookDownloadStatus)=>void>();
 const index=()=>{
  catalogue??=fetch(url('./book-packs.json')).then(response=>{
   if(!response.ok)throw Error('Book index unavailable');
   return response.json() as Promise<Index>;
  }).then(validated).catch(error=>{catalogue=undefined;throw error});
  return catalogue;
 };
 async function getStatus(){
  const {books,totalBytes}=await index(),cache=await caches.open(cacheName);
  const available=new Set((await cache.keys()).map(request=>request.url));
  let downloaded=0,downloadedBytes=0;
  for(const book of books.values())if(available.has(cacheKey(book))){downloaded++;downloadedBytes+=book.bytes;}
  return {phase,downloaded,total:books.size,downloadedBytes,totalBytes};
 }
 function publish(status:BookDownloadStatus){listeners.forEach(listener=>listener(status));return status}
 async function download(run:{pause:boolean}){
  try{
   const {books,release}=await index(),cache=await caches.open(cacheName);
   for(const book of books.values()){
    if(run.pause)break;
    const key=cacheKey(book);
    if(await cache.match(key))continue;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
    try{
     const reply=await fetch(url(`./optional-books/${release}/books-${book.id}-1.zip`),{cache:'no-store',signal:controller.signal});
     const bytes=await readBook(reply,book);
     await cache.put(key,new Response(bytes));
    }finally{clearTimeout(timer)}
    publish(await getStatus());
   }
   phase=run.pause?'paused':'idle';
  }catch{phase=run.pause?'paused':'error'}
  finally{batch=undefined;publish(await getStatus())}
 }
 return {
  getStatus,
  async downloadAll(){
   const snapshot=await getStatus();
   if(batch)return {...snapshot,phase};
   const run={pause:false};batch=run;phase='downloading';
   const status=publish({...snapshot,phase});
   void download(run).catch(()=>{});
   return status;
  },
  async pauseAll(){
   if(batch){batch.pause=true;phase='pausing'}
   return publish(await getStatus());
  },
  onStatus(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  async prepare(id){
   const book=(await index()).books.get(id);
   if(!book)return null;
   const cache=await caches.open(cacheName),key=cacheKey(book);
   const response=await cache.match(key);
   if(!response)return null;
   let bytes;
   try{bytes=await readBook(response,book)}
   catch{await cache.delete(key);publish(await getStatus());return null}
   const sources=Object.fromEntries(book.pages.map(page=>{
    const file=bytes.buffer.slice(page.offset,page.offset+page.bytes);
    const [stem,kind]=page.file.split('.');
    return [stem,URL.createObjectURL(new Blob([file],{type:`image/${kind}`}))];
   }));
   return {sources,dispose:()=>Object.values(sources).forEach(source=>URL.revokeObjectURL(source))};
  },
 };
}

let service:BookDownloads|undefined;
export function bookDownloads(){
 if(service)return service;
 const desktop=window.desktop;
 if(desktop?.bookDownloads&&desktop.prepareBookPages){
  const prepare=desktop.prepareBookPages;
  service={...desktop.bookDownloads, async prepare(id){
   const sources=await prepare(id);
   return sources?{sources}:null;
  }};
 }else if(document.querySelector('meta[name="ramu-book-packs"]'))service=browserBookDownloads();
 return service;
}

export function useBookDownloads(visible:boolean){
 const downloads=bookDownloads();
 const [status,setStatus]=useState<BookDownloadStatus>();
 const [unavailable,setUnavailable]=useState(false);
 useEffect(()=>{
  if(!downloads||!visible)return;
  let received=false,live=true;
  const off=downloads.onStatus(state=>{received=true;setStatus(state);setUnavailable(false)});
  void downloads.getStatus().then(state=>{
   if(live&&!received){setStatus(state);setUnavailable(false)}
  },()=>{if(live&&!received){setStatus(undefined);setUnavailable(true)}});
  return()=>{live=false;off()};
 },[downloads,visible]);
 return {downloads,status,unavailable,unlocked:!downloads||Boolean(status&&status.downloaded===status.total)};
}

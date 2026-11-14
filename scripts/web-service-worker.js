/* Generated with a content version; only application files enter these caches. */
const CONFIG=/*__WEB_CONFIG__*/null;
const CORE_PREFIX='mole-baby-web-core-',MEDIA_PREFIX='mole-baby-web-media-';
const CORE=CORE_PREFIX+CONFIG.version,MEDIA=MEDIA_PREFIX+CONFIG.version;
const scope=new URL(self.registration.scope),indexURL=new URL('index.html',scope).href;
let writes=Promise.resolve();
const ownCache=name=>name.startsWith(CORE_PREFIX)||name.startsWith(MEDIA_PREFIX);

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CORE).then(cache=>cache.addAll(CONFIG.shell.map(file=>new Request(new URL(file,scope),{cache:'no-cache'})))));
 // Wait for old windows to close: never mix new original files into an active
 // old application by forcing skipWaiting or reloading a player's open game.
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  for(const name of await caches.keys())if(ownCache(name)&&name!==CORE&&name!==MEDIA)await caches.delete(name);
  await self.clients.claim();
 })());
});
function keyFor(url){
 const key=new URL(url);key.hash='';
 if(key.pathname.endsWith('/assets/original/official/runtime.html')){key.searchParams.delete('token');key.searchParams.delete('restart')}
 return key.href;
}
const pinned=url=>/\.wasm(?:\?|$)|\/ruffle\/[^/]+\.js(?:\?|$)|\/official\/controller\.swf(?:\?|$)/.test(url);
async function cachedAsset(key){try{return await(await caches.open(CORE)).match(key)||await(await caches.open(MEDIA)).match(key)}catch{return undefined}}
function remember(key,response){
 writes=writes.then(async()=>{
  // Chromium can reject a streamed WASM response in Cache.put even while the
  // original stream compiles successfully. Buffer this one engine copy; keep
  // the live response streaming so the player's first frame is not delayed.
  if(/\.wasm(?:\?|$)/.test(key)){
   const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
   response=new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers});
  }
  const cache=await caches.open(MEDIA);await cache.put(key,response);
  const keys=await cache.keys();let count=keys.length;
  for(const request of keys){if(count<=128)break;if(!pinned(request.url)){await cache.delete(request);count--}}
 }).catch(()=>{/* Cache eviction/quota failures never block the live game. */});
 return writes;
}
function fromCache(response,html=false){
 if(!html)return response;
 // A cached iframe carries another mount's token in Response.url. A fresh
 // Response preserves the requested document URL and its current handshake.
 const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
self.addEventListener('fetch',event=>{
 const {request}=event,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const relative=url.pathname.slice(scope.pathname.length);
 const appNavigation=request.mode==='navigate'&&(relative===''||relative==='index.html');
 if(appNavigation){
  event.respondWith((async()=>{
   const cached=await cachedAsset(indexURL);if(cached)return fromCache(cached,true);
   try{return await fetch(request)}catch{return new Response('<!doctype html><meta charset="utf-8"><p>页面尚未缓存，请联网打开一次。原有存档仍保存在此浏览器中。</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})}
  })());return;
 }
 if(!relative.startsWith('assets/')&&!relative.startsWith('icons/')&&relative!=='manifest.webmanifest')return;
 event.respondWith((async()=>{
  const key=keyFor(url),cached=await cachedAsset(key);
  if(cached)return fromCache(cached,relative.endsWith('.html'));
  const response=await fetch(request);
  // Never permanently cache an auth page or an SPA fallback for missing art.
  const html=response.headers.get('Content-Type')?.includes('text/html');
  if(response.status===200&&(!html||relative.endsWith('.html')))event.waitUntil(remember(key,response.clone()));
  return response;
 })());
});

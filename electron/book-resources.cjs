const fs = require('node:fs');
const files = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const github = 'https://github.com/Vinci-217/mole-baby/releases/download';
const validId = /^[a-z0-9-]+$/;
const validImage = /^[a-z0-9_-]+\.(?:webp|png)$/;
const maxPackBytes = 32 * 1024 * 1024;

function validateManifest(manifest) {
  if (manifest?.schema !== 1 || !/^assets-[a-f0-9]{24}$/.test(manifest.release) || !Array.isArray(manifest.books))
    throw new Error('Invalid book resource index');
  const packs = new Map();
  for (const pack of manifest.books) {
    if (typeof pack?.id !== 'string' || !validId.test(pack.id) || packs.has(pack.id) || !/^[a-f0-9]{64}$/.test(pack.sha256) ||
        !Number.isSafeInteger(pack.bytes) || pack.bytes < 1 || pack.bytes > maxPackBytes ||
        !Array.isArray(pack.pages) || !pack.pages.length) throw new Error('Invalid book resource pack');
    const pages = new Map();
    for (const page of pack.pages) {
      const stem = typeof page?.file === 'string' ? path.posix.parse(page.file).name : '';
      if (!stem || !validImage.test(page.file) || pages.has(stem) ||
          !Number.isSafeInteger(page.offset) || page.offset < 1 ||
          !Number.isSafeInteger(page.bytes) || page.bytes < 1 || page.bytes > pack.bytes - page.offset)
        throw new Error('Invalid book page location');
      pages.set(stem, page);
    }
    packs.set(pack.id, { ...pack, pages, url: `${github}/${manifest.release}/books-${pack.id}-1.zip` });
  }
  return packs;
}

async function fileSize(file) {
  try { return (await files.stat(file)).size; }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
}

async function matchesPack(file, pack) {
  if (await fileSize(file) !== pack.bytes) return false;
  const hash = createHash('sha256');
  for await (const block of fs.createReadStream(file)) hash.update(block);
  return hash.digest('hex') === pack.sha256;
}

function limiter(max) {
  const waiting = [];
  let running = 0;
  return async work => {
    if (running >= max) await new Promise(resolve => waiting.push(resolve));
    else running++;
    try { return await work(); }
    finally { const next = waiting.shift(); if (next) next(); else running--; }
  };
}

async function downloadPack(request, url, partial, pack) {
  let offset = await fileSize(partial);
  if (offset >= pack.bytes) {
    if (await matchesPack(partial, pack)) return;
    await files.rm(partial, { force: true });
    offset = 0;
  }
  const response = await request(url, { headers: offset ? { Range: `bytes=${offset}-` } : {},
    signal: AbortSignal.timeout(90_000) });
  const cancel = () => response.cancel ? response.cancel() : response.body?.cancel();
  if (offset && response.status === 416) {
    await cancel();
    await files.rm(partial, { force: true });
    return downloadPack(request, url, partial, pack);
  }
  if (response.status === 200) offset = 0;
  else if (response.status !== 206 || !offset ||
      response.headers.get('content-range') !== `bytes ${offset}-${pack.bytes - 1}/${pack.bytes}`) {
    await cancel();
    throw new Error(`Book resource transfer failed (${response.status})`);
  }
  if (!response.stream&&!response.body) throw new Error('Book resource body missing');
  let seen = offset;
  await pipeline(response.stream??Readable.fromWeb(response.body), new Transform({
    transform(block, _encoding, callback) {
      seen += block.length;
      if (seen > pack.bytes) callback(new Error('Book resource exceeds expected size'));
      else callback(null, block);
    },
  }), fs.createWriteStream(partial, { flags: offset ? 'a' : 'w' }));
  if (seen < pack.bytes) throw new Error('Book resource transfer interrupted');
  if (!await matchesPack(partial, pack)) {
    await files.rm(partial, { force: true });
    throw new Error('Book resource checksum mismatch');
  }
}

function createBookResources({ manifest, directory, request, mirrors = {}, onStatus = () => {} }) {
  const packs = validateManifest(manifest);
  const ready = new Map(), pending = new Map();
  const cached = new Set();
  const schedule = limiter(2);
  const totalBytes = [...packs.values()].reduce((total, pack) => total + pack.bytes, 0);
  const cacheFile = pack => path.join(directory, pack.sha256 + '.zip');
  let inventory, batch, downloadedBytes = 0, phase = 'idle';

  function status() {
    return { phase, downloaded: cached.size, total: packs.size, downloadedBytes, totalBytes };
  }

  function markCached(pack, present) {
    if (cached.has(pack.id) === present) return;
    if (present) cached.add(pack.id);
    else cached.delete(pack.id);
    downloadedBytes += present ? pack.bytes : -pack.bytes;
  }

  async function getStatus() {
    inventory ??= Promise.all([...packs.values()].map(async pack => {
      if (await fileSize(cacheFile(pack)) === pack.bytes) markCached(pack, true);
    })).catch(error => { inventory = undefined; throw error; });
    await inventory;
    return status();
  }

  async function cachePages(pack, allowDownload) {
    await getStatus();
    const file = cacheFile(pack);
    if (!await matchesPack(file, pack)) {
      ready.delete(pack.id);
      markCached(pack, false);
      onStatus(status());
      if (!allowDownload) return null;
      await files.mkdir(directory, { recursive: true });
      await files.rm(file, { force: true });
      const partial = file + '.partial';
      let mirror;
      try { if (Object.hasOwn(mirrors, pack.id)) mirror = new URL(mirrors[pack.id]); } catch {}
      const sources = mirror?.protocol === 'https:' ? [mirror.href, pack.url] : [pack.url];
      let failure;
      for (const source of sources) {
        try {
          await downloadPack(request, source, partial, pack);
          await files.rename(partial, file);
          failure = null;
          break;
        } catch (error) { failure = error; }
      }
      if (failure) throw failure;
    }
    ready.set(pack.id, file);
    markCached(pack, true);
    onStatus(status());
    return Object.fromEntries([...pack.pages].map(([stem, page]) =>
      [stem, `ram-book://pages/${pack.id}/${page.file}?v=${pack.sha256}`]));
  }

  function prepare(id) {
    const pack = typeof id === 'string' && packs.get(id);
    if (!pack) return Promise.reject(new Error('Unknown book resource'));
    if (!pending.has(id)) {
      const task = schedule(() => cachePages(pack, true)).finally(() => pending.delete(id));
      pending.set(id, task);
    }
    return pending.get(id);
  }

  function prepareCached(id) {
    const pack = typeof id === 'string' && packs.get(id);
    return pack ? pending.get(id)??cachePages(pack, false) : Promise.resolve(null);
  }

  async function downloadAll() {
    await getStatus();
    if (batch) return status();
    const run = { pauseRequested: false };
    batch = run;
    phase = 'downloading';
    onStatus(status());
    void downloadBatch(run);
    return status();
  }

  async function downloadBatch(run) {
    try {
      for (const pack of packs.values()) {
        if (run.pauseRequested) break;
        await prepare(pack.id);
      }
      phase = run.pauseRequested && cached.size < packs.size ? 'paused' : 'idle';
    } catch {
      phase = run.pauseRequested ? 'paused' : 'error';
    } finally {
      batch = undefined;
      onStatus(status());
    }
  }

  function pauseAll() {
    if (batch) {
      batch.pauseRequested = true;
      phase = 'pausing';
      onStatus(status());
    }
    return status();
  }

  async function readPage(input) {
    const url = new URL(input);
    if (url.protocol !== 'ram-book:' || url.hostname !== 'pages') return null;
    const match = url.pathname.match(/^\/([a-z0-9-]+)\/([a-z0-9_-]+)\.(webp|png)$/);
    if (!match) return null;
    const [, id, stem, extension] = match;
    const pack = packs.get(id), page = pack?.pages.get(stem), file = ready.get(id);
    if (!file || !page || page.file !== `${stem}.${extension}` || url.searchParams.get('v') !== pack.sha256) return null;
    const handle = await files.open(file, 'r');
    try {
      const data = Buffer.alloc(page.bytes);
      const { bytesRead } = await handle.read(data, 0, data.length, page.offset);
      if (bytesRead !== data.length) throw new Error('Incomplete cached book page');
      return { data, mimeType: `image/${extension}` };
    } finally { await handle.close(); }
  }
  return { prepare, prepareCached, readPage, getStatus, downloadAll, pauseAll };
}

function requestBookPack(net,url,{headers,signal}){
  if(typeof net.fetch==='function')return net.fetch(url,{headers,signal});
  return new Promise((resolve,reject)=>{
    const request=net.request({url,redirect:'follow'});
    let stream;
    const abort=()=>{
      const error=new Error('Book resource transfer canceled');
      stream?.destroy(error);
      request.abort();
      reject(error);
    };
    if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    const cleanup=()=>signal.removeEventListener('abort',abort);
    for(const [name,value] of Object.entries(headers))request.setHeader(name,value);
    request.once('error',error=>{cleanup();reject(error)});
    request.once('response',reply=>{
      stream=reply;
      reply.once('close',cleanup);reply.once('end',cleanup);
      resolve({status:reply.statusCode,headers:{get:name=>reply.headers[name]?.[0]??null},stream:reply,cancel:()=>request.abort()});
    });
    request.end();
  });
}

module.exports = { createBookResources, requestBookPack };

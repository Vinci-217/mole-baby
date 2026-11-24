const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { EventEmitter, once } = require('node:events');
const { Readable } = require('node:stream');
const { createBookResources, requestBookPack } = require('./book-resources.cjs');

const pageData = Buffer.from('lossless test page');
const data = Buffer.concat([Buffer.alloc(48), pageData, Buffer.alloc(30)]);
const sha256 = createHash('sha256').update(data).digest('hex');
const pack = { id: 'home', bytes: data.length, sha256, pages: [{ file: '1.webp', offset: 48, bytes: pageData.length }] };
const manifest = { schema: 1, release: 'assets-' + 'a'.repeat(24), books: [pack] };

async function fixture(t, options) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ramu-book-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, service: createBookResources({ manifest, directory, ...options }) };
}

test('coalesces two openings and serves a verified local page after offline restart', async t => {
  let requests = 0;
  const { directory, service } = await fixture(t, { request: async () => { requests++; return new Response(data); } });
  const [first, second] = await Promise.all([service.prepare('home'), service.prepare('home')]);
  assert.equal(requests, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(await service.readPage(first['1']), { data: pageData, mimeType: 'image/webp' });
  assert.equal(await service.readPage(first['1'].replace(sha256, 'old')), null);
  assert.equal(await service.readPage('ram-book://pages/home/%2e%2e%2fsave.json'), null);
  assert.equal(await service.readPage(first['1'].replace('1.webp', '2.webp')), null);
  await assert.rejects(service.prepare('../save'), /Unknown book/);
  const reopened = createBookResources({ manifest, directory, request: () => assert.fail('The cached book should not use the network') });
  assert.deepEqual(await reopened.prepare('home'), first);
  assert.deepEqual(await reopened.readPage(first['1']), { data: pageData, mimeType: 'image/webp' });
});

test('an interrupted book resumes from the last downloaded byte', async t => {
  const offset = 32;
  const ranges = [];
  const { directory, service } = await fixture(t, {
    request: async (_url, { headers }) => {
      ranges.push(headers.Range);
      if (!headers.Range) return new Response(data.subarray(0, offset));
      return new Response(data.subarray(offset), { status: 206,
        headers: { 'Content-Range': `bytes ${offset}-${data.length - 1}/${data.length}` } });
    },
  });
  await assert.rejects(service.prepare('home'), /interrupted/);
  assert.deepEqual(await fs.readdir(directory), [sha256 + '.zip.partial']);
  const pages = await service.prepare('home');
  assert.deepEqual(ranges, [undefined, 'bytes=32-']);
  assert.deepEqual(await fs.readdir(directory), [sha256 + '.zip']);
  assert.deepEqual((await service.readPage(pages['1'])).data, pageData);
});

test('a corrupt mirror cannot expose pages and falls back to GitHub', async t => {
  const requests = [];
  const { service } = await fixture(t, {
    mirrors: { home: 'https://mirror.example/home.zip' },
    request: async (url, { headers }) => {
      requests.push(url);
      assert.equal(headers.Range, undefined, 'Corrupt bytes must be discarded');
      return new Response(requests.length === 1 ? Buffer.alloc(data.length) : data);
    },
  });
  const pages = await service.prepare('home');
  assert.deepEqual(requests, ['https://mirror.example/home.zip',
    'https://github.com/Vinci-217/mole-baby/releases/download/assets-' + 'a'.repeat(24) + '/books-home-1.zip']);
  assert.deepEqual((await service.readPage(pages['1'])).data, pageData);
});

test('settings start and pause a batch while retaining the finished book', { timeout: 4000 }, async t => {
  const otherData = Buffer.concat([data, Buffer.from('new book')]);
  const second = { ...pack, id: 'second', bytes: otherData.length,
    sha256: createHash('sha256').update(otherData).digest('hex') };
  const events = new EventEmitter();
  const requests = [];
  let returnFirst;
  const firstResponse = new Promise(resolve => { returnFirst = resolve; });
  const { service } = await fixture(t, {
    manifest: { ...manifest, books: [pack, second] },
    onStatus: status => events.emit(status.phase, status),
    request: async url => {
      requests.push(url.split('/').at(-1));
      events.emit('request');
      return requests.length === 1 ? firstResponse : new Response(otherData);
    },
  });
  assert.equal((await service.getStatus()).downloaded, 0);
  assert.deepEqual(requests, []);
  const firstRequest = once(events, 'request');
  assert.equal((await service.downloadAll()).phase, 'downloading');
  await firstRequest;
  assert.equal(service.pauseAll().phase, 'pausing');
  const paused = once(events, 'paused');
  returnFirst(new Response(data));
  const [partial] = await paused;
  assert.equal(partial.downloaded, 1);
  assert.equal(partial.downloadedBytes, pack.bytes);
  assert.deepEqual(requests, ['books-home-1.zip']);
  const finished = once(events, 'idle');
  await service.downloadAll();
  const [complete] = await finished;
  assert.equal(complete.downloaded, 2);
  assert.equal(complete.downloadedBytes, pack.bytes + second.bytes);
  assert.deepEqual(requests, ['books-home-1.zip', 'books-second-1.zip']);
});

test('a new main release reuses cached book hashes across source tags', async t => {
  const { service, directory } = await fixture(t, { request: async () => new Response(data) });
  await service.prepare('home');
  const updated = createBookResources({
    manifest: { ...manifest, release: 'assets-' + 'b'.repeat(24) },
    directory,
    request: () => assert.fail('A main-only update must not request the book again'),
  });
  assert.equal((await updated.getStatus()).downloaded, 1);
  const pages = await updated.prepare('home');
  assert.deepEqual((await updated.readPage(pages['1'])).data, pageData);
});

test('opening an uncached book never starts a transfer', async t => {
  const { service, directory } = await fixture(t, { request: () => assert.fail('Only settings should fetch book packs') });
  assert.equal((await service.getStatus()).downloaded, 0);
  assert.equal(await service.prepareCached('home'), null);
  assert.deepEqual(await fs.readdir(directory), []);
});

test('the Electron 22 transport accepts a verified resumed stream', async t => {
  const source=Readable.from([data.subarray(12)]);
  source.statusCode=206;
  source.headers={'content-range':[`bytes 12-${data.length-1}/${data.length}`]};
  const req=new EventEmitter(),headers={};
  req.setHeader=(name,value)=>{headers[name]=value};
  req.end=()=>queueMicrotask(()=>req.emit('response',source));
  req.abort=()=>source.destroy();
  const {service,directory}=await fixture(t,{request:(url,options)=>requestBookPack({request:()=>req},url,options)});
  await fs.writeFile(path.join(directory,sha256+'.zip.partial'),data.subarray(0,12));
  const page=await service.prepare('home');
  assert.equal(headers.Range,'bytes=12-');
  assert.deepEqual((await service.readPage(page['1'])).data,pageData);
});

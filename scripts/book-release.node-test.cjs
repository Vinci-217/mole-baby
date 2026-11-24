const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { inspectBookAssets, publishBookAssets } = require('./publish-book-assets.cjs');

const hash = data => createHash('sha256').update(data).digest('hex');

function buildFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ramu-book-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const renderer = path.join(root, 'full');
  const prefix = 'assets/original/reading-books';
  fs.mkdirSync(renderer);
  function stage(version, first = 'page one', canonical) {
    const worker = fs.readFileSync(path.join(__dirname, 'web-service-worker.js'), 'utf8')
      .replace('/*__WEB_CONFIG__*/null', JSON.stringify({ version, shell: ['index.html'] }));
    const assets = new Map([
      ['index.html', Buffer.from('<html><head></head><body>'+version+'</body></html>')],
      ['sw.js', Buffer.from(worker)],
      ['assets/original/official/manifest.json', Buffer.from('{"clips":[]}')],
      [`${prefix}/catalog.json`, Buffer.from(JSON.stringify([
        { id: 'first', pages: [`./${prefix}/first/1.png`] },
        { id: 'second', pages: [`./${prefix}/second/1.png`] },
      ]))],
      [`${prefix}/first/1.webp`, Buffer.from(first)],
      [`${prefix}/second/1.webp`, Buffer.from('second book')],
    ]);
    const entries = [];
    for (const [name, data] of assets) {
      const file = path.join(renderer, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
      entries.push({ path: name, bytes: data.length, sha256: hash(data) });
    }
    fs.writeFileSync(path.join(renderer, 'offline-resources.json'), JSON.stringify({
      schema: 1, revision: hash(JSON.stringify(entries)).slice(0,24), files: entries,
      bytes: entries.reduce((total, file) => total + file.bytes, 0),
    }));
    const assetsDir = path.join(root, version + '-packs'), light = path.join(root, version + '-light');
    execFileSync(process.platform === 'win32' ? 'python' : 'python3', [
      path.join(__dirname, 'split-resource-packs.py'), renderer, assetsDir, '--light-renderer', light,
      ...(canonical ? ['--book-index', canonical] : []),
    ]);
    return { assetsDir, light };
  }
  return { stage };
}

test('only changing launcher code keeps the book tag and archives byte-identical', async t => {
  const { stage } = buildFixture(t);
  const previous = stage('before'), updated = stage('after'), changed = stage('new-book', 'updated page');
  const a = await inspectBookAssets(previous.assetsDir), b = await inspectBookAssets(updated.assetsDir);
  const c = await inspectBookAssets(changed.assetsDir);
  assert.equal(a.tag, b.tag);
  assert.notEqual(a.tag, c.tag);
  for (const [name, info] of a.attachments) assert.equal(info.sha256, b.attachments.get(name).sha256, name);
  assert.equal(a.attachments.get('books-second-1.zip').sha256, c.attachments.get('books-second-1.zip').sha256);
  assert(!fs.existsSync(path.join(updated.light, 'assets/original/reading-books/first/1.webp')));
  assert.deepEqual(fs.readFileSync(path.join(updated.light, 'book-packs.json')), fs.readFileSync(b.attachments.get('book-packs.json').file));
  const platform = stage('other-platform', 'platform-specific raster bytes', b.attachments.get('book-packs.json').file);
  assert.deepEqual(fs.readFileSync(path.join(platform.light,'book-packs.json')),fs.readFileSync(b.attachments.get('book-packs.json').file));
  assert(!fs.existsSync(platform.assetsDir),'A platform using the shared index must not build a duplicate library');
  const update=JSON.parse(fs.readFileSync(path.join(platform.light,'offline-resources.json')));
  assert(!update.files.some(row=>row.path.endsWith('/first/1.webp')),'Main updates keep book pages out of the payload');
});

test('a PWA shell update keeps optional books out of precaching and preserves user downloads', async t => {
  const { light } = buildFixture(t).stage('updated');
  const worker = fs.readFileSync(path.join(light, 'sw.js'), 'utf8');
  const scope = 'https://ramu.example/library/';
  const books = 'mole-baby-optional-books-v1';
  const cacheNames = new Set(['mole-baby-web-core-previous', 'mole-baby-web-media-previous', books]);
  const events = new Map(), requests = [];
  vm.runInNewContext(worker, { URL, Request, Response,
    self: { registration: { scope }, clients: { claim() {} }, addEventListener: (name, handler) => events.set(name, handler) },
    caches: {
      async open(name) { cacheNames.add(name); return { addAll: assets => requests.push(...assets.map(asset => asset.url)) }; },
      async keys() { return [...cacheNames]; },
      async delete(name) { cacheNames.delete(name); },
    },
  });
  for (const name of ['install', 'activate']) {
    await new Promise((resolve, reject) => events.get(name)({ waitUntil: promise => promise.then(resolve, reject) }));
  }
  assert.deepEqual(requests, [scope + 'index.html', scope + 'book-packs.json']);
  assert(cacheNames.has(books));
  assert(!cacheNames.has('mole-baby-web-core-previous'));
  events.get('fetch')({
    request: new Request(scope + 'optional-books/assets-' + 'a'.repeat(24) + '/books-first-1.zip'),
    respondWith: () => assert.fail('The PWA must leave explicit book requests out of application caches'),
  });
});

test('book assets are published separately, verified, and reused without writes on a repeated run', async t => {
  const { assetsDir } = buildFixture(t).stage('release');
  const { tag, attachments } = await inspectBookAssets(assetsDir);
  const writes = [], existingAssets = [];
  let release;
  function run(args) {
    if (args[0] === 'api') {
      return JSON.stringify([args.at(-1).includes('/assets?')
        ? existingAssets
        : release ? [release] : []]);
    }
    assert.equal(args[0], 'release');
    assert.equal(args[2], tag);
    writes.push(args[1]);
    if (args[1] === 'create') {
      assert(args.includes('--draft') && args.includes('--prerelease') && args.includes('--latest=false'));
      release = { id: 17, tag_name: tag, prerelease: true, draft: true };
    } else if (args[1] === 'upload') {
      assert(release.draft);
      for (const file of args.slice(3, -2)) {
        const name = path.basename(file), info = attachments.get(name);
        assert(info && !existingAssets.some(asset => asset.name === name));
        existingAssets.push({ name, size: info.bytes, state: 'uploaded', digest: 'sha256:' + info.sha256 });
      }
    } else if (args[1] === 'edit') {
      assert(args.includes('--draft=false') && args.includes('--prerelease') && args.includes('--latest=false'));
      assert.equal(existingAssets.length, attachments.size);
      release.draft = false;
    } else assert.fail('Unexpected GitHub request');
    return '';
  }
  const request = async url => {
    assert(!release.draft);
    const name = new URL(url).pathname.split('/').at(-1);
    return new Response(fs.readFileSync(attachments.get(name).file));
  };
  const options = { directory: assetsDir, commit: '1'.repeat(40), run, request };
  await publishBookAssets(options);
  assert.deepEqual(writes, ['create', 'upload', 'edit']);
  await publishBookAssets(options);
  assert.deepEqual(writes, ['create', 'upload', 'edit']);
  existingAssets[0].digest = 'sha256:' + '0'.repeat(64);
  await assert.rejects(publishBookAssets(options), /books-first-1.zip/);
  assert.deepEqual(writes, ['create', 'upload', 'edit']);
});

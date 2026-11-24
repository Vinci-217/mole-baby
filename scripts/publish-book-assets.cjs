const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { verifyReleaseUploads } = require('./verify-release-uploads.cjs');

const repository = 'Vinci-217/mole-baby';
const manifestName = 'book-packs.json';
const hash = value => createHash('sha256').update(value).digest('hex');

async function inspectBookAssets(directory) {
  const plan = JSON.parse(fs.readFileSync(path.join(directory, 'resource-packs.json'), 'utf8'));
  const manifestBytes = fs.readFileSync(path.join(directory, manifestName));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schema, 1);
  assert.equal(plan.schema, 1);
  assert.match(manifest.release, /^assets-[a-f0-9]{24}$/);
  assert.equal(plan.githubReleaseTag, manifest.release);
  assert(manifest.books.length > 0 && plan.packs.length > 0);
  const packs = new Map(), attachments = new Map();
  for (const pack of plan.packs) {
    assert.equal(pack.group, 'books');
    assert.equal(pack.part, 1);
    assert.match(pack.feature, /^[a-z0-9-]+$/);
    assert.equal(pack.name, `books-${pack.feature}-1.zip`);
    assert(!packs.has(pack.feature), 'Duplicate book archive');
    assert.equal(pack.url, `https://github.com/${repository}/releases/download/${manifest.release}/${pack.name}`);
    const file = path.join(directory, pack.name);
    assert.equal(fs.statSync(file).size, pack.bytes);
    const checksum = createHash('sha256');
    for await (const block of fs.createReadStream(file)) checksum.update(block);
    assert.equal(checksum.digest('hex'), pack.sha256, pack.name);
    packs.set(pack.feature, pack);
    attachments.set(pack.name, { file, bytes: pack.bytes, sha256: pack.sha256 });
  }
  const ids = manifest.books.map(book => book.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate book in the renderer manifest');
  for (const book of manifest.books) {
    const pack = packs.get(book.id);
    assert(pack, 'Missing book archive: ' + book.id);
    assert.deepEqual(book, { id: pack.feature, bytes: pack.bytes, sha256: pack.sha256, pages: pack.pages });
  }
  const signature = [...packs.values()].map(pack => [pack.name, pack.bytes, pack.sha256]);
  assert.equal(manifest.release, 'assets-' + hash(JSON.stringify([signature, ids.toSorted()])).slice(0, 24));
  attachments.set(manifestName, { file: path.join(directory, manifestName), bytes: manifestBytes.length, sha256: hash(manifestBytes) });
  return { tag: manifest.release, attachments };
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300_000 });
}

async function publishBookAssets({ directory, commit, run = gh, request = fetch }) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  const { tag, attachments } = await inspectBookAssets(directory);
  const repos = `repos/${repository}`;
  const releases = () => JSON.parse(run(['api', '--paginate', '--slurp', repos + '/releases?per_page=100'])).flat();
  const metadata = () => releases().find(release => release.tag_name === tag);
  const releaseArgs = ['--repo', repository];
  let release = metadata();
  if (!release) {
    run(['release', 'create', tag, '--target', commit, '--draft', '--prerelease', '--latest=false',
      '--title', '拉姆图书素材 ' + tag, '--notes', '客户端可在设置中单独下载图书。', ...releaseArgs]);
    release = metadata();
  }
  assert(release?.prerelease, 'Book assets require their own prerelease');
  const listAssets = () => JSON.parse(run(['api', '--paginate', '--slurp',
    `${repos}/releases/${release.id}/assets?per_page=100`])).flat();
  const verify = (asset, expected) => {
    assert.equal(asset.state, 'uploaded', asset.name);
    assert.equal(asset.size, expected.bytes, asset.name);
    assert.equal(asset.digest, 'sha256:' + expected.sha256, asset.name);
  };
  const existing = new Map(listAssets().map(asset => [asset.name, asset]));
  const missing = [];
  for (const [name, expected] of attachments) {
    const asset = existing.get(name);
    if (asset) verify(asset, expected);
    else missing.push(expected.file);
  }
  if (missing.length) assert(release.draft, 'Published book asset sets must remain complete and immutable');
  for (let offset = 0; offset < missing.length; offset += 24) {
    run(['release', 'upload', tag, ...missing.slice(offset, offset + 24), ...releaseArgs]);
  }
  const publishedAssets = listAssets();
  const checksums = [...attachments].map(([name, expected]) => `${expected.sha256}  ${name}`).join('\n');
  verifyReleaseUploads(publishedAssets, checksums);
  for (const asset of publishedAssets) if (attachments.has(asset.name)) verify(asset, attachments.get(asset.name));
  if (release.draft) run(['release', 'edit', tag, '--draft=false', '--prerelease', '--latest=false', ...releaseArgs]);

  const sample = [...attachments.keys()].find(name => name.endsWith('.zip'));
  for (const name of [manifestName, sample]) {
    const url = `https://github.com/${repository}/releases/download/${tag}/${name}`;
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await request(url, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`Public book download HTTP ${response.status}`);
        }
        const data = Buffer.from(await response.arrayBuffer());
        assert.equal(hash(data), attachments.get(name).sha256, 'Public download mismatch: ' + name);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  console.log(`PASS GitHub book sources ${tag}, ${attachments.size} checked attachments and anonymous download`);
}

if (require.main === module) {
  assert.equal(process.env.GITHUB_REPOSITORY, repository);
  publishBookAssets({ directory: path.resolve(process.argv[2]), commit: process.env.GITHUB_SHA })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { inspectBookAssets, publishBookAssets };

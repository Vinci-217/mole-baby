// Scoped to /downloads/windows/ only. Does not intercept gameplay, app assets,
// or app saves. Stream the already-verified download cache, bounded to 8 MiB.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');

async function assembled(url) {
  const scope = new URL(self.registration.scope);
  const response = await fetch(new URL('manifest.json', scope), { cache: 'no-store' });
  if (!response.ok) throw Error('Download manifest unavailable');
  const manifest = await response.json();
  if (manifest.schema !== 1 || url.pathname !== scope.pathname + 'assembled/' + manifest.sha256 + '/' + manifest.filename || !/^[\w.-]+\.exe$/.test(manifest.filename) || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw Error('Invalid download identity');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('mole-windows-test-download-v1', 1);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  let index = 0, size = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (index === manifest.chunks.length) {
          if (size !== manifest.bytes) throw Error('Incomplete installer');
          db.close(); controller.close(); return;
        }
        const chunk = manifest.chunks[index];
        if (chunk.offset !== size || !Number.isSafeInteger(chunk.bytes) || chunk.bytes <= 0 || chunk.bytes > 16 * 1024 * 1024) throw Error('Invalid chunk bounds');
        const bytes = await new Promise((resolve, reject) => {
          const tx = db.transaction('chunks', 'readonly'), request = tx.objectStore('chunks').get(manifest.sha256 + ':' + index);
          tx.oncomplete = () => resolve(request.result); tx.onabort = tx.onerror = () => reject(tx.error);
        });
        if (!(bytes instanceof ArrayBuffer) || bytes.byteLength !== chunk.bytes || await sha256(bytes) !== chunk.sha256) throw Error('Corrupted download cache');
        index++; size += bytes.byteLength; controller.enqueue(new Uint8Array(bytes));
      } catch (error) { db.close(); controller.error(error); }
    },
    cancel() { db.close(); },
  });
  return new Response(stream, { headers: {
    'Content-Type': 'application/octet-stream', 'Content-Length': String(manifest.bytes),
    'Content-Disposition': 'attachment; filename="' + manifest.filename + '"',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname + 'assembled/')) return;
  event.respondWith(assembled(url).catch(() => new Response('下载缓存不完整，请返回下载页面继续校验后重试。', { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
});

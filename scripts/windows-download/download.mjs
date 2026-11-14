const element = id => document.getElementById(id);
const status = (message, error = false) => { element('status').textContent = message; element('status').dataset.error = String(error); };
const mib = bytes => (bytes / 1024 / 1024).toFixed(1) + ' MiB';
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
let manifest, database, controller, active = false, paused = false, verified = 0;
const key = index => manifest.sha256 + ':' + index;
const request = (mode, run) => new Promise((resolve, reject) => {
  const tx = database.transaction('chunks', mode), operation = run(tx.objectStore('chunks'));
  tx.oncomplete = () => resolve(operation?.result);
  tx.onabort = tx.onerror = () => reject(tx.error || new Error('浏览器无法保存下载缓存，请检查磁盘剩余空间。'));
});
const get = index => request('readonly', store => store.get(key(index)));
const put = (index, bytes) => request('readwrite', store => store.put(bytes, key(index)));
const valid = async (bytes, chunk) => bytes instanceof ArrayBuffer && bytes.byteLength === chunk.bytes && await digest(bytes) === chunk.sha256;
const progress = () => { element('progress').value = verified / manifest.bytes * 100; };

function validateManifest(data) {
  if (data?.schema !== 1 || !/^[\w.-]+\.exe$/.test(data.filename) || !Number.isSafeInteger(data.bytes) || data.bytes <= 0 || !/^[0-9a-f]{64}$/.test(data.sha256) || !Array.isArray(data.chunks) || data.chunks.length === 0 || data.chunks.length > 2048) throw Error('安装包信息无效，请联系作者。');
  let offset = 0;
  for (const chunk of data.chunks) {
    if (chunk.offset !== offset || !Number.isSafeInteger(chunk.bytes) || chunk.bytes <= 0 || chunk.bytes > 16 * 1024 * 1024 || !/^[0-9a-f]{64}$/.test(chunk.sha256) || chunk.file !== 'parts/' + chunk.sha256 + '.bin') throw Error('下载分段信息无效，请联系作者。');
    offset += chunk.bytes;
  }
  if (offset !== data.bytes) throw Error('下载分段长度不完整，请联系作者。');
  return data;
}

async function fetchChunk(chunk) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (paused) throw new DOMException('Paused', 'AbortError');
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40000);
    try {
      const response = await fetch(new URL(chunk.file, location.href), { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      if (response.status !== 200) throw Error('网络响应 ' + response.status);
      const declared = response.headers.get('Content-Length');
      if (declared !== null && Number(declared) !== chunk.bytes) throw Error('下载长度不符');
      // Refuse a gateway returning the entire installer or a large error page.
      const reader = response.body.getReader(), pieces = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > chunk.bytes) { await reader.cancel(); throw Error('下载分段过大'); }
        pieces.push(value);
      }
      if (size !== chunk.bytes) throw Error('下载未完成');
      const bytes = new Uint8Array(size); let offset = 0;
      for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength; }
      if (!await valid(bytes.buffer, chunk)) throw Error('下载校验不通过');
      return bytes.buffer;
    } catch (error) {
      if (paused) throw error;
      lastError = error;
      status('网络中断或校验未通过，正在重试当前分段（' + (attempt + 1) + '/3）…');
    } finally { clearTimeout(timeout); controller = undefined; }
  }
  throw Error((lastError?.message || '下载失败') + '。已完成的分段已保留，点击继续下载即可重试。');
}

async function download() {
  if (active) return;
  active = true; paused = false; verified = 0;
  element('start').disabled = true; element('pause').hidden = false; element('save').hidden = true;
  try {
    // This permission only covers this download cache; gameplay saves are untouched.
    await navigator.storage?.persist?.().catch(() => false);
    for (let index = 0; index < manifest.chunks.length; index++) {
      if (paused) break;
      const chunk = manifest.chunks[index];
      status('正在校验 / 下载第 ' + (index + 1) + ' / ' + manifest.chunks.length + ' 段 · 已完成 ' + mib(verified));
      let bytes = await get(index);
      if (!await valid(bytes, chunk)) { bytes = await fetchChunk(chunk); await put(index, bytes); }
      verified += chunk.bytes; progress();
    }
    if (paused) status('已暂停，已完成的分段已保留。');
    else {
      if (verified !== manifest.bytes) throw Error('总长度校验失败，请重试。');
      status('全部分段校验通过。请点击“保存完整安装包”。'); element('save').hidden = false;
    }
  } catch (error) { status(paused ? '已暂停，已完成的分段已保留。' : error.message, !paused); }
  finally { active = false; element('pause').hidden = true; element('start').disabled = false; element('start').textContent = '继续下载 / 重新校验'; }
}

async function save() {
  if (active) return;
  active = true; element('save').disabled = true; element('start').disabled = true;
  try {
    let size = 0;
    for (let index = 0; index < manifest.chunks.length; index++) {
      const chunk = manifest.chunks[index], bytes = await get(index);
      if (!await valid(bytes, chunk)) throw Error('缓存分段不完整，请点击“继续下载 / 重新校验”修复后再保存。');
      size += bytes.byteLength;
      status('正在生成完整安装包 ' + Math.round(size / manifest.bytes * 100) + '%…');
    }
    if (size !== manifest.bytes) throw Error('安装包长度不符，已停止保存。');
    // A worker in this download-only scope streams verified cached chunks
    // directly to the browser's file download without a giant memory Blob.
    if (!navigator.serviceWorker) throw Error('请使用 Windows Edge 或 Chrome 的独立窗口保存安装包。');
    const registration = await navigator.serviceWorker.register('./download-worker.js', { scope: './' });
    const worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw Error('下载服务未就绪，请重试保存。');
    if (worker.state !== 'activated') await new Promise((resolve, reject) => {
      const changed = () => { if (worker.state === 'activated') resolve(); else if (worker.state === 'redundant') reject(Error('下载服务启动失败，请刷新后重试。')); };
      worker.addEventListener('statechange', changed); changed();
    });
    if (navigator.serviceWorker.controller?.scriptURL !== worker.scriptURL) await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', changed); reject(Error('请刷新本页后再次保存，下载分段会保留。')); }, 10000);
      const changed = () => { if (navigator.serviceWorker.controller?.scriptURL === worker.scriptURL) { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed); resolve(); } };
      navigator.serviceWorker.addEventListener('controllerchange', changed); changed();
    });
    // Chromium can bypass Service Workers for an <a download> request.
    // A navigation into the worker's own scope uses its streaming Response;
    // Content-Disposition starts the file download without leaving this page.
    const frame = document.createElement('iframe'); frame.hidden = true;
    frame.src = './assembled/' + manifest.sha256 + '/' + manifest.filename;
    document.body.append(frame);
    status('完整安装包已开始保存。请等待浏览器显示下载完成，再双击安装。');
  } catch (error) { status(error.name === 'AbortError' ? '已取消保存，可再次点击保存安装包。' : error.message, error.name !== 'AbortError'); }
  finally { active = false; element('save').disabled = false; element('start').disabled = false; }
}

element('start').addEventListener('click', download);
element('pause').addEventListener('click', () => { paused = true; controller?.abort(); });
element('save').addEventListener('click', save);
try {
  if (!crypto.subtle || !window.indexedDB) throw Error('请在 Windows 的 Edge 或 Chrome 中打开完整的 HTTPS 页面。');
  const response = await fetch('./manifest.json', { cache: 'no-store' });
  if (!response.ok) throw Error('暂时无法读取安装包信息，请刷新重试。');
  manifest = validateManifest(await response.json());
  database = await new Promise((resolve, reject) => {
    const open = indexedDB.open('mole-windows-test-download-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('chunks');
    open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
  });
  element('size').textContent = '完整安装包 ' + mib(manifest.bytes) + '（' + manifest.bytes.toLocaleString('zh-CN') + ' 字节）· 内含全部运行素材';
  element('filename').textContent = manifest.filename;
  element('sha').textContent = 'SHA-256: ' + manifest.sha256;
  element('checks').textContent = manifest.chunks.length + ' 个分段逐段校验 SHA-256；原包 NSIS 启动完整性校验已通过。';
  element('start').disabled = false;
  status('准备就绪。请使用同一个浏览器继续未完成的下载。');
} catch (error) { status(error.message, true); }

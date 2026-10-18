// The API credential and HTTPS client live exclusively in Electron's main
// process. This module deliberately has no API for returning a saved key.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const MAX_MESSAGES = 32;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TOTAL_LENGTH = 36000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const TIMEOUT_MS = 35000;

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    throw new Error('对话最多保留 32 条消息，请开启一段新对话。');
  }
  let total = 0;
  const cleaned = messages.map((message, index) => {
    if (!message || typeof message !== 'object'
      || !['system', 'user', 'assistant'].includes(message.role)
      || (message.role === 'system' && index !== 0)
      || typeof message.content !== 'string'
      || message.content.trim().length === 0
      || message.content.length > MAX_MESSAGE_LENGTH) {
      throw new Error('对话格式不正确，或单条内容超过 8000 个字符。');
    }
    total += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (total > MAX_TOTAL_LENGTH) throw new Error('这段对话太长了，请开启一段新对话。');
  if (cleaned.at(-1).role !== 'user') throw new Error('请先输入要对拉姆说的话。');
  return cleaned;
}

function publicStatusError(status) {
  if (status === 401) return new Error('DeepSeek API Key 无效，请在设置中重新填写。');
  if (status === 402) return new Error('DeepSeek 账户余额不足，请检查账户。');
  if (status === 403) return new Error('DeepSeek 拒绝了这次请求，请检查 API Key 的权限。');
  if (status === 429) return new Error('DeepSeek 当前请求较多，稍等一会儿再和拉姆说话。');
  if (status >= 500) return new Error('DeepSeek 暂时无法回应，请稍后再试。');
  return new Error('这次对话没有成功，请稍后再试。');
}

function createCompanionAI({ userDataPath, safeStorage, request = https.request, timeoutMs = TIMEOUT_MS }) {
  if (typeof userDataPath !== 'string' || !path.isAbsolute(userDataPath)) {
    throw new TypeError('An absolute user-data directory is required');
  }
  const filename = path.join(userDataPath, 'companion-ai-key.json');
  let active = null;
  let disposed = false;

  function supportsEncryption() {
    try {
      return safeStorage?.isEncryptionAvailable() === true
        // Electron's Linux "basic_text" backend has no operating-system secret
        // protection. Never describe that backend as OS-encrypted storage.
        && safeStorage.getSelectedStorageBackend?.() !== 'basic_text';
    } catch {
      return false;
    }
  }

  function readRecord() {
    try {
      if (fs.statSync(filename).size > 8192) return null;
      const record = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (record?.version !== 1 || typeof record.value !== 'string'
        || !['os-encrypted', 'local-file'].includes(record.protection)) return null;
      return record;
    } catch {
      return null;
    }
  }

  function readKey() {
    const record = readRecord();
    if (!record) return '';
    try {
      const value = record.protection === 'os-encrypted'
        ? safeStorage.decryptString(Buffer.from(record.value, 'base64'))
        : record.value;
      return typeof value === 'string' && /^[\x21-\x7e]{8,512}$/.test(value) ? value : '';
    } catch {
      return '';
    }
  }

  function getSettings() {
    const record = readRecord();
    return {
      configured: Boolean(readKey()),
      protection: record?.protection || (supportsEncryption() ? 'os-encrypted' : 'local-file'),
    };
  }

  function cancel() {
    active?.abort(new Error('已取消这次对话。'));
  }

  function setKey(input) {
    if (disposed) throw new Error('对话服务已经关闭。');
    if (typeof input !== 'string' || !/^[\x21-\x7e]{8,512}$/.test(input.trim())) {
      throw new Error('请输入有效的 DeepSeek API Key，且不要包含空格。');
    }
    const key = input.trim();
    const protection = supportsEncryption() ? 'os-encrypted' : 'local-file';
    let value;
    try {
      value = protection === 'os-encrypted' ? safeStorage.encryptString(key).toString('base64') : key;
    } catch {
      // Do not silently downgrade a failing OS keychain to plaintext.
      throw new Error('系统暂时无法保护 API Key，请稍后再保存。');
    }
    const temporary = `${filename}.tmp`;
    try {
      fs.mkdirSync(userDataPath, { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify({ version: 1, protection, value }), { mode: 0o600 });
      fs.chmodSync(temporary, 0o600);
      fs.renameSync(temporary, filename);
      fs.chmodSync(filename, 0o600);
    } catch {
      try { fs.unlinkSync(temporary); } catch { /* No temporary key file to remove. */ }
      throw new Error('无法将 API Key 保存到本机，请检查本地文件权限。');
    }
    cancel();
    return getSettings();
  }

  function clearKey() {
    cancel();
    try {
      fs.rmSync(filename, { force: true });
      fs.rmSync(`${filename}.tmp`, { force: true });
    } catch {
      throw new Error('无法删除本机 API Key，请检查本地文件权限。');
    }
    return getSettings();
  }

  function chat(messages) {
    if (disposed) return Promise.reject(new Error('对话服务已经关闭。'));
    let cleaned;
    try { cleaned = validateMessages(messages); } catch (error) { return Promise.reject(error); }
    if (active) return Promise.reject(new Error('拉姆还在想上一句话，请稍等或先取消。'));
    const key = readKey();
    if (!key) return Promise.reject(new Error('请先在设置中填写 DeepSeek API Key。'));
    const body = JSON.stringify({
      model: 'deepseek-chat', messages: cleaned, stream: false, max_tokens: 512, temperature: 0.85,
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let client = null;
      let response = null;
      let timer = null;
      const task = {
        abort(error) {
          finish(error);
          response?.destroy();
          client?.destroy();
        },
      };
      const finish = (error, content) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (active === task) active = null;
        if (error) reject(error);
        else resolve(content);
      };
      active = task;
      timer = setTimeout(() => task.abort(new Error('拉姆等了一会儿还没收到回应，请再试一次。')), timeoutMs);
      try {
        // Keep the host, path and model fixed. No renderer-controlled URL,
        // proxy, custom headers or redirect can receive this credential.
        client = request({
          protocol: 'https:', hostname: 'api.deepseek.com', port: 443,
          path: '/chat/completions', method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body), Accept: 'application/json',
          },
        }, (incoming) => {
          response = incoming;
          if (settled) { incoming.destroy(); return; }
          if (incoming.statusCode !== 200) {
            finish(publicStatusError(incoming.statusCode));
            incoming.destroy();
            return;
          }
          let size = 0;
          const chunks = [];
          incoming.on('data', (chunk) => {
            if (settled) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > MAX_RESPONSE_BYTES) {
              task.abort(new Error('拉姆收到的回应太长了，请换一句简短的话。'));
              return;
            }
            chunks.push(buffer);
          });
          incoming.on('error', () => finish(new Error('对话连接中断，请稍后再试。')));
          incoming.on('aborted', () => finish(new Error('对话连接中断，请稍后再试。')));
          incoming.on('end', () => {
            if (settled) return;
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const content = parsed?.choices?.[0]?.message?.content;
              if (typeof content !== 'string' || !content.trim() || content.length > 8000) {
                finish(new Error('拉姆没有收到完整的话，请再试一次。'));
                return;
              }
              finish(null, content.trim());
            } catch {
              finish(new Error('拉姆没有收到完整的话，请再试一次。'));
            }
          });
        });
        client.on('error', () => finish(new Error('暂时连接不上 DeepSeek，请检查网络后重试。')));
        client.end(body);
      } catch {
        task.abort(new Error('暂时连接不上 DeepSeek，请检查网络后重试。'));
      }
    });
  }

  function dispose() {
    disposed = true;
    cancel();
  }

  return Object.freeze({ getSettings, setKey, clearKey, chat, cancel, dispose });
}

module.exports = { createCompanionAI, validateMessages };

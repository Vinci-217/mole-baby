// Run with: node --test electron/deepseek.node-test.cjs
// No real credentials or external requests are used by these tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCompanionAI } = require('./deepseek.cjs');

const FAKE_KEY = 'sk-test-only-not-a-real-credential';
const MESSAGES = [{ role: 'system', content: '你是一只小拉姆。' }, { role: 'user', content: '你好呀' }];

function mockNetwork({ status = 200, payload, pending = false, networkError = false } = {}) {
  const calls = [];
  let destroyed = 0;
  function request(options, callback) {
    const client = new EventEmitter();
    client.destroy = () => { destroyed += 1; client.emit('error', new Error(`private ${FAKE_KEY}`)); };
    client.end = (body) => {
      calls.push({ options, body });
      if (pending) return;
      queueMicrotask(() => {
        if (networkError) { client.emit('error', new Error(`private ${FAKE_KEY}`)); return; }
        const incoming = new EventEmitter();
        incoming.statusCode = status;
        incoming.destroy = () => { incoming.destroyed = true; };
        callback(incoming);
        if (incoming.destroyed) return;
        incoming.emit('data', payload === undefined
          ? Buffer.from(JSON.stringify({ choices: [{ message: { content: '  我记得你呀！  ' } }] }))
          : Buffer.from(payload));
        if (!incoming.destroyed) incoming.emit('end');
      });
    };
    return client;
  }
  return { request, calls, destroyed: () => destroyed };
}

function fixture(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ramu-ai-unit-'));
  const network = overrides.network || mockNetwork();
  const ai = createCompanionAI({ userDataPath: directory, request: network.request, ...overrides });
  t.after(() => { ai.dispose(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { ai, directory, filename: path.join(directory, 'companion-ai-key.json'), network };
}

function encryptedStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (key) => Buffer.from(`test-encrypted:${key}`),
    decryptString: (buffer) => {
      const text = buffer.toString();
      if (!text.startsWith('test-encrypted:')) throw new Error('invalid mock ciphertext');
      return text.slice('test-encrypted:'.length);
    },
  };
}

test('settings never return the key; local fallback file is private and removable', (t) => {
  const { ai, filename, directory } = fixture(t);
  assert.deepEqual(ai.getSettings(), { configured: false, protection: 'local-file' });
  assert.deepEqual(ai.setKey(FAKE_KEY), { configured: true, protection: 'local-file' });
  // Windows uses the user profile's ACLs; POSIX mode bits are only meaningful
  // on Unix. Windows production credentials normally use safeStorage/DPAPI.
  if (process.platform !== 'win32') assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  assert.equal(JSON.stringify(ai.getSettings()).includes(FAKE_KEY), false);
  const reopened = createCompanionAI({ userDataPath: directory });
  assert.equal(reopened.getSettings().configured, true);
  reopened.dispose();
  assert.deepEqual(ai.clearKey(), { configured: false, protection: 'local-file' });
  assert.equal(fs.existsSync(filename), false);
});

test('OS encrypted storage has no plaintext credential in the file and can reopen', (t) => {
  const safeStorage = encryptedStorage();
  const { ai, filename, directory } = fixture(t, { safeStorage });
  assert.deepEqual(ai.setKey(FAKE_KEY), { configured: true, protection: 'os-encrypted' });
  assert.equal(fs.readFileSync(filename, 'utf8').includes(FAKE_KEY), false);
  const reopened = createCompanionAI({ userDataPath: directory, safeStorage });
  assert.deepEqual(reopened.getSettings(), { configured: true, protection: 'os-encrypted' });
  reopened.dispose();
});

test('Linux basic_text is reported as local-file rather than secure OS storage', (t) => {
  const safeStorage = { ...encryptedStorage(), getSelectedStorageBackend: () => 'basic_text' };
  const { ai } = fixture(t, { safeStorage });
  assert.equal(ai.setKey(FAKE_KEY).protection, 'local-file');
});

test('failure to encrypt does not silently save the key as plaintext', (t) => {
  const safeStorage = { ...encryptedStorage(), encryptString: () => { throw new Error(FAKE_KEY); } };
  const { ai, filename } = fixture(t, { safeStorage });
  assert.throws(() => ai.setKey(FAKE_KEY), { message: '系统暂时无法保护 API Key，请稍后再保存。' });
  assert.equal(fs.existsSync(filename), false);
});

test('corrupt or unavailable encrypted files do not prevent startup', (t) => {
  const { ai, filename } = fixture(t);
  fs.writeFileSync(filename, '{bad');
  assert.equal(ai.getSettings().configured, false);
  fs.writeFileSync(filename, JSON.stringify({ version: 1, protection: 'os-encrypted', value: 'abc' }));
  assert.equal(ai.getSettings().configured, false);
});

test('invalid key input is rejected without replacing the stored key', (t) => {
  const { ai, filename } = fixture(t);
  ai.setKey(FAKE_KEY);
  const previous = fs.readFileSync(filename, 'utf8');
  for (const invalid of [null, '', 'short', 'sk-one\r\nAuthorization: injected', 'x'.repeat(513)]) {
    assert.throws(() => ai.setKey(invalid));
  }
  assert.equal(fs.readFileSync(filename, 'utf8'), previous);
});

test('request uses a fixed HTTPS endpoint, model and headers, never the API key in JSON', async (t) => {
  const { ai, network } = fixture(t);
  ai.setKey(FAKE_KEY);
  assert.equal(await ai.chat(MESSAGES), '我记得你呀！');
  assert.equal(network.calls.length, 1);
  const { options, body } = network.calls[0];
  assert.equal(options.protocol, 'https:');
  assert.equal(options.hostname, 'api.deepseek.com');
  assert.equal(options.path, '/chat/completions');
  assert.equal(options.headers.Authorization, `Bearer ${FAKE_KEY}`);
  assert.equal(options.headers['Content-Length'], Buffer.byteLength(body));
  assert.equal(body.includes(FAKE_KEY), false);
  assert.deepEqual(JSON.parse(body), {
    model: 'deepseek-chat', messages: MESSAGES, stream: false, max_tokens: 512, temperature: 0.85,
  });
});

test('missing credentials and malformed/oversized messages never reach the network', async (t) => {
  const { ai, network } = fixture(t);
  await assert.rejects(ai.chat(MESSAGES), /API Key/);
  ai.setKey(FAKE_KEY);
  for (const messages of [
    null, [], Array(33).fill({ role: 'user', content: 'a' }),
    [{ role: 'user', content: 'a'.repeat(8001) }],
    Array(5).fill({ role: 'user', content: 'a'.repeat(7500) }),
    [{ role: 'tool', content: 'invalid' }],
    [{ role: 'user', content: 'hello' }, { role: 'system', content: 'invalid' }],
    [{ role: 'assistant', content: 'last is not user' }],
  ]) await assert.rejects(ai.chat(messages));
  assert.equal(network.calls.length, 0);
});

test('API errors and redirects never expose response contents or credentials', async (t) => {
  for (const status of [301, 400, 401, 402, 403, 429, 500]) {
    const network = mockNetwork({ status, payload: FAKE_KEY });
    const { ai } = fixture(t, { network });
    ai.setKey(FAKE_KEY);
    await assert.rejects(ai.chat(MESSAGES), (error) => {
      assert.equal(error.message.includes(FAKE_KEY), false);
      assert.equal(error.message.includes('Bearer'), false);
      return true;
    });
    assert.equal(network.calls.length, 1);
  }
});

test('network errors are converted into safe, readable messages', async (t) => {
  const { ai } = fixture(t, { network: mockNetwork({ networkError: true }) });
  ai.setKey(FAKE_KEY);
  await assert.rejects(ai.chat(MESSAGES), { message: '暂时连接不上 DeepSeek，请检查网络后重试。' });
});

test('malformed, empty and excessive replies are rejected safely', async (t) => {
  for (const payload of ['{bad', '{}', JSON.stringify({ choices: [{ message: { content: '' } }] }), 'x'.repeat(128 * 1024 + 1)]) {
    const { ai } = fixture(t, { network: mockNetwork({ payload }) });
    ai.setKey(FAKE_KEY);
    await assert.rejects(ai.chat(MESSAGES));
  }
});

test('cancel aborts a pending request and permits a new request', async (t) => {
  const { ai, network } = fixture(t, { network: mockNetwork({ pending: true }) });
  ai.setKey(FAKE_KEY);
  const first = ai.chat(MESSAGES);
  await assert.rejects(ai.chat(MESSAGES), /上一句话/);
  ai.cancel();
  await assert.rejects(first, /取消/);
  assert.equal(network.destroyed(), 1);
  const second = ai.chat(MESSAGES);
  assert.equal(network.calls.length, 2);
  ai.cancel();
  await assert.rejects(second, /取消/);
});

test('timeouts abort pending HTTPS connections', async (t) => {
  const { ai, network } = fixture(t, { network: mockNetwork({ pending: true }), timeoutMs: 10 });
  ai.setKey(FAKE_KEY);
  await assert.rejects(ai.chat(MESSAGES), /等了一会儿/);
  assert.equal(network.destroyed(), 1);
});

test('clearing a key and app shutdown both cancel pending requests', async (t) => {
  const { ai } = fixture(t, { network: mockNetwork({ pending: true }) });
  ai.setKey(FAKE_KEY);
  const beforeClear = ai.chat(MESSAGES);
  ai.clearKey();
  await assert.rejects(beforeClear, /取消/);
  ai.setKey(FAKE_KEY);
  const beforeShutdown = ai.chat(MESSAGES);
  ai.dispose();
  await assert.rejects(beforeShutdown, /取消/);
  await assert.rejects(ai.chat(MESSAGES), /关闭/);
  assert.throws(() => ai.setKey(FAKE_KEY), /关闭/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createCompanionSpeech } = require('./speech.cjs');

function mockProcess({ payload, pending = false, fail = false } = {}) {
  const calls = [];
  let killed = 0;
  const spawn = (executable, args, options) => {
    calls.push({ executable, args, options });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.kill = () => { killed += 1; child.emit('close', null); };
    if (!pending) queueMicrotask(() => {
      if (fail) { child.emit('error', new Error('do not expose native process paths')); return; }
      const source = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
      // Split every byte, including the middle of UTF-8 Chinese characters.
      for (const byte of source) child.stdout.emit('data', Buffer.from([byte]));
      child.emit('close', 0);
    });
    return child;
  };
  return { spawn, calls, killed: () => killed };
}

function fixture(t, network, overrides = {}) {
  const speech = createCompanionSpeech({ platform: 'win32', spawn: network.spawn, ...overrides });
  t.after(() => speech.dispose());
  return speech;
}

test('non-Windows speech is explicitly unavailable and never starts a process', async (t) => {
  const network = mockProcess({ payload: {} });
  const speech = fixture(t, network, { platform: 'linux' });
  assert.equal((await speech.getAvailability()).available, false);
  await assert.rejects(speech.listen(), /Windows/);
  assert.equal(network.calls.length, 0);
});

test('availability requires an installed Chinese recognizer', async (t) => {
  const network = mockProcess({ payload: { ok: false, code: 'no-chinese-recognizer' } });
  const speech = fixture(t, network);
  const available = await speech.getAvailability();
  assert.equal(available.available, false);
  assert.match(available.reason, /中文/);
});

test('recognizer is probed without microphone input, using a fixed encoded native command', async (t) => {
  const network = mockProcess({ payload: { ok: true, available: true, language: 'zh-CN' } });
  const speech = fixture(t, network);
  assert.deepEqual(await speech.getAvailability(), { available: true, language: 'zh-CN' });
  const { executable, args, options } = network.calls[0];
  assert.match(executable, /WindowsPowerShell\\v1\.0\\powershell\.exe$/);
  assert.equal(options.shell, false);
  assert.equal(options.windowsHide, true);
  assert.equal(args.at(-2), '-EncodedCommand');
  const source = Buffer.from(args.at(-1), 'base64').toString('utf16le');
  assert.match(source, /InstalledRecognizers/);
  assert.doesNotMatch(source, /SetInputToDefaultAudioDevice/);
});

test('listen uses local default audio device and returns recognized Chinese correctly', async (t) => {
  const network = mockProcess({ payload: { ok: true, language: 'zh-CN', text: '  拉姆我回来了。  ' } });
  const speech = fixture(t, network);
  assert.equal(await speech.listen(), '拉姆我回来了。');
  const source = Buffer.from(network.calls[0].args.at(-1), 'base64').toString('utf16le');
  assert.match(source, /SetInputToDefaultAudioDevice/);
  assert.match(source, /Recognize\(\[TimeSpan\]::FromSeconds\(10\)\)/);
  assert.doesNotMatch(source, /https?:|Upload|Invoke-WebRequest/);
});

test('cancellation ends microphone process; repeated listen does not run concurrently', async (t) => {
  const network = mockProcess({ pending: true });
  const speech = fixture(t, network);
  const pending = speech.listen();
  await assert.rejects(speech.listen(), /正在听/);
  speech.cancel();
  await assert.rejects(pending, /取消/);
  assert.equal(network.killed(), 1);
  const again = speech.listen();
  assert.equal(network.calls.length, 2);
  speech.cancel();
  await assert.rejects(again, /取消/);
});

test('recognition is bounded by a timeout and process is stopped', async (t) => {
  const network = mockProcess({ pending: true });
  const speech = fixture(t, network, { timeoutMs: 10 });
  await assert.rejects(speech.listen(), /没有听清楚/);
  assert.equal(network.killed(), 1);
});

test('native errors, invalid replies and empty recognition give readable errors', async (t) => {
  for (const input of [
    { fail: true }, { payload: '{bad' },
    { payload: { ok: false, code: 'microphone-unavailable' } },
    { payload: { ok: true, text: '' } },
    { payload: { ok: true, text: '长'.repeat(2001) } },
  ]) {
    const speech = fixture(t, mockProcess(input));
    await assert.rejects(speech.listen(), (error) => {
      assert.equal(error.message.includes('process paths'), false);
      assert.match(error.message, /麦克风|听清楚|太长/);
      return true;
    });
  }
});

test('shutdown cancels active microphone use and denies future capture', async (t) => {
  const network = mockProcess({ pending: true });
  const speech = fixture(t, network);
  const pending = speech.listen();
  speech.dispose();
  await assert.rejects(pending, /取消/);
  await assert.rejects(speech.listen(), /Windows/);
  assert.equal((await speech.getAvailability()).available, false);
  assert.equal(network.killed(), 1);
});

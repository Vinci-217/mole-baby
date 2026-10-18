// Windows ships a local SAPI/System.Speech recognizer. Chromium's web speech
// service is not reliably available in Electron, so microphone input uses that
// installed OS recognizer and never uploads audio to a third-party service.
const { spawn: spawnProcess } = require('node:child_process');
const path = require('node:path');

const UNAVAILABLE = '语音输入需要 Windows 桌面版和系统中文语音组件。';
const NO_RECOGNIZER = '系统没有可供桌面程序使用的中文语音识别引擎，请在 Windows 语言设置中安装中文语音组件。';
const MICROPHONE = '无法打开麦克风，请检查 Windows 麦克风权限、输入设备及中文语音组件。';
const CANCELLED = '已取消语音输入。';

// Both commands are fixed source. No renderer text is ever interpreted as a
// PowerShell command, and -EncodedCommand avoids command-line quoting issues.
function command(mode) {
  const recognition = mode === 'listen' ? `
    $engine = New-Object -TypeName System.Speech.Recognition.SpeechRecognitionEngine -ArgumentList $recognizer
    try {
      $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
      $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(8)
      $engine.BabbleTimeout = [TimeSpan]::FromSeconds(8)
      $engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(800)
      $engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromSeconds(1)
      $engine.SetInputToDefaultAudioDevice()
      $result = $engine.Recognize([TimeSpan]::FromSeconds(10))
      $text = if ($null -ne $result) { $result.Text } else { '' }
      @{ok=$true; text=$text; language=$recognizer.Culture.Name} | ConvertTo-Json -Compress
    } finally { $engine.Dispose() }
  ` : `
    @{ok=$true; available=$true; language=$recognizer.Culture.Name} | ConvertTo-Json -Compress
  `;
  return `
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    try {
      Add-Type -AssemblyName System.Speech
      $recognizers = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
      $recognizer = $recognizers | Where-Object { $_.Culture.Name -eq 'zh-CN' } | Select-Object -First 1
      if ($null -eq $recognizer) {
        $recognizer = $recognizers | Where-Object { $_.Culture.Name -like 'zh-*' } | Select-Object -First 1
      }
      if ($null -eq $recognizer) {
        @{ok=$false; code='no-chinese-recognizer'} | ConvertTo-Json -Compress
      } else { ${recognition} }
    } catch {
      @{ok=$false; code='${mode === 'listen' ? 'microphone-unavailable' : 'speech-unavailable'}'} | ConvertTo-Json -Compress
    }
  `;
}

function createCompanionSpeech({ platform = process.platform, spawn = spawnProcess, timeoutMs = 18000, probeTimeoutMs = 8000 } = {}) {
  let disposed = false;
  let active = null;
  let probe = null;
  const processes = new Set();

  function run(mode) {
    let child = null;
    let settled = false;
    let timer = null;
    let rejectPromise;
    const task = {
      cancel() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        processes.delete(task);
        rejectPromise(new Error(CANCELLED));
        child?.kill();
      },
    };
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        processes.delete(task);
        if (error) reject(error);
        else resolve(value);
      };
      const chunks = [];
      let bytes = 0;
      processes.add(task);
      timer = setTimeout(() => {
        finish(new Error(mode === 'listen' ? '没有听清楚，请再点一次麦克风。' : UNAVAILABLE));
        child?.kill();
      }, mode === 'listen' ? timeoutMs : probeTimeoutMs);
      try {
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const executable = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command(mode), 'utf16le').toString('base64')], {
          windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'ignore'],
        });
        child.stdout.on('data', (chunk) => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > 16 * 1024) {
            finish(new Error(MICROPHONE));
            child.kill();
            return;
          }
          chunks.push(buffer);
        });
        child.on('error', () => finish(new Error(mode === 'listen' ? MICROPHONE : UNAVAILABLE)));
        child.on('close', (code) => {
          if (settled) return;
          try {
            if (code !== 0) { finish(new Error(mode === 'listen' ? MICROPHONE : UNAVAILABLE)); return; }
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8').trim().replace(/^\uFEFF/, ''));
            if (data?.ok !== true) {
              finish(new Error(data?.code === 'no-chinese-recognizer' ? NO_RECOGNIZER : mode === 'listen' ? MICROPHONE : UNAVAILABLE));
              return;
            }
            finish(null, data);
          } catch {
            finish(new Error(mode === 'listen' ? MICROPHONE : UNAVAILABLE));
          }
        });
      } catch {
        finish(new Error(mode === 'listen' ? MICROPHONE : UNAVAILABLE));
      }
    });
    return { ...task, promise };
  }

  function getAvailability() {
    if (disposed || platform !== 'win32') return Promise.resolve({ available: false, reason: UNAVAILABLE });
    if (probe) return probe;
    probe = run('probe').promise.then((data) => {
      if (data.available !== true || typeof data.language !== 'string' || !/^zh-[A-Za-z-]{2,16}$/.test(data.language)) {
        return { available: false, reason: NO_RECOGNIZER };
      }
      return { available: true, language: data.language };
    }).catch((error) => ({ available: false, reason: error.message })).finally(() => { probe = null; });
    return probe;
  }

  function listen() {
    if (disposed || platform !== 'win32') return Promise.reject(new Error(UNAVAILABLE));
    if (active) return Promise.reject(new Error('正在听你说话，请先结束这次语音输入。'));
    const task = run('listen');
    active = task;
    return task.promise.then((data) => {
      if (typeof data.text !== 'string' || data.text.length > 2000) throw new Error('这段语音太长了，请分成几句话说。');
      if (!data.text.trim()) throw new Error('没有听清楚，请再点一次麦克风。');
      return data.text.trim();
    }).finally(() => { if (active === task) active = null; });
  }

  function cancel() { active?.cancel(); }
  function dispose() {
    disposed = true;
    for (const task of processes) task.cancel();
  }
  return Object.freeze({ getAvailability, listen, cancel, dispose });
}

module.exports = { createCompanionSpeech };

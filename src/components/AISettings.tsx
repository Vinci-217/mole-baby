import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import './AISettings.css';

export function AISettings() {
  const [key, setKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [protection, setProtection] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const bridge = window.companionAI;
  useEffect(() => {
    let live = true;
    void bridge?.getSettings().then(s => { if (live) { setConfigured(s.configured); setProtection(s.protection); } }).catch(() => { if (live) setMessage('无法读取连接设置，请稍后重试。'); });
    return () => { live = false; };
  }, [bridge]);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!bridge || !key.trim() || busy) return;
    setBusy(true); setMessage('');
    try {
      const status = await bridge.setKey(key.trim());
      setKey(''); setConfigured(status.configured); setProtection(status.protection);
      setMessage('已保存到本机。下次聊天将使用 DeepSeek；保存密钥不会发送测试请求。');
      window.dispatchEvent(new Event('companion-ai-settings-changed'));
    } catch (error) { setMessage(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '保存失败，请重试。'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!bridge || busy) return; setBusy(true); setMessage(''); bridge.cancel();
    try {
      const status = await bridge.clearKey(); setConfigured(status.configured); setProtection(status.protection); setKey('');
      setMessage('本机密钥已删除，聊天切回本地陪伴。');
      window.dispatchEvent(new Event('companion-ai-settings-changed'));
    } catch { setMessage('删除失败，请重试。'); } finally { setBusy(false); }
  }
  return <section className="companion-ai-settings" aria-label="DeepSeek 对话设置">
    <h4>DeepSeek 对话</h4>
    <p>连接状态：<strong>{configured ? '已保存密钥' : '本地陪伴'}</strong></p>
    <p>只支持 DeepSeek，模型为 deepseek-chat。联网聊天会发送当前拉姆状态、最近对话和你能查看的记忆；密钥只保存在这台电脑，不随存档导出。</p>
    {bridge ? <form onSubmit={save}>
      <label htmlFor="deepseek-api-key">{configured ? '替换 API Key' : 'API Key'}</label>
      <div className="ai-key-row"><input id="deepseek-api-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} maxLength={256} placeholder="输入 DeepSeek API Key" disabled={busy}/><button type="submit" disabled={busy || !key.trim()}>{busy ? '处理中…' : '保存'}</button></div>
      {configured && <button type="button" className="ai-remove-key" disabled={busy} onClick={() => void remove()}>删除本机密钥</button>}
      {protection === 'os-encrypted' && configured && <small>密钥使用系统加密存储，界面不会读回完整密钥。</small>}
      {protection === 'local-file' && configured && <small>当前系统无法提供系统加密，密钥保存在本机配置文件中。</small>}
    </form> : <p>请在 Windows 桌面版中设置密钥；当前预览使用本地对话。</p>}
    {message && <p role="status" className="ai-settings-message">{message}</p>}
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { GameState } from '../game';
import { appendMessage, buildMessages, clearMemory, editFact, FACT_LABELS, forgetEvent, forgetFact, getCompanionMood, getDiary, localReply, rememberChat, setPersonality, setPlanStatus } from '../companion-memory';
import type { CompanionMemory } from '../companion-memory';
import './CompanionChat.css';

interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionConstructor = new () => Recognition;
const isDocumentHidden = () => document.visibilityState === 'hidden';
type SpeechWindow = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
interface Props {
  pet: GameState; memory: CompanionMemory; onMemoryChange: Dispatch<SetStateAction<CompanionMemory>>;
  onReply(text: string): void; compact?: boolean; onSpeechBusyChange?(busy: boolean): void;
}

export function CompanionChat({ pet, memory, onMemoryChange, onReply, compact = false, onSpeechBusyChange }: Props) {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState('');
  const [retryText, setRetryText] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechNote, setSpeechNote] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [readAloud, setReadAloud] = useState(() => { try { return localStorage.getItem('ramu-chat-read-aloud') === 'true'; } catch { return false; } });
  const alive = useRef(true), request = useRef(0), speechRequest = useRef(0), memoryRef = useRef(memory);
  const recognition = useRef<Recognition | null>(null), messagesEnd = useRef<HTMLDivElement>(null);
  const bridge = window.companionAI;
  const mood = getCompanionMood(memory, pet), diary = getDiary(memory);
  memoryRef.current = memory;
  useEffect(() => {
    alive.current = true;
    const update = () => { void bridge?.getSettings().then(s => { if (alive.current) setConfigured(s.configured); }).catch(() => { if (alive.current) setConfigured(false); }); };
    update(); window.addEventListener('companion-ai-settings-changed', update);
    return () => { alive.current = false; request.current++; speechRequest.current++; bridge?.cancel(); recognition.current?.abort(); window.companionSpeech?.cancel(); window.speechSynthesis?.cancel(); window.removeEventListener('companion-ai-settings-changed', update); };
  }, [bridge]);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ block: 'nearest' }); }, [memory.messages.length, pending]);
  useEffect(() => { onSpeechBusyChange?.(listening || speaking); return () => onSpeechBusyChange?.(false); }, [listening, speaking, onSpeechBusyChange]);
  useEffect(() => {
    // Invalidate the whole speech turn, including an availability check that has
    // not resolved yet. Restoring the window must not resume an old microphone.
    const onVisibilityChange = () => { if (isDocumentHidden()) stopSpeech(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    onVisibilityChange();
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  function updateMemory(transform: (previous: CompanionMemory) => CompanionMemory): CompanionMemory {
    // The ref builds this turn's prompt immediately; the authoritative update
    // must run against the parent's latest state, including batched care events.
    memoryRef.current = transform(memoryRef.current);
    onMemoryChange(transform);
    return memoryRef.current;
  }
  function stopSpeech() {
    speechRequest.current++;
    recognition.current?.abort(); window.companionSpeech?.cancel(); window.speechSynthesis?.cancel();
    setListening(false); setSpeaking(false); setSpeechNote('');
  }
  function speak(text: string) {
    if (!readAloud || isDocumentHidden()) return;
    const synth = window.speechSynthesis;
    if (!synth) { setSpeechNote('这台设备暂不支持语音朗读。'); return; }
    const voice = synth.getVoices().find(v => v.lang.startsWith('zh'));
    if (!voice) { setSpeechNote('没有可用的中文系统语音，请在系统设置中安装中文语音包。'); return; }
    const speechId = ++speechRequest.current;
    synth.cancel(); const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 1.05; utterance.pitch = 1.2; utterance.volume = .65;
    utterance.onstart = () => { if (alive.current && speechRequest.current === speechId) setSpeaking(true); };
    utterance.onend = () => { if (alive.current && speechRequest.current === speechId) setSpeaking(false); };
    utterance.onerror = () => { if (alive.current && speechRequest.current === speechId) { setSpeaking(false); setSpeechNote('朗读未完成，可以继续用文字聊天。'); } };
    synth.speak(utterance);
  }
  async function send(text: string, retry = false) {
    const value = text.trim(); if (!value || pending) return;
    const id = ++request.current;
    const now = Date.now();
    const next = updateMemory(previous => (retry || retryText === value) && previous.messages.at(-1)?.role === 'user' && previous.messages.at(-1)?.content === value ? previous : rememberChat(previous, value, now));
    setInput(''); setError(''); setRetryText(''); setPending(true);
    try {
      const reply = configured && bridge ? await bridge.chat(buildMessages(pet, next, value)) : localReply(pet, next, value);
      if (!alive.current || request.current !== id) return;
      const repliedAt = Date.now();
      updateMemory(previous => appendMessage(previous, 'assistant', reply, repliedAt)); onReply(reply); speak(reply);
    } catch (problem) {
      if (!alive.current || request.current !== id) return;
      setError(problem instanceof Error ? problem.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '这次没有收到回复。');
      setRetryText(value); setInput(value);
    } finally { if (alive.current && request.current === id) setPending(false); }
  }
  function cancel() {
    request.current++; bridge?.cancel(); setPending(false); setError('已停止等待，你的话仍保留在对话里。');
    const last = memoryRef.current.messages.at(-1);
    if (last?.role === 'user') { setRetryText(last.content); setInput(last.content); }
  }
  function toggleReadAloud(enabled: boolean) {
    setReadAloud(enabled); try { localStorage.setItem('ramu-chat-read-aloud', String(enabled)); } catch { /* Optional preference. */ }
    if (!enabled) stopSpeech();
  }
  async function voiceInput() {
    if (isDocumentHidden()) return;
    if (listening) { stopSpeech(); setSpeechNote('已结束录音。'); return; }
    const speechId = ++speechRequest.current;
    window.speechSynthesis?.cancel(); setSpeaking(false);
    if (window.companionSpeech) {
      setListening(true); setSpeechNote('正在检查本机语音识别…');
      try {
        const availability = await window.companionSpeech.getAvailability();
        if (!alive.current || speechRequest.current !== speechId || isDocumentHidden()) return;
        if (!availability.available) { setSpeechNote(availability.reason || '本机没有可用的中文语音识别，请安装中文语音包，或在输入框使用 Win + H 听写。'); return; }
        setSpeechNote('正在听，请说话。本机离线识别，录音不会发送给 DeepSeek。');
        const transcript = await window.companionSpeech.listen();
        if (alive.current && speechRequest.current === speechId && !isDocumentHidden()) {
          if (transcript) { setInput(old => `${old}${old ? ' ' : ''}${transcript}`.slice(0, 1000)); setSpeechNote('已转成文字，确认后点发送。'); }
          else setSpeechNote('这次没有听清，可以重试或继续打字。');
        }
      } catch (problem) { if (alive.current && speechRequest.current === speechId) setSpeechNote(problem instanceof Error ? problem.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '本机语音识别未完成，可以继续打字。'); }
      finally { if (alive.current && speechRequest.current === speechId) setListening(false); }
      return;
    }
    const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) { setSpeechNote('当前运行环境没有语音识别服务。可使用 Windows 语音输入（Win + H）在输入框中听写。'); return; }
    const recognizer = new Constructor(); recognition.current = recognizer;
    recognizer.lang = 'zh-CN'; recognizer.continuous = false; recognizer.interimResults = false;
    recognizer.onresult = result => {
      const transcript = result.results[0]?.[0]?.transcript;
      if (alive.current && speechRequest.current === speechId && !isDocumentHidden() && transcript) { setInput(old => `${old}${old ? ' ' : ''}${transcript}`.slice(0, 1000)); setSpeechNote('已转成文字，确认后点发送。'); }
    };
    recognizer.onerror = event => { if (alive.current && speechRequest.current === speechId) setSpeechNote(event.error === 'not-allowed' ? '麦克风权限未开启，可以继续打字。' : '语音识别未完成，请重试或使用 Windows 听写。'); };
    recognizer.onend = () => { if (alive.current && speechRequest.current === speechId) setListening(false); };
    try { recognizer.start(); setListening(true); setSpeechNote('正在听，请说话。语音识别由浏览器服务提供，可能需要联网。'); }
    catch { setListening(false); setSpeechNote('暂时无法启动麦克风，请使用文字输入。'); }
  }
  function resetMemory() {
    if (pending) cancel(); stopSpeech(); updateMemory(clearMemory); setError(''); setRetryText(''); setInput(''); setEditing(null);
  }
  function forget(id: string, event = false) {
    stopSpeech();
    updateMemory(previous => event ? forgetEvent(previous, id) : forgetFact(previous, id));
    setInput(''); setRetryText(''); setError('');
  }
  function saveEdit() {
    if (!editing || !editValue.trim() || pending) return;
    stopSpeech();
    updateMemory(previous => editing === 'personality' ? setPersonality(previous, editValue) : editFact(previous, editing, editValue));
    setEditing(null); setEditValue(''); setInput(''); setRetryText('');
  }
  return <section className={`companion-chat ${compact ? 'is-compact' : ''}`} aria-label="和拉姆聊天">
    <div className="chat-mode"><span>{configured ? 'DeepSeek · 联网对话' : '本地陪伴 · 无需密钥'}</span><label><input type="checkbox" checked={readAloud} onChange={e => toggleReadAloud(e.target.checked)}/>朗读回复</label></div>
    <div className="companion-history" role="log" aria-label="对话记录" aria-live="polite" aria-relevant="additions">
      {!memory.messages.length && <p className="chat-welcome">咕噜～我是{pet.name}。你可以告诉我怎么称呼你、喜欢什么，我会记在我们的小本子里。</p>}
      {memory.messages.map((entry, index) => <div className={`chat-entry ${entry.role}`} key={`${entry.id}:${index}`}><b>{entry.role === 'user' ? '你' : pet.name}</b><p>{entry.content}</p></div>)}
      {pending && <p className="chat-waiting" role="status">{pet.name}在想怎么回答…</p>}<div ref={messagesEnd}/>
    </div>
    <form className="companion-chat-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(input); }}>
      <label className="chat-input-label" htmlFor="companion-chat-input">和拉姆说话</label>
      <textarea id="companion-chat-input" aria-label="和拉姆说话" rows={2} maxLength={1000} placeholder="比如：叫我小米，我喜欢草莓。" value={input} onChange={e => setInput(e.target.value)} disabled={pending}/>
      <div className="chat-send-row"><button type="button" onClick={() => void voiceInput()} disabled={pending} aria-pressed={listening}>{listening ? '结束录音' : '语音输入'}</button>{pending ? <button type="button" onClick={cancel}>停止等待</button> : <button type="submit" aria-label="发送消息" disabled={!input.trim() || listening}>发送</button>}</div>
    </form>
    {speechNote && <p className="chat-notice" role="status">{speechNote}</p>}
    {error && <div className="chat-error" role="status"><p>{error}</p>{retryText && !pending && <button type="button" onClick={() => void send(retryText, true)}>重试这条消息</button>}</div>}
    <details className="companion-memories"><summary>我们的小本子 · {memory.facts.length} 条记忆</summary>
      <p className="companion-relationship">{mood.label} · {mood.relationship}</p>
      <div className="companion-temperament"><p>{memory.personality}</p><button type="button" disabled={pending} onClick={() => { setEditing('personality'); setEditValue(memory.personality); }}>调整性格</button></div>
      {editing && <div className="memory-editor"><label htmlFor="memory-edit-value">{editing === 'personality' ? '陪伴的语气与性格' : '修改这条记忆'}</label><textarea id="memory-edit-value" value={editValue} maxLength={editing === 'personality' ? 80 : 160} onChange={e => setEditValue(e.target.value)} rows={2}/><div><button type="button" onClick={saveEdit} disabled={pending || !editValue.trim()}>保存修改</button><button type="button" onClick={() => setEditing(null)}>取消</button></div></div>}
      {!memory.facts.length && <p>称呼、喜好、计划，还有你愿意分享的小事，都可以慢慢记下来。</p>}
      <ul>{memory.facts.map(fact => <li key={fact.id}><span><b>{FACT_LABELS[fact.kind]}{fact.kind === 'plan' && fact.status === 'done' ? ' · 已完成' : ''}</b><p>{fact.value}</p>{fact.kind === 'plan' && <button type="button" disabled={pending} onClick={() => { stopSpeech(); updateMemory(previous => setPlanStatus(previous, fact.id, fact.status === 'done' ? 'active' : 'done')); }}>{fact.status === 'done' ? '继续这个计划' : '标记完成'}</button>}</span><div className="memory-row-actions"><button type="button" disabled={pending} aria-label={`修改${FACT_LABELS[fact.kind]}${fact.value}`} onClick={() => { setEditing(fact.id); setEditValue(fact.value); }}>修改</button><button type="button" disabled={pending} aria-label={`忘记${FACT_LABELS[fact.kind]}${fact.value}`} onClick={() => forget(fact.id)}>忘记</button></div></li>)}</ul>
      {!!memory.events.length && <details><summary>一起发生过的小事 · {memory.events.length}</summary><ul>{memory.events.slice(-8).reverse().map(event => <li key={event.id}><span>{new Date(event.at).toLocaleDateString('zh-CN')} · {event.detail}</span><button type="button" disabled={pending} aria-label={`忘记${event.detail}`} onClick={() => forget(event.id, true)}>忘记</button></li>)}</ul></details>}
      {!!diary.length && <details className="companion-diary"><summary>陪伴日记</summary>{diary.slice().reverse().map(day => <article key={day.day}><b>{day.day}</b><ul>{day.moments.map((moment, index) => <li key={index}>{moment}</li>)}</ul></article>)}<p>日记由实际记录整理，删除记忆后也会一起更新。</p></details>}
      <details className="memory-explainer"><summary>记忆如何保存</summary><p>只记下你主动说的话和实际发生的照料。最多保留64条信息、120件小事和80条对话，不读取屏幕或文件。修改或忘记信息时会清除旧对话，避免再次引用。未来计划不会自动当成已经发生。</p></details>
      <button type="button" className="chat-clear-memory" disabled={pending || (!memory.facts.length && !memory.events.length && !memory.messages.length)} onClick={resetMemory}>清空记忆与对话</button>
    </details>
  </section>;
}

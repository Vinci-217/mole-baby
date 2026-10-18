import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { COLORS, FOODS, STAGES, GROWTH_MAX, buyItem, care, createPet, getItem, getPetCondition, getStage, parseSave, rewardGame, tick } from './game';
import type { Action, GameState, PetColor, ItemCategory } from './game';
import Ram from './components/Ram';
import FruitGame from './components/FruitGame';
import MemoryGame from './components/MemoryGame';
import DesktopCompanion from './components/DesktopCompanion';
import { playPetVoice } from './pet-audio';
import type { GameReceipt } from './components/game-receipt';
import CarePocket from './components/CarePocket';
import { CompanionChat } from './components/CompanionChat';
import { AISettings } from './components/AISettings';
import RoomSettings from './components/RoomSettings';
import { useRoomMedia } from './room-media';
import { createMemory, loadMemory, parseMemory, recordCare, recordEvent, saveMemory } from './companion-memory';
import type { CompanionMemory } from './companion-memory';
import './companion-life.css';

const SAVE_KEY = 'ramu-house-save-v1';
const PREFS_KEY = 'ramu-house-preferences-v2';
type Panel = 'status' | 'food' | 'games' | 'growth' | 'chat' | 'settings' | null;
type Preferences = { sound: boolean; quiet: boolean; reminders: boolean; reminderMinutes: number };
type Result = { state: GameState; message: string; ok: boolean };
const titles = { status: '我的拉姆', food: '拉姆的照料口袋', games: '拉姆游乐场', growth: '拉姆成长手册', chat: '和拉姆说说话', settings: '陪伴设置' };
const stats = [{ id: 'hunger', name: '饱食', icon: 'icon-food' }, { id: 'thirst', name: '水分', icon: 'icon-water' }, { id: 'cleanliness', name: '清洁', icon: 'icon-clean' }, { id: 'happiness', name: '心情', icon: 'icon-happy' }, { id: 'health', name: '健康', icon: 'status-health' }, { id: 'energy', name: '精力', icon: 'status-sleep' }] as const;
function readSave() { try { return parseSave(localStorage.getItem(SAVE_KEY), Date.now()); } catch { return null; } }
function readPrefs(): Preferences { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); return { sound: p.sound !== false, quiet: p.quiet === true, reminders: p.reminders !== false, reminderMinutes: [20, 40, 60].includes(p.reminderMinutes) ? p.reminderMinutes : 40 }; } catch { return { sound: true, quiet: false, reminders: true, reminderMinutes: 40 }; } }
const ITEM_IMAGES = ['items/180027', 'items/180017', 'items/180008', 'items/180003', 'items/180004', 'ui/icon-clock'];
function ItemArt({ item, className = '' }: { item: number; className?: string }) { return <img className={`item-art ${className}`} alt="" aria-hidden="true" draggable={false} src={`./assets/original/${ITEM_IMAGES[item]}.png`}/>; }
function UiArt({ name, className = '' }: { name: string; className?: string }) { return <img className={`original-ui-art ${className}`} alt="" aria-hidden="true" draggable={false} src={`./assets/original/ui/${name}.png`}/>; }
function GameDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; dialog.current?.focus();
    const key = (e: KeyboardEvent) => { const stack = document.querySelectorAll('[role=dialog]'); if (stack[stack.length - 1] !== dialog.current) return; if (e.key === 'Escape') close.current(); if (e.key === 'Tab') { const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([type=hidden]),[tabindex="0"]'); if (!items?.length) return; const first = items[0], last = items[items.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="game-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`game-panel ${wide ? 'wide-panel' : ''}`}><header className="panel-header"><h2>{title}</h2><button className="round-close" onClick={onClose} aria-label="关闭面板">×</button></header><div className="panel-paper">{children}</div></section></div>;
}

export default function App() {
  const [pet, setPet] = useState<GameState | null>(readSave);
  const [prefs, setPrefs] = useState<Preferences>(readPrefs);
  const [panel, setPanel] = useState<Panel>(null);
  const [color, setColor] = useState<PetColor>('pink');
  const [name, setName] = useState(pet?.name ?? '小拉姆');
  const [startGrowth, setStartGrowth] = useState(0);
  const [action, setAction] = useState('idle');
  const [petMode, setPetMode] = useState(false);
  const [preview, setPreview] = useState(() => !window.desktop && readSave() !== null);
  const [actionId, setActionId] = useState(0);
  const [desktopState, setDesktopState] = useState<DesktopState>({ petMode: false, alwaysOnTop: false, wandering: false, companionPanel: false, panelSide: 'right' });
  const [toast, setToast] = useState('');
  const [bubble, setBubble] = useState('拉姆～ 我来陪你啦！');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [, setMenuOpen] = useState(false);
  const [game, setGame] = useState<'fruit' | 'memory' | null>(null);
  const [reset, setReset] = useState(false);
  const [pocketCategory, setPocketCategory] = useState<ItemCategory>('food');
  const [pocketVisit, setPocketVisit] = useState(0);
  const [memory, setMemory] = useState<CompanionMemory | null>(() => { const saved = readSave(); return saved ? loadMemory(saved) : null; });
  const [memorySaveError, setMemorySaveError] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [focusUntil, setFocusUntil] = useState<number | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const petRef = useRef(pet); petRef.current = pet;
  const timers = useRef<{ animation?: ReturnType<typeof setTimeout>; toast?: ReturnType<typeof setTimeout>; bubble?: ReturnType<typeof setTimeout> }>({});
  const importInput = useRef<HTMLInputElement>(null);

  const adoptionFocus = useRef<HTMLInputElement>(null);
  const hasPet = pet !== null;
  const current = pet ?? createPet('小拉姆', color);
  const stage = getStage(current.growth);
  const nextStage = STAGES[stage + 1];
  const progress = nextStage ? (current.growth - STAGES[stage].threshold) / (nextStage.threshold - STAGES[stage].threshold) * 100 : 100;
  const floating = petMode || preview;
  const condition = getPetCondition(current);
  const renderedAction = action !== 'idle' ? action : desktopState.motion === 'left' ? 'walk-left' : desktopState.motion === 'right' ? 'walk-right' : condition.action;
  const roomMedia = useRoomMedia(hasPet && !floating, voiceBusy);
  const currentMemory = memory?.petId === String(current.createdAt) ? memory : createMemory(current);
  const days = Math.max(1, Math.floor((Date.now() - current.createdAt) / 86400000) + 1);

  const speak = useCallback((text: string, duration = 6500) => { setBubble(text); setBubbleVisible(true); clearTimeout(timers.current.bubble); timers.current.bubble = setTimeout(() => setBubbleVisible(false), duration); }, []);
  const notify = useCallback((text: string) => { setToast(text); clearTimeout(timers.current.toast); timers.current.toast = setTimeout(() => setToast(''), 3800); }, []);
  useEffect(() => { if (pet) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(pet)); setSaveError(false); } catch { setSaveError(true); } } }, [pet]);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* Pet save has its own error notice. */ } }, [prefs]);
  useEffect(() => { const timer = setInterval(() => setPet(p => p ? tick(p, Date.now()) : p), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const desktop = window.desktop; if (!desktop) return;
    const unsubscribe = desktop.onStateChanged(state => { setDesktopState(state); setPetMode(state.petMode); document.documentElement.classList.toggle('pet-mode', state.petMode); });
    return () => { unsubscribe(); document.documentElement.classList.remove('pet-mode'); };
  }, []);
  useEffect(() => { if (hasPet && window.desktop) { void window.desktop.setPetMode(true).catch(() => notify('暂时无法进入桌宠模式，请再试一次。')); const saved = petRef.current; const nickname = saved ? loadMemory(saved).facts.find(f => f.kind === 'nickname')?.value : undefined; speak(nickname ? `${nickname}，我回来陪你啦。我们的小本子也好好收着呢。` : '拉姆～ 我来陪你啦！'); } }, [hasPet, notify, speak]);
  useEffect(() => { if (!hasPet) adoptionFocus.current?.focus(); }, [hasPet]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);
  useEffect(() => { if (pet && memory?.petId !== String(pet.createdAt)) setMemory(loadMemory(pet)); }, [pet, memory?.petId]);
  useEffect(() => { if (pet && memory?.petId === String(pet.createdAt)) setMemorySaveError(!saveMemory(pet, memory)); }, [pet, memory]);
  useEffect(() => {
    if (!hasPet || prefs.quiet || !prefs.reminders) return;
    const messages = ['陪你工作好一会儿啦，站起来伸伸懒腰吧，我替你守着这里。', '先喝一口水好吗？等你回来，我们继续。', '让眼睛也放个小假，看看窗外远处，再轻轻眨眨眼。'];
    let index = 0;
    const timer = setInterval(() => { if (!petRef.current?.sleeping && !focusUntil) { const text = messages[index++ % messages.length]; speak(text, 12000); setMemory(m => m ? recordEvent(m, { kind: 'reminder', detail: '我提醒你休息、喝水或眺望远处。' }) : m); } }, prefs.reminderMinutes * 60000);
    return () => clearInterval(timer);
  }, [hasPet, prefs.quiet, prefs.reminders, prefs.reminderMinutes, focusUntil, speak]);
  useEffect(() => {
    if (!focusUntil) { setFocusSeconds(0); return; }
    const update = () => { const remaining = Math.max(0, Math.ceil((focusUntil - Date.now()) / 1000)); setFocusSeconds(remaining); if (remaining === 0) { setFocusUntil(null); speak('拉姆～ 专注完成啦！伸个懒腰，休息一下吧。', 12000); window.desktop?.notify('拉姆提醒你', '25 分钟专注结束，起来活动一下吧。'); } };
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [focusUntil, speak]);

  useEffect(() => { void window.desktop?.setPetCanMove(stage > 0 && !pet?.sleeping); if ((pet?.sleeping || stage === 0) && desktopState.wandering) void window.desktop?.wander(false); }, [pet?.sleeping, stage, desktopState.wandering]);

  function animate(next: string) { setActionId(n => n + 1); setAction(next); clearTimeout(timers.current.animation); timers.current.animation = setTimeout(() => setAction('idle'), next === 'wash' ? 1500 : next === 'feed' || next === 'drink' ? 1200 : 900); }
  function chirp(kind: 'pet' | 'feed' | 'drink' | 'wash' | 'sleep' | 'wake' = 'pet') { playPetVoice(kind, prefs.sound); }
  function apply(result: Result, nextAction?: string, detail?: string) {
    const before = petRef.current; petRef.current = result.state; setPet(result.state); notify(result.message); speak(result.message);
    if (result.ok) {
      if (nextAction) { animate(nextAction); chirp(['feed', 'drink', 'wash', 'sleep', 'wake'].includes(nextAction) ? nextAction as 'feed' | 'drink' | 'wash' | 'sleep' | 'wake' : 'pet'); setMemory(m => m ? recordCare(m, nextAction, detail) : m); }
      if (before && getStage(before.growth) < getStage(result.state.growth)) { speak(`${result.state.name}长大啦！现在是${STAGES[getStage(result.state.growth)].name}！`, 10000); setMemory(m => m ? recordEvent(m, { kind: 'growth', detail: `我长成了${STAGES[getStage(result.state.growth)].name}。` }) : m); }
    }
  }
  function doCare(type: Action, itemId?: string) {
    if (type === 'wash' && !itemId) { setPocketCategory('clean'); void openPanel('food'); return; }
    const saved = petRef.current; if (!saved) return;
    const item = getItem(itemId), next = type === 'sleep' && saved.sleeping ? 'wake' : type;
    const detail = item ? `你用${item.name}照料了我。` : type === 'sleep' ? saved.sleeping ? '你轻轻叫醒了我。' : '你让我安心睡了一觉。' : undefined;
    apply(care(saved, type, itemId, Date.now()), next, detail);
  }
  function buy(id: string) { if (petRef.current) apply(buyItem(petRef.current, id), 'buy', `你为我买了${getItem(id)?.name ?? '用品'}。`); }
  function adopt(e: FormEvent) { e.preventDefault(); if (!name.trim()) return; const adopted = createPet(name.trim().slice(0, 12), color); adopted.growth = startGrowth; setPet(adopted); setMemory(recordEvent(createMemory(adopted), { kind: 'adoption', detail: '你把我接回了家，我们开始一起生活。' })); if (!window.desktop) setPreview(true); speak('拉姆～ 好久不见，我们又在一起啦！', 10000); }
  async function toDesktop() { setPanel(null); setMenuOpen(false); await window.desktop?.setCompanionPanel(false); if (window.desktop) { try { await window.desktop.setPetMode(true); } catch { notify('窗口切换失败，请稍后再试。'); } } else setPreview(true); }
  async function openPanel(next: Panel) { if (next === 'food') setPocketVisit(v => v + 1); setPanel(next); if (petMode) { try { await window.desktop?.setCompanionPanel(next !== null); } catch { notify('小窗暂时无法打开，请再试一次。'); } } }
  async function enterHome() { setPanel(null); setPreview(false); await window.desktop?.setPetMode(false); }
  function focusToggle() { if (focusUntil) { setFocusUntil(null); speak('好呀，想休息的时候就休息。'); } else { setFocusUntil(Date.now() + 25 * 60000); speak('拉姆～ 我会安静陪你，25 分钟后提醒你休息。'); } }
  async function toggleWander() { if (!window.desktop) { speak('在 Windows 桌面应用里，我就可以在你的桌面走来走去啦。'); return; } try { await window.desktop.wander(!desktopState.wandering); } catch { notify('暂时无法切换走动状态。'); } }
  function changeMemory(update: CompanionMemory | ((previous: CompanionMemory) => CompanionMemory)) {
    const identity = String(current.createdAt);
    setMemory(previous => {
      const saved = petRef.current; if (!saved || String(saved.createdAt) !== identity) return previous;
      const base = previous?.petId === identity ? previous : loadMemory(saved);
      const next = typeof update === 'function' ? update(base) : update;
      return next.petId === identity ? next : base;
    });
  }
  function onChatReply(text: string) { speak(text, 10000); if (!petRef.current?.sleeping) animate('pet'); }
  function exportSave() { if (!pet) return; const url = URL.createObjectURL(new Blob([JSON.stringify({ ...pet, companionMemory: currentMemory }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `ramu-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('存档已经导出，记得收好。'); }
  async function importSave(file?: File) { if (!file) return; try { if (file.size > 250000) throw Error(); const raw = JSON.parse(await file.text()); const restored = parseSave(JSON.stringify({ ...raw, companionMemory: undefined }), Date.now()); if (!restored) throw Error(); setPet(restored); setMemory(raw.companionMemory ? parseMemory(raw.companionMemory, restored) : loadMemory(restored)); setName(restored.name); notify('存档已恢复，欢迎回来！'); } catch { notify('这个存档无法读取，原来的拉姆仍然保留。'); } if (importInput.current) importInput.current.value = ''; }

  function completeGame(score: number): GameReceipt {
    const now = Date.now(), saved = petRef.current;
    if (!saved) return { ok: false, coins: 0, growth: 0, food: 0, message: '当前没有可领取奖励的拉姆。' };
    const before = tick(saved, now), result = rewardGame(before, score, now);
    const food = FOODS[score >= 8 ? 2 : score >= 5 ? 1 : 0];
    apply(result, 'reward');
    return { ok: result.ok, coins: result.state.coins - before.coins, growth: Math.round((result.state.growth - before.growth) * 100) / 100,
      food: (result.state.inventory[food.id] ?? 0) - (before.inventory[food.id] ?? 0), message: result.message };
  }

  const foodContent = <CarePocket key={`${pocketCategory}:${pocketVisit}`} pet={current} initialCategory={pocketCategory} onCare={doCare} onBuy={buy}/>;
  const chatContent = <CompanionChat key={current.createdAt} pet={current} memory={currentMemory} onMemoryChange={changeMemory} onReply={onChatReply} compact={floating} onSpeechBusyChange={setVoiceBusy}/>;
  const extraSettings = <><AISettings/><RoomSettings media={roomMedia}/><div className="life-settings">
    <label><span>休息与喝水提醒<small>安静陪伴开启时暂停；睡着和专注时不打扰</small></span><input type="checkbox" aria-label="休息与喝水提醒" checked={prefs.reminders} onChange={e => setPrefs(p => ({ ...p, reminders: e.target.checked }))}/></label>
    <label><span>提醒间隔</span><select aria-label="提醒间隔" value={prefs.reminderMinutes} onChange={e => setPrefs(p => ({ ...p, reminderMinutes: Number(e.target.value) }))}><option value={20}>20 分钟</option><option value={40}>40 分钟</option><option value={60}>60 分钟</option></select></label>
    {memorySaveError && <p role="alert">回忆暂未保存，请导出存档备份。</p>}
  </div></>;
  const statusContent = <><div className="profile-heading"><div className="profile-mini"><Ram color={current.color} stage={stage} sleeping={current.sleeping}/></div><div><h3>{current.name}</h3><span>{STAGES[stage].name} · 相伴第 {days} 天 · {condition.label}</span></div><span className="bean-count">● {current.coins} 摩尔豆</span></div><div className="classic-stat-grid">{stats.map(s => <div className="classic-stat" key={s.id}><label><span><UiArt name={s.icon}/>{s.name}</span><b>{Math.round(current.stats[s.id])} / 100</b></label><div role="progressbar" aria-label={s.name} aria-valuenow={Math.round(current.stats[s.id])} aria-valuemin={0} aria-valuemax={100} className={`classic-progress stat-${s.id}`}><i style={{ width: `${current.stats[s.id]}%` }}/></div></div>)}</div><div className="classic-growth"><div><strong>成长进度</strong><span>{Math.floor(current.growth)} / {GROWTH_MAX}</span></div><div className="classic-progress"><i style={{ width: `${progress}%` }}/></div><p>{nextStage ? `再获得 ${Math.ceil(nextStage.threshold - current.growth)} 成长值，就能成为${nextStage.name}。` : '已经是高级拉姆啦！还会一直陪着你。'}</p></div><div className="panel-shortcuts"><button className="game-button green" onClick={() => setPanel('food')}>喂食</button><button className="game-button blue" onClick={() => doCare('wash')}>洗澡</button><button className="game-button" onClick={() => doCare('sleep')}>{current.sleeping ? '叫醒' : '睡一觉'}</button><button className="game-button" onClick={() => setPanel('growth')}>成长手册</button></div></>;

  const gameOverlay = <>{game === 'fruit' && <FruitGame color={current.color} stage={stage} onClose={() => setGame(null)} onComplete={completeGame}/>} {game === 'memory' && <MemoryGame onClose={() => setGame(null)} onComplete={completeGame}/>}</>;
  if (floating && pet) return <div className={petMode ? 'transparent-stage' : 'desktop-preview companion-preview'}>
    {!petMode && <div className="preview-description"><strong>桌面陪伴预览</strong>点击小拉姆展开快捷操作，按住可拖动。<span>Windows 版直接显示在真实桌面上。小屋在照料窗底部单独进入。</span></div>}
    <DesktopCompanion pet={current} stage={stage} action={renderedAction} actionId={actionId} bubble={bubble} bubbleVisible={bubbleVisible} panel={panel} native={petMode} desktopState={desktopState}
      quiet={prefs.quiet} sound={prefs.sound} focusSeconds={focusSeconds} focusing={focusUntil !== null} saveError={saveError || memorySaveError} pocketCategory={pocketCategory} pocketVisit={pocketVisit} chatContent={chatContent} settingsContent={extraSettings}
      onPanel={next => { if (next === 'food') setPocketCategory('food'); void openPanel(next); }} onCare={doCare} onBuy={buy} onGame={setGame} onHome={() => void enterHome()} onFocus={focusToggle} onWander={() => void toggleWander()}
      onQuiet={() => setPrefs(p => ({ ...p, quiet: !p.quiet }))} onSound={() => setPrefs(p => ({ ...p, sound: !p.sound }))}
      onRename={newName => { setPet(p => p ? { ...p, name: newName.slice(0,12) } : p); setName(newName); notify('名字保存好啦。'); }}
      onExport={exportSave} onImport={file => void importSave(file)} onSay={speak} onPet={() => doCare('pet')}/>
    {gameOverlay}{toast && toast !== bubble && <div className="compact-toast" role="status">{toast}</div>}
  </div>;

  return <div className="classic-app">
    <header className="classic-titlebar"><div>摩尔庄园 · 拉姆陪伴</div><div>{window.desktop && <><button onClick={() => window.desktop?.minimize()} aria-label="最小化">－</button><button onClick={() => window.desktop?.close()} aria-label="关闭窗口">×</button></>}</div></header>
    <main className="cottage-scene" data-background={roomMedia.background.id} style={{ backgroundImage: `url("${roomMedia.background.src}")` }}><div className="scene-shade"/><div className="cottage-top"><div className="classic-logo"><span>拉姆</span><b>陪伴</b><small>熟悉的小家伙，又回到身边啦</small></div>{pet && <div className="scene-top-actions"><button className="room-change-button" onClick={() => setPanel('settings')}>换背景 · 音乐</button><span className="coin-sign">● {current.coins} 摩尔豆</span><button className="game-button" onClick={() => void toDesktop()}>回到桌面陪我 ▸</button></div>}</div>
    {pet && <><button className="pet-plaque" onClick={() => setPanel('status')}><span>我的拉姆</span><strong>{current.name}</strong><small>{STAGES[stage].name} · 相伴第{days}天</small></button><div className="scene-pet"><div className={`scene-bubble ${bubbleVisible ? 'visible' : ''}`} role="status">{bubble}</div><button className="scene-character" aria-label="摸摸拉姆" onClick={() => doCare('pet')}><Ram color={current.color} stage={stage} action={renderedAction} actionId={actionId} sleeping={current.sleeping}/></button><span className="scene-pet-name">{current.name}<small>{current.sleeping ? '睡着了 · 点击下方叫醒' : condition.id === 'healthy' ? '点点我，陪我玩呀' : condition.label}</small></span></div><aside className="companion-note"><span>★ 小拉姆来信</span><p>你忙你的，<br/>我在桌面上陪着你。</p><button onClick={() => void toDesktop()}>开启桌面陪伴 ›</button></aside><nav className="classic-dock" aria-label="拉姆互动"><button aria-label="我的拉姆" onClick={() => setPanel('status')}><span className="dock-portrait"><Ram color={current.color} stage={2} artStyle="classic"/></span><b>我的拉姆</b></button><button aria-label="食物口袋" onClick={() => setPanel('food')}><span className="food-dock-symbol"><img alt="" src="./assets/original/items/180001.png"/><img alt="" src="./assets/original/items/180002.png"/></span><b>饮食</b></button><button aria-label="洗澡" onClick={() => doCare('wash')}><ItemArt item={3}/><b>清洁</b></button><button aria-label={current.sleeping ? '叫醒' : '休息'} onClick={() => doCare('sleep')}><ItemArt item={5}/><b>{current.sleeping ? '叫醒' : '睡觉'}</b></button><button aria-label="游乐时光" onClick={() => setPanel('games')}><ItemArt item={4}/><b>小游戏</b></button><button aria-label="和拉姆说话" onClick={() => setPanel('chat')}><UiArt name="toolbar-talk-normal" className="dock-ui-icon"/><b>说说话</b></button><button aria-label="陪伴设置" onClick={() => setPanel('settings')}><UiArt name="icon-save" className="dock-ui-icon"/><b>设置</b></button></nav></>}
    <footer className="classic-footer">{saveError ? '存档空间不足，请从设置导出存档。' : '拉姆陪伴 · 本地自动存档'}<span>《摩尔庄园》非官方同人桌宠</span></footer>
    </main>
    {!pet && <div className="adoption-screen"><section className="adoption-panel"><header className="adoption-header"><span>拉姆领养处</span><h1>好久不见，小拉姆！</h1><p>选一个熟悉的小家伙，继续陪你一起长大。</p></header><form onSubmit={adopt}><div className="adoption-colors">{COLORS.map(c => <button key={c.id} type="button" aria-label={`选择${c.name}拉姆`} aria-pressed={color === c.id} className={`adoption-choice ${color === c.id ? 'chosen' : ''}`} onClick={() => setColor(c.id)}><Ram color={c.id} stage={2} artStyle="classic"/><span style={{ '--swatch': c.hex } as CSSProperties}>{c.name}{color === c.id && <b>✓</b>}</span></button>)}</div><div className="adoption-name"><label htmlFor="pet-name">叫它什么呢？</label><input ref={adoptionFocus} id="pet-name" maxLength={12} value={name} onChange={e => setName(e.target.value)} placeholder="给拉姆起个名字" required/></div><fieldset className="growth-choice"><legend>你想怎样开始？</legend><label><input type="radio" name="start-growth" checked={startGrowth === 0} onChange={() => setStartGrowth(0)}/><span>从种子盆栽开始养<small>花盆固定，陪它慢慢长大</small></span></label><label><input type="radio" name="start-growth" checked={startGrowth === 180} onChange={() => setStartGrowth(180)}/><span>两叶拉姆陪着我<small>从熟悉的中级形态开始</small></span></label></fieldset><button type="submit" className="game-button adopt-cta" disabled={!name.trim()}>带拉姆回家！</button><p className="adoption-note">只有粉、黄、蓝、红四种颜色；从种子到高级始终保持所选颜色。首次领养附赠 100 摩尔豆，用品请到商店购买。</p></form></section></div>}
    {panel && pet && <GameDialog title={titles[panel]} wide={panel === 'growth' || panel === 'games'} onClose={() => setPanel(null)}>
      <nav className="paper-tabs">{(['status', 'food', 'games', 'growth', 'chat', 'settings'] as const).map(p => <button key={p} onClick={() => setPanel(p)} className={panel === p ? 'active' : ''}>{({ status: '状态', food: '口袋', games: '游戏', growth: '成长', chat: '对话', settings: '设置' })[p]}</button>)}</nav>
      {panel === 'status' && statusContent}
      {panel === 'food' && <><div className="pocket-balance">我的摩尔豆：<b>{current.coins}</b></div>{foodContent}</>}
      {panel === 'games' && <><p className="panel-intro">和拉姆玩一局，赚摩尔豆和食物奖励！</p><div className="mini-game-cards"><article><div className="game-card-art berry-game"><ItemArt item={0}/><ItemArt item={0}/><ItemArt item={4}/></div><h3>拉姆接果子</h3><p>移动拉姆接住可可果，20 秒一局。</p><button className="game-button green" disabled={current.sleeping || stage === 0} onClick={() => setGame('fruit')}>开始接果子</button></article><article><div className="game-card-art memory-game"><ItemArt item={1}/><ItemArt item={2}/><ItemArt item={1}/></div><h3>口袋翻翻乐</h3><p>找到相同的图案，45 秒记忆挑战。</p><button className="game-button blue" disabled={current.sleeping} onClick={() => setGame('memory')}>开始翻牌</button></article></div><p className="soft-note">已完成 {current.completedGames} 局 · 每局奖励摩尔豆、1 份食物和成长值</p>{current.sleeping && <p className="soft-note">拉姆在睡觉，叫醒它再一起玩吧。</p>}</>}
      {panel === 'growth' && <><p className="panel-intro">熟悉的原页游形态，一步一步陪它长大。</p><div className="classic-stage-grid">{STAGES.map((s, i) => <article key={s.name} className={stage === i ? 'current-stage' : ''}><div><Ram color={current.color} stage={i as 0 | 1 | 2 | 3}/></div><h3>{s.name}</h3><p>{i === 0 ? '花盆固定，种子身子轻摆' : i === 1 ? '软乎乎的初级拉姆' : i === 2 ? '长出两片熟悉的嫩叶' : '展开扇叶，陪你去更远的地方'}</p><span>{stage === i ? '★ 当前阶段' : stage > i ? '已经长大啦' : `${s.threshold} 成长值`}</span></article>)}</div><p className="soft-note">当前成长：{Math.floor(current.growth)} / {GROWTH_MAX}。喂食、照料、玩游戏和健康陪伴都能获得成长值。</p><p className="small-print">保留原版成长形态，成长速度按桌面玩法调整。超级拉姆不属于普通成长阶段。</p></>}
      {panel === 'chat' && chatContent}
      {panel === 'settings' && <>{extraSettings}<div className="classic-setting"><label htmlFor="rename">拉姆的名字</label><form onSubmit={e => { e.preventDefault(); if (pet && name.trim()) { setPet({ ...pet, name: name.trim().slice(0, 12) }); notify('名字保存好啦。'); } }}><input id="rename" aria-label="拉姆的新名字" value={name} maxLength={12} onChange={e => setName(e.target.value)}/><button className="game-button small" disabled={!name.trim()}>保存</button></form></div><div className="classic-setting original-art-note"><UiArt name="sprout"/><div><strong>拉姆与晨光小屋</strong><small>小尺寸桌宠 · 点击互动，照料留在桌面</small></div></div><div className="classic-setting"><div><strong>安静陪伴</strong><small>不开口打扰，点击互动时才回应</small></div><button className={`classic-toggle ${prefs.quiet ? 'on' : ''}`} role="switch" aria-label="安静陪伴" aria-checked={prefs.quiet} onClick={() => setPrefs(p => ({ ...p, quiet: !p.quiet }))}><i/></button></div><div className="classic-setting"><div><strong>互动音效</strong><small>摸摸或照料时轻轻回应</small></div><button className={`classic-toggle ${prefs.sound ? 'on' : ''}`} role="switch" aria-label="互动音效" aria-checked={prefs.sound} onClick={() => setPrefs(p => ({ ...p, sound: !p.sound }))}><i/></button></div><div className="classic-setting"><div><strong>桌面散步</strong><small>{window.desktop ? '偶尔走一小段，不抢走你的焦点' : 'Windows 桌面应用中可用'}</small></div><button className={`classic-toggle ${desktopState.wandering ? 'on' : ''}`} role="switch" aria-label="桌面散步" aria-checked={desktopState.wandering} disabled={!window.desktop} onClick={() => void toggleWander()}><i/></button></div><div className="classic-setting"><div><strong>陪我专注</strong><small>25 分钟后提醒休息，过程中保持安静</small></div><button className="game-button small" onClick={focusToggle}>{focusUntil ? '结束专注' : '开始25分钟'}</button></div><div className="classic-setting"><div><strong>保存我们的回忆</strong><small>存档仅保存在本机，可以备份或迁移</small></div><div className="setting-buttons"><button className="game-button small" onClick={exportSave}>导出</button><button className="game-button small" onClick={() => importInput.current?.click()}>导入</button><input ref={importInput} hidden type="file" accept="application/json,.json" onChange={e => void importSave(e.target.files?.[0])}/></div></div><div className="classic-setting"><span>重新领养（会替换当前进度）</span><button className="plain-danger" onClick={() => setReset(true)}>重新领养</button></div><p className="small-print">拉姆陪伴 v0.5.0 · 《摩尔庄园》非官方个人同人桌宠</p></>}
      <div className="panel-desktop-return"><button className="game-button" onClick={() => void toDesktop()}>让拉姆回到桌面陪我 ▸</button></div>
    </GameDialog>}
    {reset && <GameDialog title="重新领养一只拉姆？" onClose={() => setReset(false)}><p className="panel-intro">这会替换 {current.name} 的成长、食物和摩尔豆。可以先导出存档，把这段回忆收好。</p><div className="confirm-buttons"><button className="game-button" onClick={exportSave}>先导出存档</button><button className="game-button green" onClick={() => { try { localStorage.removeItem(SAVE_KEY); } catch { /* New save will report storage errors. */ } setPet(null); setReset(false); setPanel(null); setName('小拉姆'); }}>确认重新领养</button></div></GameDialog>}
    {game === 'fruit' && <FruitGame color={current.color} stage={stage} onClose={() => setGame(null)} onComplete={completeGame}/>}
    {game === 'memory' && <MemoryGame onClose={() => setGame(null)} onComplete={completeGame}/>}
    {toast && <div className="classic-toast" role="status">{toast}</div>}
  </div>;
}

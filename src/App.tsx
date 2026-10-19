import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { COLORS, FOODS, STAGES, EVOLUTIONS, GROWTH_MAX, evolvePet, GROWTH_STAGE_HOURS, buyItem, care, createPet, getItem, getPetCondition, getStage, parseSave, rewardGame, tick } from './game';
import type { Action, GameState, PetColor, ItemCategory, Evolution } from './game';
import Ram from './components/Ram';
import FruitGame from './components/FruitGame';
import MemoryGame from './components/MemoryGame';
import DesktopCompanion from './components/DesktopCompanion';
import type { CompanionPanel } from './components/DesktopCompanion';
import ShopBook from './components/ShopBook';
import TimeScene from './components/TimeScene';
import MoreGames from './components/MoreGames';
import type { ExtraGame } from './components/MoreGames';
import { getItemMotion } from './item-motion';
import { getRamActionDuration } from './components/ram-animation';
import { playPetVoice } from './pet-audio';
import type { GameReceipt } from './components/game-receipt';
import CarePocket from './components/CarePocket';
import { CompanionChat } from './components/CompanionChat';
import { AISettings } from './components/AISettings';
import RoomSettings from './components/RoomSettings';
import { useRoomMedia } from './room-media';
import { createMemory, loadMemory, parseMemory, recordCare, recordEvent, saveMemory, memoryKey, getCompanionMood } from './companion-memory';
import type { CompanionMemory } from './companion-memory';
import './companion-life.css';
import { useRestReminder, validReminderMinutes, reminderTime } from './use-rest-reminder';

const SAVE_KEY = 'ramu-house-save-v1';
const PREFS_KEY = 'ramu-house-preferences-v2';
type Panel = CompanionPanel | 'shop' | 'games' | 'growth' | 'settings' | null;
type GameKind = 'fruit' | 'memory' | ExtraGame;
type Preferences = { sound: boolean; quiet: boolean; reminders: boolean; reminderMinutes: number };
type Result = { state: GameState; message: string; ok: boolean };
const titles = { status:'我的拉姆',food:'拉姆的背包',play:'一起玩耍',shop:'拉姆用品商店',games:'小屋游戏',growth:'一起长大',chat:'和拉姆说说话',settings:'小屋设置' };
const stats = [{ id: 'hunger', name: '饱食', icon: 'icon-food' }, { id: 'thirst', name: '水分', icon: 'icon-water' }, { id: 'cleanliness', name: '清洁', icon: 'icon-clean' }, { id: 'happiness', name: '心情', icon: 'icon-happy' }, { id: 'health', name: '健康', icon: 'status-health' }, { id: 'energy', name: '精力', icon: 'status-sleep' }] as const;
function readSave() { try { return parseSave(localStorage.getItem(SAVE_KEY), Date.now()); } catch { return null; } }
function readPrefs(): Preferences { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); return { sound: p.sound !== false, quiet: p.quiet === true, reminders: p.reminders !== false, reminderMinutes: validReminderMinutes(p.reminderMinutes) }; } catch { return { sound: true, quiet: false, reminders: true, reminderMinutes: 40 }; } }
const ITEM_IMAGES = ['items/180027', 'items/180017', 'items/180008', 'items/180003', 'items/180004', 'ui/icon-clock'];
function ItemArt({ item, className = '' }: { item: number; className?: string }) { return <img className={`item-art ${className}`} alt="" aria-hidden="true" draggable={false} src={`./assets/original/${ITEM_IMAGES[item]}.png`}/>; }
function UiArt({ name, className = '' }: { name: string; className?: string }) { return <img className={`original-ui-art ${className}`} alt="" aria-hidden="true" draggable={false} src={`./assets/original/ui/${name}.png`}/>; }
function GameDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; dialog.current?.focus();
    const key = (e: KeyboardEvent) => { const stack = document.querySelectorAll('[role=dialog]'); if (stack[stack.length - 1] !== dialog.current) return; if (e.key === 'Escape') close.current(); if (e.key === 'Tab') { const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type=hidden]),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]'); if (!items?.length) return; const first = items[0], last = items[items.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } };
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
  const [adoptionStep, setAdoptionStep] = useState<'color' | 'name'>('color');
  const [waitingForReopen, setWaitingForReopen] = useState(false);
  const awaitingAdoption = useRef(false);
  const careUntil = useRef(0);
  const [actionItemId, setActionItemId] = useState<string | undefined>();
  const [action, setAction] = useState('idle');
  const [petMode, setPetMode] = useState(false);
  const [preview, setPreview] = useState(() => !window.desktop && readSave() !== null);
  const [actionId, setActionId] = useState(0);
  const [desktopState, setDesktopState] = useState<DesktopState>({ petMode:false,alwaysOnTop:false,wandering:true,companionPanel:false,panelSide:'right',edgeHiding:true,edgeSide:null,edgePose:'visible' });
  const [toast, setToast] = useState('');
  const [bubble, setBubble] = useState('拉姆～ 我来陪你啦！');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [game, setGame] = useState<GameKind | null>(null);
  const [reset, setReset] = useState(false);
  const [evolutionChoice, setEvolutionChoice] = useState<Evolution>('super');
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
  const stage = getStage(current.growth, current.evolution);
  const nextStage = stage < 4 ? STAGES[stage + 1] : undefined;
  const progress = nextStage ? (current.growth - STAGES[stage].threshold) / (nextStage.threshold - STAGES[stage].threshold) * 100 : 100;
  const floating = petMode || preview;
  const condition = getPetCondition(current);
  const renderedAction = action !== 'idle' ? action : desktopState.motion === 'left' ? 'walk-left' : desktopState.motion === 'right' ? 'walk-right' : condition.action;
  const roomMedia = useRoomMedia(hasPet && !floating, voiceBusy);
  const currentMemory = memory?.petId === String(current.createdAt) ? memory : createMemory(current);
  const days = Math.max(1, Math.floor((Date.now() - current.createdAt) / 86400000) + 1);

  const speak = useCallback((text: string, duration = 6500) => { setBubble(text); setBubbleVisible(true); clearTimeout(timers.current.bubble); timers.current.bubble = setTimeout(() => setBubbleVisible(false), duration); }, []);
  const notify = useCallback((text: string) => { setToast(text); clearTimeout(timers.current.toast); timers.current.toast = setTimeout(() => setToast(''), 3800); }, []);
  useEffect(() => { if (pet && petRef.current?.createdAt === pet.createdAt && !awaitingAdoption.current) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(pet)); setSaveError(false); } catch { setSaveError(true); } } }, [pet]);
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* Pet save has its own error notice. */ } }, [prefs]);
  useEffect(() => { const timer = setInterval(() => setPet(p => p ? tick(p, Date.now()) : p), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const desktop = window.desktop; if (!desktop) return;
    const unsubscribe = desktop.onStateChanged(state => { setDesktopState(state); setPetMode(state.petMode); document.documentElement.classList.toggle('pet-mode', state.petMode); });
    return () => { unsubscribe(); document.documentElement.classList.remove('pet-mode'); };
  }, []);
  useEffect(() => {
    const desktop = window.desktop; if (!desktop) return;
    if (awaitingAdoption.current) { desktop.readyToShow(false); return; }
    let cancelled = false;
    void desktop.setPetMode(hasPet).then(() => requestAnimationFrame(() => requestAnimationFrame(() => { if (!cancelled) desktop.readyToShow(hasPet); }))).catch(() => notify('窗口暂时未能准备好，请从托盘重试。'));
    if (hasPet) { const saved = petRef.current, nickname = saved ? loadMemory(saved).facts.find(f => f.kind === 'nickname')?.value : undefined; speak(nickname ? `${nickname}，我回来陪你啦。` : '拉姆～我来陪你啦！'); }
    return () => { cancelled = true; };
  }, [hasPet, notify, speak]);
  useEffect(() => { if (floating && game) setGame(null); }, [floating, game]);
  useEffect(() => { if (!hasPet) adoptionFocus.current?.focus(); }, [hasPet]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);
  useEffect(() => { if (pet && memory?.petId !== String(pet.createdAt)) setMemory(loadMemory(pet)); }, [pet, memory?.petId]);
  useEffect(() => { if (pet && petRef.current?.createdAt === pet.createdAt && !awaitingAdoption.current && memory?.petId === String(pet.createdAt)) setMemorySaveError(!saveMemory(pet, memory)); }, [pet, memory]);
  const reminderIndex = useRef(0);
  const reminderPaused = prefs.quiet || current.sleeping || Boolean(focusUntil);
  const reminderSeconds = useRestReminder(pet?.createdAt, prefs.reminders, prefs.reminderMinutes, reminderPaused, () => {
    const messages = ['陪你工作好一会儿啦，站起来伸伸懒腰吧，我替你守着这里。', '先喝一口水好吗？等你回来，我们继续。', '让眼睛也放个小假，看看窗外远处，再轻轻眨眨眼。'];
    speak(messages[reminderIndex.current++ % messages.length], 12000);
    setMemory(m => m ? recordEvent(m, { kind: 'reminder', detail: '我提醒你休息、喝水或眺望远处。' }) : m);
  });
  useEffect(() => {
    if (!focusUntil) { setFocusSeconds(0); return; }
    const update = () => { const remaining = Math.max(0, Math.ceil((focusUntil - Date.now()) / 1000)); setFocusSeconds(remaining); if (remaining === 0) { setFocusUntil(null); speak('拉姆～ 专注完成啦！伸个懒腰，休息一下吧。', 12000); window.desktop?.notify('拉姆提醒你', '25 分钟专注结束，起来活动一下吧。'); } };
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [focusUntil, speak]);

  useEffect(() => { void window.desktop?.setPetCanMove(hasPet && stage > 0 && !pet?.sleeping); }, [hasPet,pet?.sleeping,stage]);

  function animate(next: string, itemId?: string) {
    const motion = itemId ? getItemMotion(itemId) : null;
    const duration = motion?.duration ?? getRamActionDuration(next) ?? 900;
    setActionId(n => n + 1); setActionItemId(itemId); setAction(motion?.action ?? next);
    careUntil.current = itemId ? Date.now() + duration : 0;
    clearTimeout(timers.current.animation); timers.current.animation = setTimeout(() => { setAction('idle'); setActionItemId(undefined); }, duration + 50);
  }
  function chirp(kind: 'pet' | 'feed' | 'drink' | 'wash' | 'sleep' | 'wake' = 'pet') { playPetVoice(kind, prefs.sound); }
  function apply(result: Result, nextAction?: string, detail?: string, itemId?: string) {
    const before = petRef.current; petRef.current = result.state; setPet(result.state); notify(result.message); speak(result.message);
    if (result.ok) {
      if (nextAction) { if (nextAction !== 'buy' || Date.now() >= careUntil.current) { animate(nextAction, itemId); chirp(['feed', 'drink', 'wash', 'sleep', 'wake'].includes(nextAction) ? nextAction as 'feed' | 'drink' | 'wash' | 'sleep' | 'wake' : 'pet'); } setMemory(m => m ? recordCare(m, nextAction, detail) : m); }
      if (before && getStage(before.growth, before.evolution) < getStage(result.state.growth, result.state.evolution)) { speak(`${result.state.name}长大啦！现在是${STAGES[getStage(result.state.growth, result.state.evolution)].name}！`, 10000); setMemory(m => m ? recordEvent(m, { kind: 'growth', detail: `我长成了${STAGES[getStage(result.state.growth, result.state.evolution)].name}。` }) : m); }
    }
  }
  function doCare(type: Action, itemId?: string) {
    if (type === 'wash' && !itemId) { setPocketCategory('clean'); void openPanel('food'); return; }
    const saved = petRef.current; if (!saved) return;
    if (type !== 'sleep' && Date.now() < careUntil.current) return;
    const item = getItem(itemId), next = type === 'sleep' && saved.sleeping ? 'wake' : type;
    const detail = item ? `你用${item.name}照料了我。` : type === 'sleep' ? saved.sleeping ? '你轻轻叫醒了我。' : '你让我安心睡了一觉。' : undefined;
    apply(care(saved, type, itemId, Date.now()), next, detail, itemId);
  }
  function buy(id: string) { if (floating) { notify('到小屋商店挑选用品吧。'); return; } if (petRef.current) apply(buyItem(petRef.current, id), 'buy', `你为我买了${getItem(id)?.name ?? '用品'}。`); }
  function adopt(e: FormEvent) { e.preventDefault(); if (!name.trim()) return; const adopted = createPet(name.trim().slice(0, 12), color); awaitingAdoption.current = false; setWaitingForReopen(false); setPet(adopted); setMemory(recordEvent(createMemory(adopted), { kind: 'adoption', detail: '你把我接回了家，我们开始一起生活。' })); if (!window.desktop) setPreview(true); speak('拉姆～ 好久不见，我们又在一起啦！', 10000); }
  async function toDesktop() { setPanel(null); setGame(null); await window.desktop?.setCompanionPanel(false); if (window.desktop) { try { await window.desktop.setPetMode(true); } catch { notify('窗口切换失败，请稍后再试。'); } } else setPreview(true); }
  async function openPanel(next: Panel) { if (floating && next && ['shop','games','growth','settings'].includes(next)) { await enterHome(next); return; } if (next === 'food') setPocketVisit(v => v + 1); setPanel(next); if (petMode) { try { await window.desktop?.setCompanionPanel(next !== null); } catch { notify('小窗暂时无法打开，请再试一次。'); } } }
  async function enterHome(next: Panel = null) { setPanel(next); setGame(null); setPreview(false); await window.desktop?.setCompanionPanel(false); await window.desktop?.setPetMode(false); }
  function focusToggle() { if (focusUntil) { setFocusUntil(null); speak('好呀，想休息的时候就休息。'); } else { setFocusUntil(Date.now() + 25 * 60000); speak('拉姆～ 我会安静陪你，25 分钟后提醒你休息。'); } }
  async function toggleWander() { if (!window.desktop) { speak('在桌面应用里，我就可以在你的桌面走来走去啦。'); return; } try { await window.desktop.wander(!desktopState.wandering); } catch { notify('暂时无法切换走动状态。'); } }
  function startGame(kind: GameKind) {
    if (floating) { void enterHome('games'); return; }
    if (petRef.current?.sleeping) { notify('先轻轻叫醒拉姆吧。'); return; }
    setGame(kind);
  }
  async function abandonPet() {
    const saved = petRef.current; if (!saved) return;
    awaitingAdoption.current = true; petRef.current = null;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(memoryKey(saved)); }
    catch { awaitingAdoption.current = false; petRef.current = saved; notify('暂时无法移除存档，请稍后重试。'); return; }
    window.companionAI?.cancel(); window.companionSpeech?.cancel(); window.speechSynthesis?.cancel();
    setPet(null); setMemory(null); setReset(false); setPanel(null); setGame(null); setFocusUntil(null); setPreview(false); setName('小拉姆'); setAdoptionStep('color'); setWaitingForReopen(true); setAction('idle'); setActionItemId(undefined); careUntil.current = 0;
    clearTimeout(timers.current.animation); clearTimeout(timers.current.bubble); setBubbleVisible(false); setToast('');
    window.desktop?.readyToShow(false); window.desktop?.hideToTray();
    await window.desktop?.setPetCanMove(false); await window.desktop?.setCompanionPanel(false); await window.desktop?.setPetMode(false);
    // Pending old renders cannot write through the guards above. This final
    // removal also covers a tick that was already queued before the farewell.
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(memoryKey(saved)); } catch { /* Initial removal succeeded. */ }
    window.desktop?.hideToTray();
  }
  function changeMemory(update: CompanionMemory | ((previous: CompanionMemory) => CompanionMemory)) {
    const identity = String(current.createdAt);
    setMemory(previous => {
      const saved = petRef.current; if (!saved || String(saved.createdAt) !== identity) return previous;
      const base = previous?.petId === identity ? previous : loadMemory(saved);
      const next = typeof update === 'function' ? update(base) : update;
      return next.petId === identity ? next : base;
    });
  }
  function onChatReply(text: string) { speak(text, 10000); if (!petRef.current?.sleeping && Date.now() >= careUntil.current) animate('pet'); }
  function exportSave() { if (!pet) return; const url = URL.createObjectURL(new Blob([JSON.stringify({ ...pet, companionMemory: currentMemory }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `ramu-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('存档已经导出，记得收好。'); }
  async function importSave(file?: File) { if (!file) return; try { if (file.size > 1000000) throw Error(); const raw = JSON.parse(await file.text()); const restored = parseSave(JSON.stringify({ ...raw, companionMemory: undefined }), Date.now()); if (!restored) throw Error(); setPet(restored); setMemory(raw.companionMemory ? parseMemory(raw.companionMemory, restored) : loadMemory(restored)); setName(restored.name); notify('存档已恢复，欢迎回来！'); } catch { notify('这个存档无法读取，原来的拉姆仍然保留。'); } if (importInput.current) importInput.current.value = ''; }

  function completeGame(score: number): GameReceipt {
    const now = Date.now(), saved = petRef.current;
    if (!saved) return { ok: false, coins: 0, growth: 0, food: 0, message: '当前没有可领取奖励的拉姆。' };
    const before = tick(saved, now), result = rewardGame(before, score, now);
    const food = FOODS[score >= 8 ? 2 : score >= 5 ? 1 : 0];
    apply(result, 'reward');
    return { ok: result.ok, coins: result.state.coins - before.coins, growth: Math.round((result.state.growth - before.growth) * 100) / 100,
      food: (result.state.inventory[food.id] ?? 0) - (before.inventory[food.id] ?? 0), message: result.message };
  }

  const mood = getCompanionMood(currentMemory, current);
  const visitShop = () => { void enterHome('shop'); };
  const foodContent = <CarePocket key={`${pocketCategory}:${pocketVisit}`} pet={current} initialCategory={pocketCategory} onCare={doCare} busy={Boolean(actionItemId)} allowShop={!floating} onVisitShop={visitShop}/>;
  const chatContent = <CompanionChat key={current.createdAt} pet={current} memory={currentMemory} onMemoryChange={changeMemory} onReply={onChatReply} compact={floating} onSpeechBusyChange={setVoiceBusy}/>;
  const extraSettings = <><AISettings/><RoomSettings media={roomMedia}/><div className="life-settings">
    <label><span>休息与喝水提醒</span><input type="checkbox" aria-label="休息与喝水提醒" checked={prefs.reminders} onChange={e => setPrefs(p => ({ ...p, reminders: e.target.checked }))}/></label>
    <label><span>提醒间隔</span><span className="reminder-interval"><input type="number" min={1} max={240} step={1} aria-label="提醒间隔" defaultValue={prefs.reminderMinutes} onBlur={e => { if (validReminderMinutes(e.target.valueAsNumber) !== e.target.valueAsNumber) e.target.value = String(prefs.reminderMinutes); }} onChange={e => { const minutes = e.target.valueAsNumber; if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 240) setPrefs(p => ({ ...p, reminderMinutes: minutes })); }}/> 分钟</span></label>
    {memorySaveError && <p role="alert">回忆暂未保存，请导出备份。</p>}
  </div></>;
  const statusContent = <><div className="profile-heading"><div className="profile-mini"><Ram color={current.color} stage={stage} evolution={current.evolution} sleeping={current.sleeping}/></div><div><h3>{current.name}</h3><span>{STAGES[stage].name} · 相伴第 {days} 天</span></div><span className="bean-count">{current.coins} 摩尔豆</span></div><div className="pet-relationship"><b>{mood.label}</b><span>{mood.relationship}</span></div><div className="classic-stat-grid">{stats.map(s => <div className="classic-stat" key={s.id}><label><span><UiArt name={s.icon}/>{s.name}</span><b>{Math.round(current.stats[s.id])}</b></label><div role="progressbar" aria-label={s.name} aria-valuenow={Math.round(current.stats[s.id])} aria-valuemin={0} aria-valuemax={100} className={`classic-progress stat-${s.id}`}><i style={{ width: `${current.stats[s.id]}%` }}/></div></div>)}</div><p className="room-condition">{condition.description}</p><div className="panel-shortcuts"><button className="game-button green" onClick={() => { setPocketCategory('food'); setPanel('food'); }}>打开背包</button><button className="game-button" onClick={() => doCare('sleep')}>{current.sleeping ? '叫醒拉姆' : '睡一觉'}</button></div></>;
  const gameOverlay = <>{game === 'fruit' && <FruitGame color={current.color} stage={stage} evolution={current.evolution} onClose={() => setGame(null)} onComplete={completeGame}/>} {game === 'memory' && <MemoryGame onClose={() => setGame(null)} onComplete={completeGame}/>} {game && !['fruit','memory'].includes(game) && <MoreGames kind={game as ExtraGame} onClose={() => setGame(null)} onComplete={completeGame}/>}</>;

  if (floating && pet) return <div className={petMode ? 'transparent-stage' : 'desktop-preview companion-preview'}>
    {!petMode && <div className="preview-description"><strong>拉姆 · 桌面预览</strong><span>点一下互动，按住拖动。</span></div>}
    <DesktopCompanion pet={current} stage={stage} action={renderedAction} actionId={actionId} itemId={actionItemId} bubble={bubble} bubbleVisible={bubbleVisible}
      panel={panel && ['status','food','play','chat'].includes(panel) ? panel as CompanionPanel : null} native={petMode} desktopState={desktopState}
      sound={prefs.sound} reminderSeconds={reminderSeconds} reminders={prefs.reminders} reminderPaused={reminderPaused} focusSeconds={focusSeconds} focusing={focusUntil !== null} saveError={saveError || memorySaveError} pocketCategory={pocketCategory} pocketVisit={pocketVisit} chatContent={chatContent}
      onPanel={next => { if (next === 'food') setPocketCategory('food'); void openPanel(next); }} onCare={doCare} onHome={() => void enterHome()} onShop={visitShop} onFocus={focusToggle} onSay={speak} onPet={() => doCare('pet')}/>
    {toast && toast !== bubble && <div className="compact-toast" role="status">{toast}</div>}
  </div>;

  if (!pet && waitingForReopen && !window.desktop) return <div className="farewell-page"><img src="./icons/ramu.png" alt=""/><h1>好好说了再见</h1><p>这只拉姆和它的回忆已从本机移除。</p><button className="game-button" onClick={() => location.reload()}>重新打开领养处</button></div>;

  return <div className="classic-app ramu-v6">
    <header className="classic-titlebar"><div>拉姆</div><div>{window.desktop && <><button onClick={() => window.desktop?.minimize()} aria-label="最小化到托盘">－</button><button onClick={() => window.desktop?.close()} aria-label="关闭窗口" title="收进托盘">×</button></>}</div></header>
    <TimeScene media={roomMedia}>
      <div className="cottage-top"><div className="classic-logo"><img src="./icons/ramu.png" alt="两叶拉姆"/><span>拉姆</span></div>{pet && <div className="scene-top-actions"><button className="room-change-button" onClick={() => setPanel('settings')}>布置小屋</button><span className="coin-sign">{current.coins} 摩尔豆</span><button className="game-button" onClick={() => void toDesktop()}>回到桌面</button></div>}</div>
      {pet && <><button className="pet-plaque" onClick={() => setPanel('status')}><span>我的拉姆</span><strong>{current.name}</strong><small>{STAGES[stage].name} · 第 {days} 天</small></button>
        <div className="scene-pet"><div className={`scene-bubble ${bubbleVisible ? 'visible' : ''}`} role="status">{bubble}</div><button className="scene-character" aria-label="摸摸拉姆" onClick={() => doCare('pet')}><Ram color={current.color} stage={stage} evolution={current.evolution} action={renderedAction} actionId={actionId} itemId={actionItemId} sleeping={current.sleeping}/></button><span className="scene-pet-name">{current.name}<small>{current.sleeping ? '睡着了，点休息可叫醒' : mood.label}</small>{prefs.reminders && <small role="timer" aria-label="小屋休息提醒倒计时">{reminderPaused ? '提醒已暂停' : '休息'} {reminderTime(reminderSeconds)}</small>}</span></div>
        <nav className="classic-dock room-dock" aria-label="小屋功能">
          <button aria-label="我的拉姆" onClick={() => setPanel('status')}><UiArt name="status-health"/><b>状态</b></button>
          <button aria-label="打开背包" onClick={() => { setPocketCategory('food'); setPanel('food'); }}><UiArt name="toolbar-bag-normal"/><b>背包</b></button>
          <button aria-label="进入商店" onClick={() => setPanel('shop')}><UiArt name="icon-book-large"/><b>商店</b></button>
          <button aria-label="游乐时光" onClick={() => setPanel('games')}><ItemArt item={4}/><b>游戏</b></button>
          <button aria-label="成长手册" onClick={() => setPanel('growth')}><UiArt name="sprout"/><b>成长</b></button>
          <button aria-label="和拉姆说话" onClick={() => setPanel('chat')}><UiArt name="toolbar-talk-normal"/><b>对话</b></button>
          <button aria-label="陪伴设置" onClick={() => setPanel('settings')}><UiArt name="icon-save"/><b>设置</b></button>
        </nav></>}
      <footer className="classic-footer">{saveError ? '存档未保存，请导出备份' : 'mole-baby · 本地自动保存'}<span>非官方同人桌宠</span></footer>
    </TimeScene>
    {!pet && <div className="adoption-screen"><section className="adoption-panel"><header className="adoption-header"><h1>{adoptionStep === 'color' ? '领养一只拉姆' : '给它起个名字'}</h1></header><form onSubmit={e => { if (adoptionStep === 'color') { e.preventDefault(); setAdoptionStep('name'); } else adopt(e); }}>
      {adoptionStep === 'color' ? <div className="adoption-colors">{COLORS.map(c => <button key={c.id} type="button" aria-label={`选择${c.name}拉姆`} aria-pressed={color === c.id} className={`adoption-choice ${color === c.id ? 'chosen' : ''}`} onClick={() => setColor(c.id)}><Ram color={c.id} stage={0}/><span style={{ '--swatch': c.hex } as CSSProperties}>{c.name}{color === c.id && <b>✓</b>}</span></button>)}</div>
        : <><div className="adoption-selected"><Ram color={color} stage={0}/></div><div className="adoption-name"><label htmlFor="pet-name">它的名字</label><input ref={adoptionFocus} id="pet-name" maxLength={12} value={name} onChange={e => setName(e.target.value)} placeholder="给拉姆起个名字" required autoFocus/></div></>}
      <button type="submit" className="game-button adopt-cta" disabled={adoptionStep === 'name' && !name.trim()}>{adoptionStep === 'color' ? '给它起名' : '带拉姆回家！'}</button>
      {adoptionStep === 'name' && <button type="button" className="adoption-back" onClick={() => setAdoptionStep('color')}>重新选颜色</button>}
      <p className="adoption-note">从一颗种子慢慢养大。赠送 100 摩尔豆，用品到小屋挑选。</p>
    </form></section></div>}
    {panel && pet && <GameDialog title={titles[panel]} wide={['shop','growth','games','settings'].includes(panel)} onClose={() => setPanel(null)}>
      <nav className="paper-tabs" aria-label="小屋页面">{(['status','food','shop','games','growth','chat','settings'] as const).map(p => <button key={p} onClick={() => setPanel(p)} className={panel === p ? 'active' : ''}>{({status:'状态',food:'背包',shop:'商店',games:'游戏',growth:'成长',chat:'对话',settings:'设置'})[p]}</button>)}</nav>
      {panel === 'status' && statusContent}
      {panel === 'food' && foodContent}
      {panel === 'shop' && <ShopBook pet={current} onBuy={buy}/>}
      {panel === 'games' && <><div className="room-game-grid">{([
        { id:'fruit',name:'拉姆接果子',icon:'180027',detail:'20 秒 · 接住果子',button:'开始接果子',grown:true },
        { id:'memory',name:'口袋翻翻乐',icon:'180017',detail:'45 秒 · 找到相同图案',button:'开始翻牌',grown:false },
        { id:'rhythm',name:'拉姆拍拍乐',icon:'180004',detail:'20 秒 · 跟着节拍',button:'开始拍拍乐',grown:false },
        { id:'orchard',name:'草地采果',icon:'180028',detail:'15 秒 · 眼明手快',button:'开始采果',grown:false },
        { id:'puzzle',name:'小屋拼拼乐',icon:'180070',detail:'九宫格 · 拼好小屋',button:'开始拼图',grown:false },
      ] as const).map(g => <article key={g.id}><img src={`./assets/original/items/${g.icon}.png`} alt=""/><h3>{g.name}</h3><p>{g.detail}</p><button className="game-button" disabled={current.sleeping || (g.grown && stage === 0)} onClick={() => startGame(g.id)}>{g.button}</button></article>)}</div><p className="room-game-note">玩一局赚摩尔豆和用品。{current.sleeping ? '拉姆在休息，先叫醒它吧。' : ''}</p></>}
      {panel === 'growth' && <><div className="classic-stage-grid">{STAGES.map((s,i) => <article key={s.name} className={stage === i ? 'current-stage' : ''}><div><Ram color={current.color} stage={i as 0|1|2|3|4} evolution={i === 4 ? current.evolution ?? evolutionChoice : undefined}/></div><h3>{s.name}</h3><span>{stage === i ? '现在的我' : stage > i ? '一起走过' : `约 ${GROWTH_STAGE_HOURS[i - 1]} 小时`}</span></article>)}</div><div className="slow-growth"><h3>慢慢长大，长久陪伴</h3><p>种子到初级约 1 天，再到中级约 3 天，高级再约 7 天；高级后再健康陪伴 7 天，可选择神力形态。</p><p>只累计状态良好时的真实陪伴；摸摸、喂食和游戏都不会让成长跳级。</p><progress max={100} value={progress}/><span>{nextStage ? `距${nextStage.name}的健康陪伴进度 ${Math.floor(progress)}%` : current.evolution ? '已经长成神力拉姆啦' : '可以选择神力形态啦'}</span></div></>}
      {panel === 'growth' && <section className="evolution-selection" aria-label="神力进化">
        <h3>{current.evolution ? EVOLUTIONS.find(form => form.id === current.evolution)?.name : '选择未来的神力形态'}</h3>
        <div className="evolution-grid">{EVOLUTIONS.map(form => <button key={form.id} type="button" aria-label={`选择${form.name}`} aria-pressed={(current.evolution ?? evolutionChoice) === form.id} disabled={Boolean(current.evolution)} onClick={() => setEvolutionChoice(form.id)}><Ram color={current.color} stage={4} evolution={form.id} action="still"/><b>{form.name}</b></button>)}</div>
        {!current.evolution && <button className="game-button" disabled={current.growth < GROWTH_MAX || current.sleeping} onClick={() => { if (petRef.current) apply(evolvePet(petRef.current, evolutionChoice), 'happy', `我选择成为${EVOLUTIONS.find(form => form.id === evolutionChoice)?.name}。`); }}>{current.growth < GROWTH_MAX ? '健康成长后开启' : current.sleeping ? '先叫醒拉姆' : '确认进化'}</button>}
        <p>神力形态选择后保留。身体颜色、名字和我们的回忆都会一直在。</p>
      </section>}
      {panel === 'chat' && chatContent}
      {panel === 'play' && <div className="panel-shortcuts"><button className="game-button" onClick={() => doCare('play')}>一起玩球</button><button className="game-button" onClick={() => setPanel('games')}>去游戏屋</button></div>}
      {panel === 'settings' && <><section className="room-preferences"><form className="room-rename" onSubmit={e => { e.preventDefault(); if (name.trim()) { setPet(p => p ? { ...p, name: name.trim().slice(0,12) } : p); notify('名字保存好啦。'); } }}><label htmlFor="rename">拉姆的名字</label><input id="rename" aria-label="拉姆的新名字" value={name} maxLength={12} onChange={e => setName(e.target.value)}/><button className="game-button small" disabled={!name.trim()}>保存</button></form>
        {([['安静陪伴',prefs.quiet,() => setPrefs(p => ({...p,quiet:!p.quiet})),false],['互动音效',prefs.sound,() => setPrefs(p => ({...p,sound:!p.sound})),false],['桌面散步',desktopState.wandering,() => void toggleWander(),!window.desktop],['角落躲藏',desktopState.edgeHiding,() => void window.desktop?.setEdgeHiding(!desktopState.edgeHiding),!window.desktop]] as const).map(([label,checked,callback,disabled]) => <label className="room-toggle-row" key={label}><span>{label}</span><button role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={callback}>{checked ? '开启' : '关闭'}</button></label>)}
        <div className="room-backup"><button className="game-button small" onClick={exportSave}>导出存档</button><button className="game-button small" onClick={() => importInput.current?.click()}>导入存档</button><input ref={importInput} hidden type="file" accept="application/json,.json" onChange={e => void importSave(e.target.files?.[0])}/><button className="plain-danger" onClick={() => setReset(true)}>送别拉姆</button></div></section>{extraSettings}</>}
    </GameDialog>}
    {reset && pet && <GameDialog title="和拉姆说再见？" onClose={() => setReset(false)}><div className="farewell-confirm"><div><Ram color={current.color} stage={stage} evolution={current.evolution}/></div><h3>送别 {current.name}</h3><p>这会删除它的成长、物品和本机回忆。重新打开后，可以领养一颗新的种子。</p><div className="confirm-buttons"><button className="game-button" onClick={exportSave}>先导出存档</button><button className="game-button" onClick={() => void abandonPet()}>确认送别</button></div></div></GameDialog>}
    {gameOverlay}{toast && <div className="classic-toast" role="status">{toast}</div>}
  </div>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, PointerEvent, ReactNode } from 'react';
import { COLORS, FOODS, STAGES, GROWTH_MAX, buyFood, care, createPet, getStage, parseSave, rewardGame, tick } from './game';
import type { Action, GameState, PetColor } from './game';
import Ram from './components/Ram';
import FruitGame from './components/FruitGame';
import MemoryGame from './components/MemoryGame';

const SAVE_KEY = 'ramu-house-save-v1';
const PREFS_KEY = 'ramu-house-preferences-v2';
type Panel = 'status' | 'food' | 'games' | 'growth' | 'chat' | 'settings' | null;
type Preferences = { sound: boolean; quiet: boolean };
type Result = { state: GameState; message: string; ok: boolean };
const titles = { status: '我的拉姆', food: '拉姆的食物口袋', games: '拉姆游乐场', growth: '拉姆成长手册', chat: '和拉姆说说话', settings: '陪伴设置' };
const stats = [{ id: 'hunger', name: '饱食', icon: 'icon-food' }, { id: 'happiness', name: '心情', icon: 'icon-happy' }, { id: 'cleanliness', name: '清洁', icon: 'icon-clean' }, { id: 'energy', name: '活力', icon: 'status-health' }] as const;
function readSave() { try { return parseSave(localStorage.getItem(SAVE_KEY), Date.now()); } catch { return null; } }
function readPrefs(): Preferences { try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); return { sound: p.sound === true, quiet: p.quiet !== false }; } catch { return { sound: false, quiet: true }; } }
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
  const [startGrowth, setStartGrowth] = useState(180);
  const [action, setAction] = useState('idle');
  const [petMode, setPetMode] = useState(false);
  const [preview, setPreview] = useState(false);
  const [desktopState, setDesktopState] = useState<DesktopState>({ petMode: false, alwaysOnTop: false, wandering: false });
  const [toast, setToast] = useState('');
  const [bubble, setBubble] = useState('拉姆～ 我来陪你啦！');
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [game, setGame] = useState<'fruit' | 'memory' | null>(null);
  const [reset, setReset] = useState(false);
  const [chat, setChat] = useState('');
  const [reply, setReply] = useState('拉姆～（摇摇叶子，蹭到你身边）');
  const [focusUntil, setFocusUntil] = useState<number | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const petRef = useRef(pet); petRef.current = pet;
  const timers = useRef<{ animation?: ReturnType<typeof setTimeout>; toast?: ReturnType<typeof setTimeout>; bubble?: ReturnType<typeof setTimeout> }>({});
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean } | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const adoptionFocus = useRef<HTMLInputElement>(null);
  const hasPet = pet !== null;
  const current = pet ?? createPet('小拉姆', color);
  const stage = getStage(current.growth);
  const nextStage = STAGES[stage + 1];
  const progress = nextStage ? (current.growth - STAGES[stage].threshold) / (nextStage.threshold - STAGES[stage].threshold) * 100 : 100;
  const floating = petMode || preview;
  const renderedAction = action !== 'idle' ? action : desktopState.motion === 'left' ? 'walk-left' : desktopState.motion === 'right' ? 'walk-right' : 'idle';
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
  useEffect(() => { if (hasPet && window.desktop) { void window.desktop.setPetMode(true).catch(() => notify('暂时无法进入桌宠模式，请再试一次。')); speak('拉姆～ 我来陪你啦！'); } }, [hasPet, notify, speak]);
  useEffect(() => { if (!hasPet) adoptionFocus.current?.focus(); }, [hasPet]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); void audio.current?.close(); }, []);
  useEffect(() => {
    if (!hasPet || prefs.quiet) return;
    const messages = ['拉姆～ 你忙你的，我就在这里。', '（悄悄探头）记得喝一口水呀。', '拉姆拉姆！今天也有好好陪着你。', '（轻轻摇摇叶子，继续等你）'];
    const timer = setInterval(() => { if (!petRef.current?.sleeping && !focusUntil) speak(messages[Math.floor(Math.random() * messages.length)]); }, 120000);
    return () => clearInterval(timer);
  }, [hasPet, prefs.quiet, focusUntil, speak]);
  useEffect(() => {
    if (!focusUntil) { setFocusSeconds(0); return; }
    const update = () => { const remaining = Math.max(0, Math.ceil((focusUntil - Date.now()) / 1000)); setFocusSeconds(remaining); if (remaining === 0) { setFocusUntil(null); speak('拉姆～ 专注完成啦！伸个懒腰，休息一下吧。', 12000); window.desktop?.notify('拉姆提醒你', '25 分钟专注结束，起来活动一下吧。'); } };
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [focusUntil, speak]);

  useEffect(() => { if (pet?.sleeping && desktopState.wandering) void window.desktop?.wander(false); }, [pet?.sleeping, desktopState.wandering]);

  function animate(next: string) { setAction(next); clearTimeout(timers.current.animation); timers.current.animation = setTimeout(() => setAction('idle'), 2900); }
  function chirp() { if (!prefs.sound) return; try { const ctx = audio.current ?? new AudioContext(); audio.current = ctx; void ctx.resume(); const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.setValueAtTime(660, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(940, ctx.currentTime + .13); gain.gain.setValueAtTime(.04, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .22); osc.start(); osc.stop(ctx.currentTime + .22); } catch { /* Optional sound. */ } }
  function apply(result: Result, nextAction?: string) { const before = petRef.current; setPet(result.state); notify(result.message); speak(result.message); if (result.ok) { chirp(); if (nextAction) animate(nextAction); if (before && getStage(before.growth) < getStage(result.state.growth)) speak(`${result.state.name}长大啦！现在是${STAGES[getStage(result.state.growth)].name}！`, 10000); } }
  function doCare(type: Action, food?: string) { if (petRef.current) apply(care(petRef.current, type, food, Date.now()), type); }
  function buy(id: string) { if (petRef.current) apply(buyFood(petRef.current, id)); }
  function adopt(e: FormEvent) { e.preventDefault(); if (!name.trim()) return; const adopted = createPet(name.trim().slice(0, 12), color); adopted.growth = startGrowth; setPet(adopted); speak('拉姆～ 好久不见，我们又在一起啦！', 10000); }
  async function toDesktop() { setPanel(null); setMenuOpen(false); if (window.desktop) { try { await window.desktop.setPetMode(true); } catch { notify('窗口切换失败，请稍后再试。'); } } else setPreview(true); }
  async function openPanel(next: Panel) { setMenuOpen(false); setPreview(false); setPanel(next); if (window.desktop && petMode) { try { await window.desktop.setPetMode(false); } catch { notify('照料面板暂时无法打开。'); } } }
  function focusToggle() { if (focusUntil) { setFocusUntil(null); speak('好呀，想休息的时候就休息。'); } else { setFocusUntil(Date.now() + 25 * 60000); speak('拉姆～ 我会安静陪你，25 分钟后提醒你休息。'); } }
  async function toggleWander() { if (!window.desktop) { speak('在 Windows 桌面应用里，我就可以在你的桌面走来走去啦。'); return; } try { await window.desktop.wander(!desktopState.wandering); } catch { notify('暂时无法切换走动状态。'); } }
  function startDrag(e: PointerEvent<HTMLButtonElement>) { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.screenX, y: e.screenY, lastX: e.screenX, lastY: e.screenY, moved: false }; void window.desktop?.startPetDrag(); }
  function moveDrag(e: PointerEvent<HTMLButtonElement>) { const previous = drag.current; if (!previous) return; const dx = e.screenX - previous.lastX, dy = e.screenY - previous.lastY; if (Math.abs(e.screenX - previous.x) + Math.abs(e.screenY - previous.y) > 5) previous.moved = true; if (previous.moved && window.desktop) { void window.desktop.movePet(dx, dy); previous.lastX = e.screenX; previous.lastY = e.screenY; } }
  function endDrag(e: PointerEvent<HTMLButtonElement>) { const moved = drag.current?.moved; drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); void window.desktop?.endPetDrag(); if (!moved) doCare('pet'); }
  function sendChat(e: FormEvent) {
    e.preventDefault(); const text = chat.trim(); if (!text) return;
    let answer = '拉姆拉姆～（认真听你说完，又轻轻蹭了蹭你）';
    if (/你好|早|嗨|hello|晚安/i.test(text)) answer = `拉姆～ ${current.name}在这里！今天也一起度过吧。`;
    else if (/饿|吃|饭|食/.test(text)) answer = current.stats.hunger < 50 ? '咕噜噜……肚子饿了，给我一点好吃的吧！' : '拉姆～ 肚子饱饱的，先陪你玩一会儿。';
    else if (/开心|喜欢|心情|爱/.test(text)) answer = '拉姆拉姆！（开心地蹦起来）和你在一起就很开心！';
    else if (/难过|烦|累|伤心|孤单/.test(text)) answer = '拉姆……（慢慢靠近，安静地陪着你）不用马上开心起来，我在呢。';
    else if (/工作|学习|专注/.test(text)) answer = '拉姆～ 你认真做事，我会乖乖陪着你。累了记得休息呀。';
    else if (/睡|困/.test(text)) answer = '呼姆……拉姆也想打个小盹啦。';
    else if (/长大|成长/.test(text)) answer = `我现在是${STAGES[stage].name}，照料和玩耍都会让我慢慢长大。`;
    setReply(answer); setChat(''); speak(answer); animate('pet'); chirp();
  }
  function exportSave() { if (!pet) return; const url = URL.createObjectURL(new Blob([JSON.stringify(pet, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `ramu-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('存档已经导出，记得收好。'); }
  async function importSave(file?: File) { if (!file) return; try { if (file.size > 100000) throw Error(); const restored = parseSave(await file.text(), Date.now()); if (!restored) throw Error(); setPet(restored); setName(restored.name); notify('存档已恢复，欢迎回来！'); } catch { notify('这个存档无法读取，原来的拉姆仍然保留。'); } if (importInput.current) importInput.current.value = ''; }

  const foodContent = <><p className="panel-intro">今天也要好好吃饭！小游戏获得的摩尔豆，可以用来补充口袋。</p><div className="food-list">{FOODS.map((food, i) => <article className="inventory-card" key={food.id}><span className="inventory-count">× {current.inventory[food.id] ?? 0}</span><ItemArt item={i}/><h3>{food.name}</h3><p>饱食 +{food.hunger}　心情 +{food.happiness}</p><button className="game-button small green" disabled={!current.inventory[food.id] || current.sleeping} onClick={() => doCare('feed', food.id)}>喂一份</button><button className="shop-button" onClick={() => buy(food.id)}>＋ {food.price} 摩尔豆购买</button></article>)}</div><p className="soft-note">{current.sleeping ? '拉姆正在睡觉，叫醒它再开饭吧。' : '小肚子饱了就不会继续吃，食物会留在口袋里。'}</p></>;
  const statusContent = <><div className="profile-heading"><div className="profile-mini"><Ram color={current.color} stage={stage}/></div><div><h3>{current.name}</h3><span>{STAGES[stage].name} · 相伴第 {days} 天</span></div><span className="bean-count">● {current.coins} 摩尔豆</span></div><div className="classic-stat-grid">{stats.map(s => <div className="classic-stat" key={s.id}><label><span><UiArt name={s.icon}/>{s.name}</span><b>{Math.round(current.stats[s.id])} / 100</b></label><div role="progressbar" aria-label={s.name} aria-valuenow={Math.round(current.stats[s.id])} aria-valuemin={0} aria-valuemax={100} className={`classic-progress stat-${s.id}`}><i style={{ width: `${current.stats[s.id]}%` }}/></div></div>)}</div><div className="classic-growth"><div><strong>成长进度</strong><span>{Math.floor(current.growth)} / {GROWTH_MAX}</span></div><div className="classic-progress"><i style={{ width: `${progress}%` }}/></div><p>{nextStage ? `再获得 ${Math.ceil(nextStage.threshold - current.growth)} 成长值，就能成为${nextStage.name}。` : '已经是高级拉姆啦！还会一直陪着你。'}</p></div><div className="panel-shortcuts"><button className="game-button green" onClick={() => setPanel('food')}>喂食</button><button className="game-button blue" onClick={() => doCare('wash')}>洗澡</button><button className="game-button" onClick={() => doCare('sleep')}>{current.sleeping ? '叫醒' : '睡一觉'}</button><button className="game-button" onClick={() => setPanel('growth')}>成长手册</button></div></>;

  const companion = <div className={`desktop-pet ${menuOpen ? 'menu-open' : ''}`} onContextMenu={e => { e.preventDefault(); setMenuOpen(!menuOpen); }}>
    <div className="pet-hover-header"><button onClick={() => void openPanel('status')} title="打开拉姆手册">{current.name} ▾</button><button aria-label="关闭拉姆" onClick={() => window.desktop ? window.desktop.close() : setPreview(false)}>×</button></div>
    <div className={`pet-speech ${bubbleVisible ? 'visible' : ''}`} role="status">{bubble}</div>
    {focusUntil && <button className="pet-focus" onClick={focusToggle} title="结束专注">⌛ 陪你专注 {String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:{String(focusSeconds % 60).padStart(2, '0')}</button>}
    <button className="desktop-character" aria-label="摸摸拉姆，按住可拖动" title="点一下摸摸，按住拖动，右键打开菜单" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { drag.current = null; void window.desktop?.endPetDrag(); }} onClick={e => { if (e.detail === 0) doCare('pet'); }}><Ram color={current.color} stage={stage} action={renderedAction} sleeping={current.sleeping}/></button>
    <div className="pet-toolbelt"><button onClick={() => void openPanel('food')} aria-label="喂食" title="喂食"><ItemArt item={0}/></button><button onClick={() => doCare('wash')} aria-label="洗澡" title="洗澡"><ItemArt item={3}/></button><button onClick={() => doCare('sleep')} aria-label={current.sleeping ? '叫醒' : '休息'} title={current.sleeping ? '叫醒' : '休息'}><ItemArt item={5}/></button><button className={focusUntil ? 'selected' : ''} onClick={focusToggle} aria-label={focusUntil ? '结束专注' : '陪我专注'} title="陪我专注25分钟"><UiArt name="icon-book"/></button><button onClick={() => setMenuOpen(!menuOpen)} aria-label="更多互动" title="更多互动"><UiArt name="toolbar-expressions-normal"/></button></div>
    {menuOpen && <div className="pet-context-menu"><strong>{current.name}的小菜单</strong><button onClick={() => void openPanel('chat')}>和拉姆说话</button><button onClick={() => void openPanel('games')}>一起玩游戏</button><button onClick={() => void toggleWander()}>{desktopState.wandering ? '✓ 停在这里陪我' : '让拉姆走一走'}</button><button onClick={() => { setPrefs(p => ({ ...p, quiet: !p.quiet })); setMenuOpen(false); }}>{prefs.quiet ? '偶尔和我打招呼' : '✓ 安静陪伴'}</button><button onClick={() => void openPanel('settings')}>设置与存档</button><button onClick={() => void openPanel(null)}>打开拉姆的家</button></div>}
    {saveError && <span className="pet-save-error">存档暂未保存，请打开设置导出。</span>}
  </div>;

  if (floating && pet) return <div className={petMode ? 'transparent-stage' : 'desktop-preview'}>{!petMode && <div className="preview-note"><strong>桌面陪伴预览</strong><span>Windows 应用会透明显示在你的真实桌面上</span><button className="game-button small" onClick={() => setPreview(false)}>返回拉姆的家</button></div>}{companion}{!petMode && <p className="preview-hint">点点它、拖动它，或者右键打开小菜单。平时，它会安静陪着你。</p>}</div>;

  return <div className="classic-app">
    <header className="classic-titlebar"><div>摩尔庄园 · 拉姆陪伴</div><div>{window.desktop && <><button onClick={() => window.desktop?.minimize()} aria-label="最小化">－</button><button onClick={() => window.desktop?.close()} aria-label="关闭窗口">×</button></>}</div></header>
    <main className="cottage-scene"><div className="scene-shade"/><div className="cottage-top"><div className="classic-logo"><span>拉姆</span><b>陪伴</b><small>熟悉的小家伙，又回到身边啦</small></div>{pet && <div className="scene-top-actions"><span className="coin-sign">● {current.coins} 摩尔豆</span><button className="game-button" onClick={() => void toDesktop()}>回到桌面陪我 ▸</button></div>}</div>
    {pet && <><button className="pet-plaque" onClick={() => setPanel('status')}><span>我的拉姆</span><strong>{current.name}</strong><small>{STAGES[stage].name} · 相伴第{days}天</small></button><div className="scene-pet"><div className={`scene-bubble ${bubbleVisible ? 'visible' : ''}`} role="status">{bubble}</div><button className="scene-character" aria-label="摸摸拉姆" onClick={() => doCare('pet')}><Ram color={current.color} stage={stage} action={renderedAction} sleeping={current.sleeping}/></button><span className="scene-pet-name">{current.name}<small>{current.sleeping ? '呼呼大睡中' : '点点我，陪我玩呀'}</small></span></div><aside className="companion-note"><span>★ 小拉姆来信</span><p>你忙你的，<br/>我在桌面上陪着你。</p><button onClick={() => void toDesktop()}>开启桌面陪伴 ›</button></aside><nav className="classic-dock" aria-label="拉姆互动"><button aria-label="我的拉姆" onClick={() => setPanel('status')}><span className="dock-portrait"><Ram color={current.color} stage={2} artStyle="classic"/></span><b>我的拉姆</b></button><button aria-label="食物口袋" onClick={() => setPanel('food')}><ItemArt item={0}/><b>喂食</b></button><button aria-label="洗澡" onClick={() => doCare('wash')}><ItemArt item={3}/><b>洗澡</b></button><button aria-label={current.sleeping ? '叫醒' : '休息'} onClick={() => doCare('sleep')}><ItemArt item={5}/><b>{current.sleeping ? '叫醒' : '休息'}</b></button><button aria-label="游乐时光" onClick={() => setPanel('games')}><ItemArt item={4}/><b>小游戏</b></button><button aria-label="和拉姆说话" onClick={() => setPanel('chat')}><UiArt name="toolbar-talk-normal" className="dock-ui-icon"/><b>说说话</b></button><button aria-label="陪伴设置" onClick={() => setPanel('settings')}><UiArt name="icon-save" className="dock-ui-icon"/><b>设置</b></button></nav></>}
    <footer className="classic-footer">{saveError ? '存档空间不足，请从设置导出存档。' : '拉姆陪伴 · 本地自动存档'}<span>《摩尔庄园》非官方同人桌宠</span></footer>
    </main>
    {!pet && <div className="adoption-screen"><section className="adoption-panel"><header className="adoption-header"><span>拉姆领养处</span><h1>好久不见，小拉姆！</h1><p>选一个熟悉的小家伙，继续陪你一起长大。</p></header><form onSubmit={adopt}><div className="adoption-colors">{COLORS.map(c => <button key={c.id} type="button" aria-label={`选择${c.name}拉姆`} aria-pressed={color === c.id} className={`adoption-choice ${color === c.id ? 'chosen' : ''}`} onClick={() => setColor(c.id)}><Ram color={c.id} stage={2} artStyle="classic"/><span style={{ '--swatch': c.hex } as CSSProperties}>{c.name}{color === c.id && <b>✓</b>}</span></button>)}</div><div className="adoption-name"><label htmlFor="pet-name">叫它什么呢？</label><input ref={adoptionFocus} id="pet-name" maxLength={12} value={name} onChange={e => setName(e.target.value)} placeholder="给拉姆起个名字" required/></div><fieldset className="growth-choice"><legend>你想怎样开始？</legend><label><input type="radio" name="start-growth" checked={startGrowth === 0} onChange={() => setStartGrowth(0)}/><span>从幼体开始养<small>从种子期慢慢长大</small></span></label><label><input type="radio" name="start-growth" checked={startGrowth === 180} onChange={() => setStartGrowth(180)}/><span>两叶拉姆陪着我<small>从熟悉的中级形态开始</small></span></label></fieldset><button type="submit" className="game-button adopt-cta" disabled={!name.trim()}>带拉姆回家！</button><p className="adoption-note">不用注册，它的每一点成长都会留在这台电脑里。</p></form></section></div>}
    {panel && pet && <GameDialog title={titles[panel]} wide={panel === 'growth' || panel === 'games'} onClose={() => setPanel(null)}>
      <nav className="paper-tabs">{(['status', 'food', 'games', 'growth', 'chat', 'settings'] as const).map(p => <button key={p} onClick={() => setPanel(p)} className={panel === p ? 'active' : ''}>{({ status: '状态', food: '口袋', games: '游戏', growth: '成长', chat: '对话', settings: '设置' })[p]}</button>)}</nav>
      {panel === 'status' && statusContent}
      {panel === 'food' && <><div className="pocket-balance">我的摩尔豆：<b>{current.coins}</b></div>{foodContent}</>}
      {panel === 'games' && <><p className="panel-intro">和拉姆玩一局，赚摩尔豆和食物奖励！</p><div className="mini-game-cards"><article><div className="game-card-art berry-game"><ItemArt item={0}/><ItemArt item={0}/><ItemArt item={4}/></div><h3>拉姆接果子</h3><p>移动拉姆接住可可果，20 秒一局。</p><button className="game-button green" disabled={current.sleeping} onClick={() => setGame('fruit')}>开始接果子</button></article><article><div className="game-card-art memory-game"><ItemArt item={1}/><ItemArt item={2}/><ItemArt item={1}/></div><h3>口袋翻翻乐</h3><p>找到相同的图案，45 秒记忆挑战。</p><button className="game-button blue" disabled={current.sleeping} onClick={() => setGame('memory')}>开始翻牌</button></article></div><p className="soft-note">已完成 {current.completedGames} 局 · 每局奖励摩尔豆、1 份食物和成长值</p>{current.sleeping && <p className="soft-note">拉姆在睡觉，叫醒它再一起玩吧。</p>}</>}
      {panel === 'growth' && <><p className="panel-intro">熟悉的原页游形态，一步一步陪它长大。</p><div className="classic-stage-grid">{STAGES.map((s, i) => <article key={s.name} className={stage === i ? 'current-stage' : ''}><div><Ram color={current.color} stage={i as 0 | 1 | 2 | 3}/></div><h3>{s.name}</h3><p>{i === 0 ? '从小小的幼体开始' : i === 1 ? '软乎乎的初级拉姆' : i === 2 ? '长出两片熟悉的嫩叶' : '展开扇叶，陪你去更远的地方'}</p><span>{stage === i ? '★ 当前阶段' : stage > i ? '已经长大啦' : `${s.threshold} 成长值`}</span></article>)}</div><p className="soft-note">当前成长：{Math.floor(current.growth)} / {GROWTH_MAX}。喂食、照料、玩游戏和健康陪伴都能获得成长值。</p><p className="small-print">保留原版成长形态，成长速度按桌面玩法调整。超级拉姆不属于普通成长阶段。</p></>}
      {panel === 'chat' && <><div className="dialogue-portrait"><Ram color={current.color} stage={stage} action="pet"/></div><div className="classic-dialogue" role="status"><strong>{current.name}</strong><p>{reply}</p><small>拉姆叫声 · 心情翻译</small></div><form className="classic-chat-form" onSubmit={sendChat}><input value={chat} onChange={e => setChat(e.target.value)} aria-label="和拉姆说话" placeholder="和它说：今天开心吗？" maxLength={100}/><button type="submit" className="game-button small green" aria-label="发送消息" disabled={!chat.trim()}>发送</button></form><p className="small-print">本地基础对话，不需要联网。</p></>}
      {panel === 'settings' && <><div className="classic-setting"><label htmlFor="rename">拉姆的名字</label><form onSubmit={e => { e.preventDefault(); if (pet && name.trim()) { setPet({ ...pet, name: name.trim().slice(0, 12) }); notify('名字保存好啦。'); } }}><input id="rename" aria-label="拉姆的新名字" value={name} maxLength={12} onChange={e => setName(e.target.value)}/><button className="game-button small" disabled={!name.trim()}>保存</button></form></div><div className="classic-setting original-art-note"><UiArt name="sprout"/><div><strong>拉姆与晨光小屋</strong><small>原版拉姆与道具 · 按原画风生成的新背景</small></div></div><div className="classic-setting"><div><strong>安静陪伴</strong><small>不开口打扰，点击互动时才回应</small></div><button className={`classic-toggle ${prefs.quiet ? 'on' : ''}`} role="switch" aria-label="安静陪伴" aria-checked={prefs.quiet} onClick={() => setPrefs(p => ({ ...p, quiet: !p.quiet }))}><i/></button></div><div className="classic-setting"><div><strong>互动音效</strong><small>摸摸或照料时轻轻回应</small></div><button className={`classic-toggle ${prefs.sound ? 'on' : ''}`} role="switch" aria-label="互动音效" aria-checked={prefs.sound} onClick={() => setPrefs(p => ({ ...p, sound: !p.sound }))}><i/></button></div><div className="classic-setting"><div><strong>桌面散步</strong><small>{window.desktop ? '偶尔走一小段，不抢走你的焦点' : 'Windows 桌面应用中可用'}</small></div><button className={`classic-toggle ${desktopState.wandering ? 'on' : ''}`} role="switch" aria-label="桌面散步" aria-checked={desktopState.wandering} disabled={!window.desktop} onClick={() => void toggleWander()}><i/></button></div><div className="classic-setting"><div><strong>陪我专注</strong><small>25 分钟后提醒休息，过程中保持安静</small></div><button className="game-button small" onClick={focusToggle}>{focusUntil ? '结束专注' : '开始25分钟'}</button></div><div className="classic-setting"><div><strong>保存我们的回忆</strong><small>存档仅保存在本机，可以备份或迁移</small></div><div className="setting-buttons"><button className="game-button small" onClick={exportSave}>导出</button><button className="game-button small" onClick={() => importInput.current?.click()}>导入</button><input ref={importInput} hidden type="file" accept="application/json,.json" onChange={e => void importSave(e.target.files?.[0])}/></div></div><div className="classic-setting"><span>重新领养（会替换当前进度）</span><button className="plain-danger" onClick={() => setReset(true)}>重新领养</button></div><p className="small-print">拉姆陪伴 v0.4.0-dev.1 · 《摩尔庄园》非官方个人同人桌宠</p></>}
      <div className="panel-desktop-return"><button className="game-button" onClick={() => void toDesktop()}>让拉姆回到桌面陪我 ▸</button></div>
    </GameDialog>}
    {reset && <GameDialog title="重新领养一只拉姆？" onClose={() => setReset(false)}><p className="panel-intro">这会替换 {current.name} 的成长、食物和摩尔豆。可以先导出存档，把这段回忆收好。</p><div className="confirm-buttons"><button className="game-button" onClick={exportSave}>先导出存档</button><button className="game-button green" onClick={() => { try { localStorage.removeItem(SAVE_KEY); } catch { /* New save will report storage errors. */ } setPet(null); setReset(false); setPanel(null); setName('小拉姆'); }}>确认重新领养</button></div></GameDialog>}
    {game === 'fruit' && <FruitGame color={current.color} stage={stage} onClose={() => setGame(null)} onComplete={score => { if (petRef.current) apply(rewardGame(petRef.current, score, Date.now()), 'play'); }}/>}
    {game === 'memory' && <MemoryGame onClose={() => setGame(null)} onComplete={score => { if (petRef.current) apply(rewardGame(petRef.current, score, Date.now()), 'play'); }}/>}
    {toast && <div className="classic-toast" role="status">{toast}</div>}
  </div>;
}

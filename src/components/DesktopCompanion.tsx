import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { GROWTH_MAX, STAGES, getPetCondition } from '../game';
import type { Action, GameState, Stage, ItemCategory } from '../game';
import { playPetVoice } from '../pet-audio';
import Ram from './Ram';
import CarePocket from './CarePocket';

export type CompanionPanel = 'status' | 'food' | 'games' | 'growth' | 'chat' | 'settings';
interface Props {
  pet: GameState; stage: Stage; action: string; actionId: number;
  bubble: string; bubbleVisible: boolean; panel: CompanionPanel | null;
  native: boolean; desktopState: DesktopState; quiet: boolean; sound: boolean;
  focusSeconds: number; focusing: boolean; saveError: boolean;
  onPanel: (panel: CompanionPanel | null) => void; onCare: (action: Action, food?: string) => void;
  onBuy: (id: string) => void; onRename: (name: string) => void;
  onGame: (game: 'fruit' | 'memory') => void; onHome: () => void; onFocus: () => void;
  onWander: () => void; onQuiet: () => void; onSound: () => void;
  onExport: () => void; onImport: (file?: File) => void; onSay: (text: string) => void;
  onPet: () => void;
  pocketCategory: ItemCategory; pocketVisit: number; chatContent: ReactNode; settingsContent: ReactNode;
}
const images = { food: 'items/180001', wash: 'items/180003', sleep: 'ui/icon-clock', chat: 'ui/toolbar-talk-normal', games: 'items/180004', status: 'ui/status-health' };
function Icon({ path }: { path: string }) { return <img alt="" draggable={false} src={`./assets/original/${path}.png`}/>; }
const panelLabels: Record<CompanionPanel, string> = { status: '状态', food: '口袋', games: '小游戏', growth: '成长', chat: '说话', settings: '设置' };

export default function DesktopCompanion(p: Props) {
  const [tools, setTools] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [name, setName] = useState(p.pet.name);
  const root = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean; direction: number; turns: number; turnAt: number; offset: { x: number; y: number } } | null>(null);
  useEffect(() => setName(p.pet.name), [p.pet.name]);
  useEffect(() => {
    if (!p.native) return;
    const hit = (e: MouseEvent) => {
      if (drag.current?.moved) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      window.desktop?.setMousePassthrough(!target?.closest('button,input,select,[role="dialog"],[role="application"],a'));
    };
    document.addEventListener('mousemove', hit);
    return () => { document.removeEventListener('mousemove', hit); window.desktop?.setMousePassthrough(false); };
  }, [p.native]);
  useEffect(() => () => clearTimeout(shakeTimer.current), []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.fruit-dialog,.memory-dialog')) { p.onPanel(null); setTools(false); }
    };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [p.onPanel]);
  const toggleTools = () => { const show = !tools; setTools(show); if (!show) p.onPanel(null); p.onPet(); };
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (p.stage > 0 && !p.pet.sleeping) void window.desktop?.startPetDrag();
    if (p.panel) p.onPanel(null);
    const x = p.native ? e.screenX : e.clientX, y = p.native ? e.screenY : e.clientY;
    drag.current = { x, y, lastX: x, lastY: y, moved: false, direction: 0, turns: 0, turnAt: performance.now(), offset };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current; if (!d) return;
    const x = p.native ? e.screenX : e.clientX, y = p.native ? e.screenY : e.clientY;
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < 5) return;
    if (!d.moved) {
      d.moved = true; setDragging(true); setTools(false); p.onPanel(null);
      playPetVoice('lift', p.sound);
    }
    const dx = x - d.lastX, dy = y - d.lastY;
    setTilt(Math.max(-12, Math.min(12, dx * 1.25)));
    if (Math.abs(dx) > 3) {
      const direction = Math.sign(dx), now = performance.now();
      if (now - d.turnAt > 850) d.turns = 0;
      if (d.direction && direction !== d.direction) { d.turns++; d.turnAt = now; }
      d.direction = direction;
      if (d.turns >= 3) {
        d.turns = 0; setShaking(true); clearTimeout(shakeTimer.current); shakeTimer.current = setTimeout(() => setShaking(false), 700);
        playPetVoice('shake', p.sound); p.onSay(p.stage === 0 ? '唔～ 花盆留在这里，轻轻摇就好。' : '呜～ 轻轻摇就好啦！');
      }
    }
    if (p.stage > 0 && !p.pet.sleeping) {
      if (p.native) void window.desktop?.movePet(dx, dy);
      else {
        const box = root.current?.getBoundingClientRect();
        const originX = (box?.left ?? 0) - offset.x, originY = (box?.top ?? 0) - offset.y;
        setOffset({ x: Math.max(-originX, Math.min(innerWidth - 200 - originX, d.offset.x + x - d.x)), y: Math.max(-originY, Math.min(innerHeight - 240 - originY, d.offset.y + y - d.y)) });
      }
    }
    d.lastX = x; d.lastY = y;
  }
  function up(e: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const d = drag.current; drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false); setTilt(0); void window.desktop?.endPetDrag();
    if (d?.moved) { playPetVoice('drop', p.sound); if (p.stage === 0) p.onSay('花盆稳稳的，我在里面摇摇身子。'); }
    else if (!cancelled) toggleTools();
  }
  const show = (panel: CompanionPanel) => { setTools(true); p.onPanel(panel); };
  const hasPanel = p.panel !== null;
  const side = p.native ? p.desktopState.panelSide : 'right';
  const stageName = STAGES[p.stage].name;
  const condition = getPetCondition(p.pet);
  const remaining = `${Math.floor(p.focusSeconds / 60).toString().padStart(2, '0')}:${(p.focusSeconds % 60).toString().padStart(2, '0')}`;
  return <div ref={root} className={`companion-layout ${hasPanel ? 'panel-open' : ''} panel-${side} ${p.native ? 'is-native' : 'is-preview'}`} style={!p.native ? { transform: `translate(${offset.x}px,${offset.y}px)` } : undefined}>
    <div className={`desktop-pet compact-pet ${tools ? 'actions-open' : ''}`} onContextMenu={e => { e.preventDefault(); setTools(true); p.onPanel('status'); }}>
      <div className={`compact-bubble ${p.bubbleVisible ? 'visible' : ''}`} role="status">{p.bubble}</div>
      <button className={`compact-pet-name ${p.pet.sleeping ? 'sleeping-badge' : ''}`} aria-label={p.pet.sleeping ? '叫醒拉姆' : '查看拉姆状态'} onClick={() => p.pet.sleeping ? p.onCare('sleep') : show('status')} title={p.pet.sleeping ? '正在睡觉，点击轻轻叫醒' : condition.description}>{p.pet.sleeping ? '睡着了 · 叫醒' : p.pet.name}</button>
      <button className="desktop-character" data-testid="desktop-character" aria-label="点击拉姆展开互动，按住拖动" title={p.stage === 0 ? '点击互动，拖动可轻摇身体；花盆保持原位' : '点击互动，按住拖动'}
        onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e)} onPointerCancel={e => up(e, true)} onClick={e => { if (e.detail === 0) toggleTools(); }}>
        <Ram color={p.pet.color} stage={p.stage} action={p.action} actionId={p.actionId} sleeping={p.pet.sleeping} dragging={dragging} dragTilt={tilt} shaking={shaking}/>
      </button>
      {tools && <nav className="pet-actions" data-testid="pet-actions" aria-label="拉姆快捷操作">
        <button aria-label="查看状态" title="状态" onClick={() => show('status')}><Icon path={images.status}/></button>
        <button aria-label="喂食" title="喂食" onClick={() => show('food')}><Icon path={images.food}/></button>
        <button aria-label="洗澡" title="洗澡" onClick={() => p.onCare('wash')}><Icon path={images.wash}/></button>
        <button aria-label={p.pet.sleeping ? '叫醒' : '休息'} title={p.pet.sleeping ? '叫醒' : '休息'} onClick={() => p.onCare('sleep')}><Icon path={images.sleep}/></button>
        <button aria-label="和拉姆说话" title="说话" onClick={() => show('chat')}><Icon path={images.chat}/></button>
        <button aria-label="更多互动" title="小游戏与设置" onClick={() => show('games')}><Icon path={images.games}/></button>
      </nav>}
      {p.focusing && <button className="compact-focus" onClick={p.onFocus} aria-label="结束专注">陪你专注 {remaining}</button>}
      {p.saveError && <span className="compact-save-error">存档未保存，请导出备份</span>}
    </div>
    {hasPanel && <section className="companion-panel" role="dialog" aria-label={`拉姆${panelLabels[p.panel!]}`} data-testid="companion-panel">
      <header><strong>{p.pet.name}<span> · {stageName}</span></strong><button aria-label="关闭小窗" onClick={() => p.onPanel(null)}>×</button></header>
      <nav className="companion-tabs" aria-label="照料内容">{(Object.keys(panelLabels) as CompanionPanel[]).map(tab => <button key={tab} role="tab" aria-selected={p.panel === tab} onClick={() => show(tab)}>{panelLabels[tab]}</button>)}</nav>
      <div className="companion-content">
        {p.panel === 'status' && <><div className="compact-profile"><div><Ram color={p.pet.color} stage={p.stage} action={condition.action} sleeping={p.pet.sleeping}/></div><p><b>{p.pet.name}</b><span>{stageName} · {condition.label}</span></p><small>{p.pet.coins} 摩尔豆</small></div>
          <div className="compact-stats">{([['hunger', '饱食'], ['thirst', '水分'], ['cleanliness', '清洁'], ['happiness', '心情'], ['health', '健康'], ['energy', '精力']] as const).map(([id, text]) => <label key={id}><span>{text}</span><progress max={100} value={p.pet.stats[id]}/><b>{Math.round(p.pet.stats[id])}</b></label>)}</div>
          <p className="compact-condition" role="status">{condition.description}</p><p className="companion-note">{p.stage === 0 ? '种子期的花盆保持原位，身体会轻轻摆动。' : '点击下面的小图标照料我，也可以按住把我放到别处。'}</p></>}
        {p.panel === 'food' && <CarePocket key={`${p.pocketCategory}:${p.pocketVisit}`} pet={p.pet} initialCategory={p.pocketCategory} onCare={p.onCare} onBuy={p.onBuy}/>}
        {p.panel === 'games' && <><article className="compact-game"><Icon path="items/180027"/><div><b>拉姆接果子</b><small>{p.stage === 0 ? '长大离开花盆后才能参加' : '20 秒 · 碰到果子才算接住'}</small></div><button className="compact-button" disabled={p.pet.sleeping || p.stage === 0} onClick={() => p.onGame('fruit')}>开始</button></article><article className="compact-game"><Icon path="items/180004"/><div><b>口袋翻翻乐</b><small>45 秒 · 找到 6 对图案</small></div><button className="compact-button" disabled={p.pet.sleeping} onClick={() => p.onGame('memory')}>开始翻牌</button></article><p className="companion-note">完成一局可获得摩尔豆、成长和 1 份食物。已完成 {p.pet.completedGames} 局。</p><button className="compact-text-button" onClick={p.onFocus}>{p.focusing ? '结束专注' : '陪我专注 25 分钟'}</button></>}
        {p.panel === 'growth' && <><p className="companion-balance">成长 {Math.floor(p.pet.growth)} / {GROWTH_MAX}</p><div className="compact-stages">{STAGES.map((s, i) => <div key={s.name} className={p.stage === i ? 'current' : ''}><Ram color={p.pet.color} stage={i as Stage} action="still"/><b>{s.name}</b><small>{s.threshold} 成长</small></div>)}</div><p className="companion-note">种子待在盆里，初级无叶，中级两叶，高级展开扇叶。照料、游戏和健康陪伴都会积累成长。</p></>}
        {p.panel === 'chat' && p.chatContent}
        {p.panel === 'settings' && <>{p.settingsContent}<form className="compact-rename" onSubmit={e => { e.preventDefault(); if (name.trim()) p.onRename(name.trim()); }}><label htmlFor="compact-rename">名字</label><input id="compact-rename" aria-label="拉姆的新名字" maxLength={12} value={name} onChange={e => setName(e.target.value)}/><button className="compact-button">保存</button></form>
          {([['安静陪伴', p.quiet, p.onQuiet], ['互动叫声', p.sound, p.onSound], ['桌面散步', p.desktopState.wandering, p.onWander]] as const).map(([label, checked, callback]) => <label className="compact-setting" key={label}><span>{label}</span><button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={label === '桌面散步' && (!p.native || p.stage === 0)} onClick={callback}>{checked ? '开启' : '关闭'}</button></label>)}
          <p className="companion-note">拖拽与摇晃会轻声回应；可关闭叫声。种子期不散步。叫声使用系统语音或本地合成拟声。</p><div className="compact-backups"><button onClick={p.onExport}>导出存档</button><button onClick={() => file.current?.click()}>导入存档</button><input ref={file} hidden type="file" accept=".json,application/json" onChange={e => p.onImport(e.target.files?.[0])}/></div></>}
      </div>
      <footer><button className="compact-home" onClick={p.onHome}><Icon path="ui/toolbar-home-normal"/>进入小屋</button><button aria-label={p.native ? "关闭拉姆" : "收起照料小窗"} onClick={() => p.native ? window.desktop?.close() : p.onPanel(null)}>{p.native ? "退出" : "收起"}</button></footer>
    </section>}
  </div>;
}

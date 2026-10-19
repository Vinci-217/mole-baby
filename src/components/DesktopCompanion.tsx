import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { STAGES, getPetCondition } from '../game';
import type { Action, GameState, Stage, ItemCategory } from '../game';
import { playPetVoice } from '../pet-audio';
import Ram from './Ram';
import { reminderTime } from '../use-rest-reminder';
import CarePocket from './CarePocket';

export type CompanionPanel = 'status' | 'food' | 'play' | 'chat';
interface Props {
  pet: GameState; stage: Stage; action: string; actionId: number; itemId?: string;
  bubble: string; bubbleVisible: boolean; panel: CompanionPanel | null;
  native: boolean; desktopState: DesktopState; sound: boolean;
  focusSeconds: number; focusing: boolean; saveError: boolean;
  reminderSeconds: number; reminders: boolean; reminderPaused: boolean;
  onPanel: (panel: CompanionPanel | null) => void;
  onCare: (action: Action, item?: string) => void;
  onHome: () => void; onShop: () => void; onFocus: () => void;
  onSay: (text: string) => void; onPet: () => void;
  pocketCategory: ItemCategory; pocketVisit: number; chatContent: ReactNode;
}
const icons = { food: 'items/180001', wash: 'items/180003', sleep: 'ui/status-sleep', chat: 'ui/toolbar-talk-normal', play: 'items/180004', status: 'ui/status-health', home: 'ui/toolbar-home-normal' };
function Icon({ path }: { path: string }) { return <img alt="" draggable={false} src={`./assets/original/${path}.png`}/>; }
const labels: Record<CompanionPanel, string> = { status: '状态', food: '背包', play: '玩耍', chat: '对话' };
export default function DesktopCompanion(p: Props) {
  const [tools, setTools] = useState(false), [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState(0), [shaking, setShaking] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const root = useRef<HTMLDivElement>(null), revealClick = useRef(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean; direction: number; turns: number; turnAt: number; offset: { x: number; y: number } } | null>(null);
  useEffect(() => {
    if (!p.native) return;
    const hit = (e: MouseEvent) => {
      if (drag.current?.moved) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      window.desktop?.setMousePassthrough(!target?.closest('button,input,textarea,select,summary,[role="dialog"],a'));
    };
    document.addEventListener('mousemove', hit);
    return () => { document.removeEventListener('mousemove', hit); window.desktop?.setMousePassthrough(false); };
  }, [p.native]);
  useEffect(() => { void window.desktop?.setInteracting(tools || dragging || p.panel !== null); }, [tools, dragging, p.panel]);
  useEffect(() => () => { void window.desktop?.setInteracting(false); }, []);
  useEffect(() => () => clearTimeout(shakeTimer.current), []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { p.onPanel(null); setTools(false); } };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [p.onPanel]);
  const toggleTools = () => { void window.desktop?.revealPet(); const show = !tools; setTools(show); if (!show) p.onPanel(null); p.onPet(); };
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    revealClick.current = false; e.currentTarget.setPointerCapture(e.pointerId);
    if (p.native && p.desktopState.edgePose !== 'visible') { revealClick.current = true; void window.desktop?.revealPet().then(() => setTools(true)); return; }
    void window.desktop?.startPetDrag();
    if (p.panel) p.onPanel(null);
    const x = p.native ? e.screenX : e.clientX, y = p.native ? e.screenY : e.clientY;
    drag.current = { x, y, lastX: x, lastY: y, moved: false, direction: 0, turns: 0, turnAt: performance.now(), offset };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current; if (!d) return;
    const x = p.native ? e.screenX : e.clientX, y = p.native ? e.screenY : e.clientY;
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < 5) return;
    if (!d.moved) { d.moved = true; setDragging(true); setTools(false); p.onPanel(null); playPetVoice('lift', p.sound); }
    const dx = x - d.lastX, dy = y - d.lastY;
    setTilt(Math.max(-12, Math.min(12, dx * 1.25)));
    if (Math.abs(dx) > 3) {
      const direction = Math.sign(dx), now = performance.now();
      if (now - d.turnAt > 850) d.turns = 0;
      if (d.direction && direction !== d.direction) { d.turns++; d.turnAt = now; }
      d.direction = direction;
      if (d.turns >= 3) { d.turns = 0; setShaking(true); clearTimeout(shakeTimer.current); shakeTimer.current = setTimeout(() => setShaking(false), 700); playPetVoice('shake', p.sound); p.onSay('唔～轻轻摇就好啦。'); }
    }
    {
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
    if (revealClick.current) { revealClick.current = false; drag.current = null; setDragging(false); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); void window.desktop?.endPetDrag(); return; }
    const d = drag.current; drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false); setTilt(0); void window.desktop?.endPetDrag();
    if (d?.moved) { playPetVoice('drop', p.sound); if (p.stage === 0) p.onSay('把我的小花盆放在这里，陪着你。'); }
    else if (!cancelled) toggleTools();
  }
  const show = (panel: CompanionPanel) => { setTools(true); p.onPanel(panel); };
  const side = p.native ? p.desktopState.panelSide : 'right';
  const condition = getPetCondition(p.pet);
  const remaining = `${Math.floor(p.focusSeconds / 60).toString().padStart(2, '0')}:${(p.focusSeconds % 60).toString().padStart(2, '0')}`;
  const edge = p.native ? p.desktopState.edgePose : 'visible';
  return <div ref={root} className={`companion-layout ${p.panel ? 'panel-open' : ''} panel-${side} ${p.native ? 'is-native' : 'is-preview'} edge-${edge} edge-${p.desktopState.edgeSide ?? 'none'}`} style={!p.native ? { transform: `translate(${offset.x}px,${offset.y}px)` } : undefined}>
    <div className={`desktop-pet compact-pet ${tools ? 'actions-open' : ''}`} onContextMenu={e => { e.preventDefault(); void window.desktop?.revealPet(); setTools(true); p.onPanel('status'); }}>
      <div className={`compact-bubble ${p.bubbleVisible ? 'visible' : ''}`} role="status">{p.bubble}</div>
      <button className={`compact-pet-name ${p.pet.sleeping ? 'sleeping-badge' : ''}`} aria-label={p.pet.sleeping ? '叫醒拉姆' : '查看拉姆状态'} onClick={() => p.pet.sleeping ? p.onCare('sleep') : show('status')}>{p.pet.sleeping ? '睡着了 · 叫醒' : p.pet.name}</button>
      <button className="desktop-character" data-testid="desktop-character" aria-label="点击拉姆展开互动，按住拖动" title={edge !== 'visible' ? '点一下，让我出来' : '点击互动，按住拖动'} onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e)} onPointerCancel={e => up(e, true)} onClick={e => { if (e.detail === 0) toggleTools(); }}>
        <Ram color={p.pet.color} stage={p.stage} evolution={p.pet.evolution} action={p.action} actionId={p.actionId} itemId={p.itemId} sleeping={p.pet.sleeping} dragging={dragging} dragTilt={tilt} shaking={shaking}/>
      </button>
      {tools && <nav className="pet-actions" data-testid="pet-actions" aria-label="拉姆快捷操作">
        <button aria-label="查看状态" title="状态" onClick={() => show('status')}><Icon path={icons.status}/></button>
        <button aria-label="喂食" title="吃" onClick={() => show('food')}><Icon path={icons.food}/></button>
        <button aria-label="洗澡" title="洗澡" onClick={() => p.onCare('wash')}><Icon path={icons.wash}/></button>
        <button aria-label="玩耍" title="玩耍" onClick={() => show('play')}><Icon path={icons.play}/></button>
        <button aria-label={p.pet.sleeping ? '叫醒' : '休息'} title={p.pet.sleeping ? '叫醒' : '休息'} onClick={() => p.onCare('sleep')}><Icon path={icons.sleep}/></button>
        <button aria-label="和拉姆说话" title="对话" onClick={() => show('chat')}><Icon path={icons.chat}/></button>
        <button aria-label="进入小屋" title="小屋" onClick={p.onHome}><Icon path={icons.home}/></button>
      </nav>}
      {p.reminders && <span className="compact-reminder" role="timer" aria-label="休息提醒倒计时" data-paused={p.reminderPaused}>{p.reminderPaused ? '已暂停' : '休息'} {reminderTime(p.reminderSeconds)}</span>}
      {p.focusing && <button className="compact-focus" onClick={p.onFocus} aria-label="结束专注">{remaining}</button>}
      {p.saveError && <span className="compact-save-error">存档未保存，请到小屋备份</span>}
    </div>
    {p.panel && <section className="companion-panel" role="dialog" aria-label={`拉姆${labels[p.panel]}`} data-testid="companion-panel">
      <header><strong>{p.pet.name}<span> · {STAGES[p.stage].name}</span></strong><button aria-label="关闭小窗" onClick={() => p.onPanel(null)}>×</button></header>
      <nav className="companion-tabs" aria-label="日常照料">{(Object.keys(labels) as CompanionPanel[]).map(tab => <button key={tab} role="tab" aria-selected={p.panel === tab} onClick={() => show(tab)}>{labels[tab]}</button>)}</nav>
      <div className="companion-content">
        {p.panel === 'status' && <><div className="compact-profile"><div><Ram color={p.pet.color} stage={p.stage} evolution={p.pet.evolution} action={condition.action} sleeping={p.pet.sleeping}/></div><p><b>{p.pet.name}</b><span>{condition.label}</span></p><small>{p.pet.coins} 豆</small></div><div className="compact-stats">{([['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],['happiness','心情'],['health','健康'],['energy','精力']] as const).map(([id, text]) => <label key={id}><span>{text}</span><progress max={100} value={p.pet.stats[id]}/><b>{Math.round(p.pet.stats[id])}</b></label>)}</div><p className="compact-condition" role="status">{condition.description}</p>{p.pet.sleeping && <button className="compact-button" onClick={() => p.onCare('sleep')}>轻轻叫醒</button>}</>}
        {p.panel === 'food' && <CarePocket key={`${p.pocketCategory}:${p.pocketVisit}`} pet={p.pet} initialCategory={p.pocketCategory} onCare={p.onCare} onVisitShop={p.onShop}/>}
        {p.panel === 'play' && <div className="desktop-play"><h3>陪我玩一会儿</h3><button disabled={p.pet.sleeping} onClick={() => p.onCare('play')}><Icon path="items/180004"/>一起玩球</button><button disabled={p.pet.sleeping} onClick={p.onPet}><Icon path="ui/icon-happy"/>摸摸拉姆</button><button onClick={p.onFocus}><Icon path="ui/icon-clock"/>{p.focusing ? '结束专注' : '陪我专注'}</button><button className="desktop-play-home" onClick={p.onHome}>去小屋玩小游戏 ›</button></div>}
        {p.panel === 'chat' && p.chatContent}
      </div><footer><button className="compact-home" onClick={p.onHome}><Icon path={icons.home}/>进入小屋</button><button onClick={() => p.native ? window.desktop?.hideToTray() : p.onPanel(null)}>{p.native ? '收进托盘' : '收起'}</button></footer>
    </section>}
  </div>;
}

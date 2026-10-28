import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import type { Action, GameState, Stage, PetColor } from '../game';
import { playPetVoice } from '../pet-audio';
import Ram from './Ram';
import {useElasticDrag} from '../use-elastic-drag';
import {isMoodAction} from '../mood-motion';
import {isPastime} from '../pet-pastimes';
import {isSchoolAction,learned,type CourseId} from '../pet-school';
import ActivityCountdown from './ActivityCountdown';
import {ELEMENT_TYPES,elementSkillsForCourse,learnedElementSkill} from '../element-skills';
import {pointerGaze,type PetGaze} from '../pet-attention';
import { reminderTime } from '../use-rest-reminder';
import CareFeedback from './CareFeedback';
import type {CareFeedbackData} from '../care-feedback';
import { edgeEntryAction, edgeTargetOffset, paintedEdgeOffset, type EdgeVector } from '../edge-motion';
import type {PocketCategory} from './CarePocket';

export type CompanionPanel = 'food' | 'play';
interface Props {
  moodLabel:string;moodBusy:boolean;onMood:()=>void; pocketContent:ReactNode;
  courseCompletion:string;onElementSkill:(id:string)=>void;
  pet: GameState; stage: Stage; action: string; actionId: number; itemId?: string; fromColor?: PetColor;
  bubble: string; bubbleVisible: boolean; careFeedback:CareFeedbackData|null; panel: CompanionPanel | null;
  native: boolean; desktopState: DesktopState; sound: boolean;
  saveError: boolean;
  timerDirection:'countdown'|'countup'; reminderSeconds: number; reminders: boolean; timerRunning: boolean;
  onPanel: (panel: CompanionPanel | null) => void;
  onCare: (action: Action, item?: string) => void;
  onWork:()=>void;onSchool:()=>void;onMagic:()=>void;magicLearned:boolean;onHome: () => void; onShop: () => void; onFocus: () => void;
  onSay: (text: string) => void; onShake: () => void; onBubble: () => void; onPresence: () => void; onCurious: () => void; onPet: () => void;
  onActionEnd?:()=>void; onTug?:()=>void;
  onRecall:()=>void;
  pocketCategory: PocketCategory; pocketVisit: number; playInvitation?:ReactNode;
}
const icons = { food: 'items/180001', wash: 'items/180003', timer: 'ui/icon-clock', chat: 'ui/toolbar-talk-normal', play: 'items/180004', status: 'ui/status-health', home: 'ui/toolbar-home-normal' };
function Icon({ path }: { path: string }) { return <img alt="" draggable={false} src={`./assets/original/${path}.png`}/>; }
const labels: Record<CompanionPanel, string> = {food:'背包',play:'一起玩耍'};
export default function DesktopCompanion(p: Props) {
  const [tools, setTools] = useState(false), [dragging, setDragging] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [heldEdgeOffset, setHeldEdgeOffset] = useState<EdgeVector>({ x: 0, y: 0 });
  const root = useRef<HTMLDivElement>(null);
  const gaze=useRef<PetGaze>({x:0,y:0});
  const look=(x:number,y:number)=>{const box=root.current?.querySelector('.desktop-character')?.getBoundingClientRect();gaze.current=box&&!dockedRef.current&&!drag.current?.moved?pointerGaze(x,y,box):{x:0,y:0};};
  const through=useRef(p.desktopState.mouseThrough);through.current=p.desktopState.mouseThrough;
  const docked=p.native&&p.desktopState.edgeSide!==null;
  const dockedRef=useRef(docked);dockedRef.current=docked;
  const edgeHover=useRef(false);
  const peek=(hovered:boolean)=>{
    if(!dockedRef.current){edgeHover.current=false;return;}
    if(edgeHover.current===hovered)return;edgeHover.current=hovered;
    void window.desktop?.setEdgeHovered(hovered);
  };
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revealTools = () => { clearTimeout(hideTimer.current); hideTimer.current=undefined;if(dockedRef.current){setTools(false);peek(true);return;} if(!drag.current?.moved) setTools(true); };
  const hideTools = () => {
    if(dockedRef.current){peek(false);setTools(false);return;}
    if(hideTimer.current!==undefined)return;
    hideTimer.current=setTimeout(()=>{hideTimer.current=undefined;if(!root.current?.querySelector('.compact-pet :focus-visible'))setTools(false);},220);
  };
  const elastic=useElasticDrag(root,p.stage,p.native,reaction=>{
    if(p.pet.sleeping)return;
    if(reaction==='dizzy'&&!p.itemId){setShaking(true);clearTimeout(shakeTimer.current);shakeTimer.current=setTimeout(()=>setShaking(false),3200);p.onShake();}
    else if(reaction==='turn')p.onTug?.();
  });
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean; direction: number; turns: number; turnAt: number; offset: { x: number; y: number } } | null>(null);
  useEffect(() => {
    if (!p.native) return;
    const hit = (e: MouseEvent) => {
      if(through.current){setTools(false);return;}
      if (drag.current?.moved) return;
      look(e.clientX,e.clientY);
      // A forwarded move can be rounded to exactly the transparent window's
      // boundary. Test its last real pixel instead of treating it as a leave.
      const nearWindow = e.clientX >= -1 && e.clientX <= innerWidth + 1 && e.clientY >= -1 && e.clientY <= innerHeight + 1;
      const target = document.elementFromPoint(nearWindow ? Math.max(0, Math.min(innerWidth - 1, e.clientX)) : e.clientX, nearWindow ? Math.max(0, Math.min(innerHeight - 1, e.clientY)) : e.clientY);
      // Forwarded moves still reveal tools while the transparent window passes clicks through.
      if(dockedRef.current){peek(Boolean(target?.closest('.desktop-character')));setTools(false);}
      else if(target?.closest('.desktop-character,.pet-actions,.compact-hover-bridge,.compact-pet-name'))revealTools();else hideTools();
      window.desktop?.setMousePassthrough(!target?.closest('button,input,textarea,select,summary,[role="dialog"],a,.compact-hover-bridge'));
    };
    document.addEventListener('mousemove', hit);
    return () => { document.removeEventListener('mousemove', hit); window.desktop?.setMousePassthrough(false); };
  }, [p.native]);
  const selfBusy=isPastime(p.action)||isSchoolAction(p.action)||Boolean(p.pet.activity)||Boolean(p.pet.outing);
  useEffect(() => { void window.desktop?.setInteracting((tools&&!docked) || dragging || p.panel !== null || selfBusy); }, [tools, dragging, p.panel,docked,selfBusy]);
  useEffect(()=>{if(p.desktopState.mouseThrough){setTools(false);if(p.panel)p.onPanel(null)}},[p.desktopState.mouseThrough,p.panel]);
  useEffect(()=>{if(docked){setTools(false);if(p.panel)p.onPanel(null);}else edgeHover.current=false;},[docked,p.panel]);
  useEffect(() => () => { void window.desktop?.setInteracting(false); }, []);
  useEffect(() => () => clearTimeout(shakeTimer.current), []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { p.onPanel(null); setTools(false); } };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [p.onPanel]);
  const touchPet = () => {if(dockedRef.current){peek(true);return;} void window.desktop?.revealPet(); revealTools(); p.onPet(); };
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || p.action.startsWith('element-')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (p.panel) p.onPanel(null);
    const x = p.native ? e.screenX : e.clientX, y = p.native ? e.screenY : e.clientY;
    if(p.native)void window.desktop?.preparePetDrag();
    drag.current = { x, y, lastX: x, lastY: y, moved: false, direction: 0, turns: 0, turnAt: performance.now(), offset };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current; if (!d) {revealTools();return;}
    const x = p.native ? e.screenX : e.clientX, y = p.native ? e.screenY : e.clientY;
    if (!d.moved && Math.hypot(x - d.x, y - d.y) < 5) return;
    if (!d.moved) {
      const painted = root.current?.querySelector<HTMLElement>('.compact-pet');
      const held = painted ? paintedEdgeOffset(getComputedStyle(painted).transform) : { x: 0, y: 0 };
      // Freeze the painted point while IPC transfers that offset to the native
      // window. Disabling a live transition at its target would otherwise snap.
      setHeldEdgeOffset(held);d.moved = true;void window.desktop?.startPetDrag(held);
      setDragging(true); setTools(false); p.onPanel(null); playPetVoice('lift', p.sound);
      const body=e.currentTarget.getBoundingClientRect();elastic.start({x:d.x,y:d.y,at:performance.now()-16},(e.clientX-body.left)/body.width*100,(e.clientY-body.top)/body.height*100);
    }
    elastic.sample({x,y,at:performance.now()});
    {
      if (p.native) void window.desktop?.dragPetToCursor();
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
    setDragging(false); elastic.release(); if(p.native)void window.desktop?.endPetDrag();
    if (d?.moved) { if(!cancelled)setTools(true);playPetVoice('drop', p.sound); }
    else if (!cancelled) touchPet();
  }
  const show = (panel: CompanionPanel) => { setTools(true); p.onPanel(panel); };
  const side = p.native ? p.desktopState.panelSide : 'right';
  const classicOpen=false;
  const bookGeometry=p.desktopState.panelGeometry;
  const edge = p.native ? p.desktopState.edgePose : 'visible';
  const edgeSide = p.native ? p.desktopState.edgeSide : null;
  const entering = docked && edge === 'tucking' && !dragging;
  const targetOffset = edgeTargetOffset(edgeSide, edge, p.desktopState.edgeOffset);
  const paintedOffset = docked && dragging ? heldEdgeOffset : targetOffset;
  const edgeAction = entering ? edgeEntryAction(p.stage, edgeSide) : edge === 'hidden' ? 'still' : edge === 'peek' ? 'idle' : p.action;
  const displayAction = docked && !p.itemId && !p.pet.sleeping ? edgeAction : p.action;
  const layoutStyle = { '--classic-pet-x': `${bookGeometry?.petX??p.desktopState.petOffset?.x??0}px`, '--classic-pet-y': `${bookGeometry?.petY??p.desktopState.petOffset?.y??0}px`, '--edge-x': `${paintedOffset.x}px`, '--edge-y': `${paintedOffset.y}px`, '--pocket-x':`${bookGeometry?.panelX??160}px`,'--pocket-y':`${bookGeometry?.panelY??20}px`,...(!p.native ? { transform: `translate(${offset.x}px,${offset.y}px)` } : {}) } as CSSProperties;
  const toolsVisible=!dragging&&!docked&&(tools||p.panel!==null);
  return <div ref={root} className={`companion-layout ${p.panel ? 'panel-open' : ''} ${classicOpen?'classic-open':''} ${docked?'is-edge-docked':''} ${dragging?'is-pet-dragging':''} panel-${side} ${p.desktopState.mouseThrough?'is-mouse-through':''} ${p.native ? 'is-native' : 'is-preview'} edge-${edge} edge-${edgeSide ?? 'none'}`} data-edge-pose={edge} data-edge-side={edgeSide ?? 'none'} style={layoutStyle}>
    <div className={`desktop-pet compact-pet ${toolsVisible ? 'actions-open' : ''} ${p.pet.outing?'pet-is-away':''}`} onPointerMove={e=>look(e.clientX,e.clientY)} onPointerLeave={()=>{gaze.current={x:0,y:0};hideTools();}} onFocusCapture={revealTools} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))hideTools();}} onContextMenu={e => { e.preventDefault();if(docked){peek(true);return;} void window.desktop?.revealPet(); setTools(true); p.onPanel('food'); }}>
      <CareFeedback feedback={docked||classicOpen?null:p.careFeedback}/>{p.bubbleVisible&&!docked&&!p.pet.activity&&!p.courseCompletion&&<button type="button" className={`compact-bubble ${p.bubbleVisible&&!docked ? 'visible' : ''}`} aria-label="收起拉姆提示" aria-hidden={!p.bubbleVisible||docked} tabIndex={p.bubbleVisible&&!docked?0:-1} disabled={!p.bubbleVisible||docked} onClick={()=>{setTools(true);p.onBubble();}}><span role="status">{p.bubble}</span></button>}
      <button className={`compact-pet-name ${p.pet.sleeping ? 'sleeping-badge' : ''}`} aria-label={p.pet.sleeping ? '叫醒拉姆' : '打开拉姆背包'} aria-hidden={docked} tabIndex={docked?-1:0} disabled={docked} onClick={() => p.pet.sleeping ? p.onCare('sleep') : show('food')}>{p.pet.sleeping ? '睡着了 · 叫醒' : p.pet.name}</button>
      <button className="desktop-character" data-testid="desktop-character" aria-label="拉姆：悬停互动，点击摸摸，按住拖动" onPointerEnter={revealTools} onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e)} onPointerCancel={e => up(e, true)} onClick={e => { if (e.detail === 0) touchPet(); }}>
        <Ram companionId={p.pet.createdAt} costume={p.pet.wearing} gaze={gaze} sound={p.sound&&!docked} color={p.pet.color} stage={p.stage} evolution={p.pet.evolution} action={displayAction} actionId={p.actionId} itemId={p.itemId} fromColor={p.fromColor} sleeping={p.pet.sleeping} peeking={docked && edge==='peek'} peekSide={edgeSide ?? undefined} edgeEntry={entering ? edgeSide ?? undefined : undefined} dragging={dragging} dragTilt={0} shaking={shaking} onActionEnd={displayAction==='play'||isMoodAction(displayAction)||isPastime(displayAction)||isSchoolAction(displayAction)?p.onActionEnd:undefined}/>
      </button>
      {p.pet.outing&&<div className="pet-away-note" role="status"><img src="./assets/original/ui/icon-book-large.png" alt=""/><span>去{p.pet.outing.place}啦</span><small>{new Date(p.pet.outing.returnsAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 回来</small><button onClick={p.onRecall}>叫拉姆回来</button></div>}
      {toolsVisible && <><div className="compact-hover-bridge" onPointerEnter={revealTools}/><nav className="pet-actions" data-testid="pet-actions" aria-label="拉姆快捷操作" onPointerEnter={revealTools}>
                <button aria-label="状态" onClick={() => show('food')}><Icon path={icons.status}/></button>
        <button aria-label="玩耍" onClick={() => show('play')}><Icon path={icons.play}/></button>
        <button className={`timer-tool ${p.timerRunning?'running':''}`} aria-label={p.timerRunning?'取消计时':'开始计时'} aria-pressed={p.timerRunning} disabled={!p.reminders} onClick={p.onFocus}><Icon path={icons.timer}/>{p.timerRunning&&<span className="tool-countdown" role="timer" aria-label={p.timerDirection==='countup'?'专注正向计时':'专注倒计时'}>{reminderTime(p.reminderSeconds)}</span>}</button>
        <button aria-label="进入小屋" onClick={p.onHome}><Icon path={icons.home}/></button>
      </nav></>}
      {(p.pet.activity||p.courseCompletion)&&!docked&&<div className="school-desktop-status">{p.pet.activity?<ActivityCountdown activity={p.pet.activity}/>:<span role="status">{p.courseCompletion}</span>}</div>}
      {p.saveError && <span className="compact-save-error">存档未保存，请到小屋备份</span>}
    </div>
    {p.panel&&<section className={`companion-panel panel-${p.panel}`} role="dialog" aria-label={`拉姆${labels[p.panel]}`} data-testid="companion-panel">
      {p.panel==='food'?p.pocketContent:<><header><strong>一起玩耍</strong><button aria-label="关闭小窗" onClick={()=>p.onPanel(null)}>×</button></header><div className="desktop-play">
        <button disabled={p.pet.sleeping||p.moodBusy} onClick={()=>p.onCare('play')}><Icon path="items/180004"/>一起玩球</button>
        <button disabled={p.pet.sleeping||p.moodBusy} onClick={p.onPet}><Icon path="ui/icon-happy"/>摸摸拉姆</button>
        <button disabled={p.pet.sleeping||p.moodBusy} onClick={p.onCurious}><img alt="" src="./assets/generated/v15-butterfly.png"/>和蝴蝶玩</button>
        <button disabled={p.moodBusy||p.pet.sleeping} onClick={p.onMood}><Icon path="ui/status-health"/>回应心情</button>
        <button disabled={p.moodBusy&&!p.pet.sleeping} onClick={()=>p.onCare('sleep')}><Icon path="ui/icon-clock"/>{p.pet.sleeping?'轻轻叫醒':'睡一会儿'}</button>
        <button disabled={p.moodBusy||p.stage===0} onClick={p.onWork}><img alt="" src="./assets/generated/school/icons/restaurant.png"/>餐厅打工</button>
        <button disabled={p.moodBusy||!p.magicLearned} onClick={p.onMagic}><img alt="" src="./assets/generated/school/icons/magic.png"/>{p.magicLearned?'变魔术':'上魔法课解锁'}</button>
        <button onClick={p.onSchool}><Icon path="ui/icon-book-large"/>学院</button>
        <button onClick={p.onHome}><Icon path={icons.home}/>回小屋</button>
      </div>{ELEMENT_TYPES.filter(type=>learned(p.pet,`element-${type.id}` as CourseId)).map(type=><section key={type.id} className="desktop-element-group" aria-label={`${type.name}法术`}><h3>{type.name}法术</h3><div className="desktop-element-grid">{elementSkillsForCourse(`element-${type.id}`).map(skill=><button key={skill.id} disabled={p.moodBusy||!learnedElementSkill(p.pet,skill.id)||p.pet.sleeping||Boolean(p.pet.activity)||Boolean(p.pet.outing)} onClick={()=>p.onElementSkill(skill.id)}><img alt="" src={`./assets/original/element-skills/icons/${type.id}.png`}/>{skill.name}</button>)}</div></section>)}</>}
    </section>}

  </div>;
}

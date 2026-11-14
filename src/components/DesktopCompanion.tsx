import OfficialClipMenu from './OfficialClipMenu';
import {isOfficialAction} from '../official-clips';
import {isUploadedAction} from '../uploaded-actions';
import {petAppearance} from '../wardrobe';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent, ReactNode } from 'react';
import type { Action, GameState, Stage, PetColor } from '../game';
import { playPetVoice } from '../pet-audio';
import Ram from './Ram';
import {useElasticDrag} from '../use-elastic-drag';
import {isPastime} from '../pet-pastimes';
import {isSchoolAction} from '../pet-school';
import ActivityCountdown from './ActivityCountdown';
import DesktopRestaurantWork from './DesktopRestaurantWork';
import {pointerGaze,type PetGaze} from '../pet-attention';
import { reminderTime } from '../use-rest-reminder';
import CareFeedback from './CareFeedback';
import type {CareFeedbackData} from '../care-feedback';
import { edgeEntryAction, edgeTargetOffset, paintedEdgeOffset, type EdgeVector } from '../edge-motion';
import type {PocketCategory} from './CarePocket';
import {desktopCondition} from '../desktop-condition';

export type CompanionPanel = 'status' | 'food' | 'play';
interface Props {
  moodLabel:string;moodBusy:boolean;interactionReason:string|null;onMood:()=>void; pocketContent:ReactNode;statusContent:ReactNode;
  onOriginalPlay:(id:string)=>void;onUploadedPlay:(id:string)=>void;onStopUploaded:()=>void;uploadedPlaying:boolean;courseCompletion:string;onElementSkill:(id:string)=>void;
  pet: GameState; stage: Stage; action: string; actionId: number; itemId?: string; fromColor?: PetColor;
  bubble: string; bubbleVisible: boolean; careFeedback:CareFeedbackData|null; panel: CompanionPanel | null;
  native: boolean; desktopState: DesktopState; sound: boolean; gameSound:boolean; soundVolume:number;
  onBoard:()=>void;onOuting:()=>void;
  saveError: boolean;
  timerDirection:'countdown'|'countup'; reminderSeconds: number; reminders: boolean; timerRunning: boolean;
  onPanel: (panel: CompanionPanel | null) => void;
  onCare: (action: Action, item?: string) => void;
  onWork:()=>void;onViewRestaurant:()=>void;onStopWork:()=>void;onSchool:()=>void;onMagic:()=>void;magicLearned:boolean;onHome: () => void; onShop: () => void;onWardrobe:()=>void; onFocus: () => void;
  onSay: (text: string) => void; onShake: () => void; onBubble: () => void; onPresence: () => void; onCurious: () => void; onPet: () => void;
  onActionEnd?:(completed?:boolean)=>void; onTug?:()=>void;
  onRecall:()=>void;
  pocketCategory: PocketCategory; pocketVisit: number; playInvitation?:ReactNode;
}
const icons = { food: 'items/180001', wash: 'items/180003', timer: 'ui/icon-book', chat: 'ui/toolbar-talk-normal', play: 'items/180004', status: 'ui/status-health', home: 'ui/toolbar-home-normal' };
function Icon({ path }: { path: string }) { return <img alt="" draggable={false} src={`./assets/original/${path}.png`}/>; }
const labels: Record<CompanionPanel, string> = {status:'状态',food:'背包',play:'一起玩耍'};
export default function DesktopCompanion(p: Props) {
  const appearance=petAppearance(p.pet);
  const reading=p.timerRunning||p.action==='focus'||p.action==='read-alone';
  const [tools, setTools] = useState(false), [dragging, setDragging] = useState(false);
  const [detailsHovered,setDetailsHovered]=useState(false),[detailsFocused,setDetailsFocused]=useState(false);
  const detailsTarget='.desktop-character,.compact-pet-name,.compact-pet-condition';
  const [previewResizing,setPreviewResizing]=useState(false),[previewScale,setPreviewScale]=useState(1);
  const resizeOrigin=useRef(1),resizeDrag=useRef<{x:number;y:number;scale:number;corner:string}|null>(null);
  const resizing=p.native?Boolean(p.desktopState.petResizing):previewResizing;
  const finishResize=(commit:boolean)=>{resizeDrag.current=null;if(p.native)void window.desktop?.finishPetResize?.(commit);else{if(!commit)setPreviewScale(resizeOrigin.current);setPreviewResizing(false)}};
  const beginResize=()=>{p.onPanel(null);setTools(false);if(p.native)void window.desktop?.openSizeEditor?.().then(started=>{if(!started)p.onSay('请等当前动作结束后再调整大小。')}).catch(()=>p.onSay('请等当前动作结束后再调整大小。'));else{resizeOrigin.current=previewScale;setPreviewResizing(true)}};
  useEffect(()=>{
    if(!resizing)return;
    const stop=()=>{resizeDrag.current=null;void window.desktop?.stopPetResizeDrag?.()};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();finishResize(false)}else if(e.key==='Enter'){e.preventDefault();finishResize(true)}};
    window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('blur',stop);document.addEventListener('keydown',key);
    return()=>{window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',stop);document.removeEventListener('keydown',key)};
  },[resizing,p.native]);
  function resizeDown(e:PointerEvent<HTMLButtonElement>,corner:'nw'|'ne'|'sw'|'se'){
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
    if(p.native)void window.desktop?.startPetResize?.(corner);else resizeDrag.current={x:e.clientX,y:e.clientY,scale:previewScale,corner};
  }
  function resizeMove(e:PointerEvent<HTMLButtonElement>){
    const d=resizeDrag.current;if(!d||p.native)return;
    const x=d.corner.includes('e')?110:-110,y=d.corner.includes('s')?120:-120;
    setPreviewScale(Math.max(.5,Math.min(3,d.scale+((e.clientX-d.x)*x+(e.clientY-d.y)*y)/(x*x+y*y))));
  }

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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revealTools = () => { clearTimeout(hideTimer.current); hideTimer.current=undefined;if(dockedRef.current){setTools(false);peek(true);return;} if(!drag.current?.moved) setTools(true); };
  const hideTools = () => {
    if(dockedRef.current){peek(false);setTools(false);return;}
    if(hideTimer.current!==undefined)return;
    hideTimer.current=setTimeout(()=>{hideTimer.current=undefined;if(!root.current?.querySelector('.compact-pet :focus-visible'))setTools(false);},220);
  };
  const elastic=useElasticDrag(root,appearance.stage,p.native,reaction=>{
    if(p.pet.sleeping)return;
    if(reaction==='dizzy'&&!p.itemId)p.onShake();
    else if(reaction==='turn')p.onTug?.();
  });
  const drag = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean; direction: number; turns: number; turnAt: number; offset: { x: number; y: number }; prepared?:Promise<boolean> } | null>(null);
  useEffect(() => {
    if (!p.native) return;
    const hit = (e: MouseEvent) => {
      if(through.current){setTools(false);setDetailsHovered(false);return;}
      if (drag.current?.moved) return;
      look(e.clientX,e.clientY);
      // A forwarded move can be rounded to exactly the transparent window's
      // boundary. Test its last real pixel instead of treating it as a leave.
      const nearWindow = e.clientX >= -1 && e.clientX <= innerWidth + 1 && e.clientY >= -1 && e.clientY <= innerHeight + 1;
      const target = document.elementFromPoint(nearWindow ? Math.max(0, Math.min(innerWidth - 1, e.clientX)) : e.clientX, nearWindow ? Math.max(0, Math.min(innerHeight - 1, e.clientY)) : e.clientY);
      setDetailsHovered(Boolean(target?.closest(detailsTarget)));
      // Forwarded moves still reveal tools while the transparent window passes clicks through.
      if(dockedRef.current){peek(Boolean(target?.closest('.desktop-character')));setTools(false);}
      else if(target?.closest('.desktop-character,.pet-actions,.compact-hover-bridge,.compact-pet-name,.compact-pet-condition'))revealTools();else hideTools();
      window.desktop?.setMousePassthrough(!target?.closest('button,input,textarea,select,summary,[role="dialog"],a,.compact-hover-bridge'));
    };
    document.addEventListener('mousemove', hit);
    return () => { document.removeEventListener('mousemove', hit); window.desktop?.setMousePassthrough(false); };
  }, [p.native]);
  const selfBusy=p.action==='dizzy'||isOfficialAction(p.action)||reading||isUploadedAction(p.action)||Boolean(p.itemId)||isPastime(p.action)||isSchoolAction(p.action)||Boolean(p.pet.activity)||Boolean(p.pet.outing);
  useEffect(() => { void window.desktop?.setInteracting((tools&&!docked) || dragging || p.panel !== null || selfBusy); }, [tools, dragging, p.panel,docked,selfBusy]);
  useEffect(()=>{if(p.desktopState.mouseThrough){setTools(false);if(p.panel)p.onPanel(null)}},[p.desktopState.mouseThrough,p.panel]);
  useEffect(()=>{if(docked){setTools(false);if(p.panel)p.onPanel(null);}else edgeHover.current=false;},[docked,p.panel]);
  useEffect(() => () => { void window.desktop?.setInteracting(false); }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { p.onPanel(null); setTools(false); } };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [p.onPanel]);
  const touchPet = () => {if(reading||p.moodBusy&&p.action!=='pet')return;if(dockedRef.current){peek(true);return;} void window.desktop?.revealPet(); revealTools(); p.onPet(); };
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (reading || resizing || p.pet.sleeping || p.pet.activity || p.pet.outing || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (p.panel) p.onPanel(null);
    const x = p.native ? e.screenX : e.clientX, y = p.native ? e.screenY : e.clientY;
    const prepared=p.native?Promise.resolve(window.desktop?.preparePetDrag()).then(Boolean).catch(()=>false):undefined;
    drag.current = { x, y, lastX: x, lastY: y, moved: false, direction: 0, turns: 0, turnAt: performance.now(), offset,prepared };
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
      setHeldEdgeOffset(held);d.moved = true;
      // Manual pickup interrupts a finite performance, without changing its
      // already committed care result, growth or saved clothing. Clear only
      // the temporary drawing surface before asking the native window to move.
      if(!['idle','still','waiting'].includes(p.action)||p.itemId)p.onStopUploaded();
      if(p.native)void (async()=>{
        const prepared=await d.prepared;
        await window.desktop?.setPetEffectBounds?.(null);
        if(drag.current!==d)return;
        if(!prepared&&!await window.desktop?.preparePetDrag())throw Error('Native pickup unavailable');
        if(drag.current!==d)return;
        await window.desktop?.startPetDrag(held);
      })().catch(()=>{if(drag.current===d){drag.current=null;setDragging(false);elastic.release();void window.desktop?.endPetDrag()}});
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
    if(!drag.current)return;
    const d = drag.current; drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false); elastic.release(); if(p.native)void window.desktop?.endPetDrag();
    if (d?.moved) { if(!cancelled)setTools(true);playPetVoice('drop', p.sound); }
    else if (!cancelled) touchPet();
  }
  const show = (panel: CompanionPanel) => { setTools(true); p.onPanel(panel); };
  function contextMenu(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault();
    // Android emits contextmenu for a long press, including a held drag.
    // The desktop right-click shortcut must not interrupt that gesture.
    if (window.mobile || drag.current?.moved) return;
    if (dockedRef.current) { peek(true); return; }
    void window.desktop?.revealPet(); setTools(true); p.onPanel('food');
  }
  const side = p.native ? p.desktopState.panelSide : 'right';
  const classicOpen=false;
  const bookGeometry=p.desktopState.panelGeometry;
  const edge = p.native ? p.desktopState.edgePose : 'visible';
  const edgeSide = p.native ? p.desktopState.edgeSide : null;
  const entering = docked && edge === 'tucking' && !dragging;
  const targetOffset = edgeTargetOffset(edgeSide, edge, p.desktopState.edgeOffset,appearance.form);
  const paintedOffset = docked && dragging ? heldEdgeOffset : targetOffset;
  const edgeAction = entering ? edgeEntryAction(appearance.stage, edgeSide) : edge === 'hidden' ? 'still' : edge === 'peek' ? 'idle' : p.action;
  const displayAction = docked && !p.itemId && !p.pet.sleeping ? edgeAction : p.action;
  const layoutStyle = { '--classic-pet-x': `${bookGeometry?.petX??p.desktopState.petOffset?.x??0}px`, '--classic-pet-y': `${bookGeometry?.petY??p.desktopState.petOffset?.y??0}px`, '--edge-x': `${paintedOffset.x}px`, '--edge-y': `${paintedOffset.y}px`, '--pocket-x':`${bookGeometry?.panelX??160}px`,'--pocket-y':`${bookGeometry?.panelY??20}px`,'--pocket-width':`${bookGeometry?.panelWidth??324}px`,'--pocket-height':`${bookGeometry?.panelHeight??272}px`,...(!p.native ? { transform: `translate(${offset.x}px,${offset.y}px) scale(${previewScale})`,transformOrigin:'80px 240px' } : {}) } as CSSProperties;
  const working=p.pet.activity?.kind==='restaurant';
  const toolsVisible=!working&&!resizing&&!dragging&&!docked&&(tools||p.panel!==null);
  const condition=desktopCondition(p.pet,p.moodLabel);
  const detailsHidden=docked||Boolean(p.desktopState.petDetailsOnHover&&!detailsHovered&&!detailsFocused);
  return <div ref={root} className={`companion-layout ${detailsHidden?'pet-details-hidden':''} ${reading?'is-reading':''} ${working?'is-working':''} ${p.panel ? 'panel-open' : ''} ${classicOpen?'classic-open':''} ${docked?'is-edge-docked':''} ${dragging?'is-pet-dragging':''} ${resizing?'is-pet-resizing':''} panel-${side} ${p.desktopState.mouseThrough?'is-mouse-through':''} ${p.native ? 'is-native' : 'is-preview'} edge-${edge} edge-${edgeSide ?? 'none'}`} data-edge-pose={edge} data-edge-side={edgeSide ?? 'none'} style={layoutStyle}>
    <div className={`desktop-pet compact-pet ${toolsVisible ? 'actions-open' : ''} ${p.pet.outing?'pet-is-away':''} ${p.pet.activity?.kind==='restaurant'?'pet-at-work':''}`} onPointerMove={e=>{look(e.clientX,e.clientY);setDetailsHovered(Boolean((e.target as Element).closest(detailsTarget)));}} onPointerLeave={()=>{setDetailsHovered(false);gaze.current={x:0,y:0};hideTools();}} onFocusCapture={e=>{setDetailsFocused(e.target.matches(':focus-visible')&&Boolean(e.target.closest(detailsTarget)));revealTools();}} onBlurCapture={e=>{setDetailsFocused(e.relatedTarget instanceof Element&&e.relatedTarget.matches(':focus-visible')&&Boolean(e.relatedTarget.closest(detailsTarget)));if(!e.currentTarget.contains(e.relatedTarget))hideTools();}} onContextMenu={contextMenu}>
      {p.timerRunning&&!docked&&!resizing&&<div className="pet-focus-time" role="timer" aria-label={p.timerDirection==='countup'?'专注正向计时':'专注倒计时'}><Icon path="ui/icon-book"/><span>{reminderTime(p.reminderSeconds)}</span></div>}
      <CareFeedback feedback={docked||classicOpen||p.pet.activity?.kind==='restaurant'?null:p.careFeedback}/>{p.bubbleVisible&&!p.timerRunning&&!docked&&!p.pet.activity&&!p.courseCompletion&&<button type="button" className={`compact-bubble ${p.bubbleVisible&&!docked ? 'visible' : ''}`} aria-label="收起拉姆提示" aria-hidden={!p.bubbleVisible||docked} tabIndex={p.bubbleVisible&&!docked?0:-1} disabled={!p.bubbleVisible||docked} onClick={()=>{setTools(true);p.onBubble();}}><span role="status">{p.bubble}</span></button>}
      <button className={`compact-pet-name ${p.pet.sleeping ? 'sleeping-badge' : ''}`} aria-label={p.pet.sleeping ? '叫醒拉姆' : '打开拉姆背包'} aria-hidden={detailsHidden} tabIndex={detailsHidden?-1:0} disabled={detailsHidden} onClick={() => p.pet.sleeping ? p.onCare('sleep') : show('food')}>{p.pet.name}</button>
      <button className="compact-pet-condition" data-testid="desktop-condition" data-condition={condition.id} data-attention={condition.attention} aria-label={p.pet.sleeping?'叫醒拉姆：睡梦中':`查看拉姆状态：${condition.label}`} aria-hidden={detailsHidden} tabIndex={detailsHidden?-1:0} disabled={detailsHidden} onClick={()=>p.pet.sleeping?p.onCare('sleep'):show('status')}>{condition.label}</button>
      <button className="desktop-character" data-testid="desktop-character" aria-label={reading?'拉姆正在看书':'拉姆：悬停互动，点击摸摸，按住拖动'} onPointerEnter={()=>{setDetailsHovered(true);revealTools();}} onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e)} onPointerCancel={e => up(e, true)} onClick={e => { if (e.detail === 0) touchPet(); }}>
        {!working&&<Ram companionId={p.pet.createdAt} costume={p.pet.wearing} gaze={gaze} sound={p.sound&&!docked} gameSound={p.gameSound&&!docked} soundVolume={p.soundVolume} color={p.pet.color} stage={p.stage} evolution={p.pet.evolution} action={displayAction} actionId={p.actionId} itemId={p.itemId} fromColor={p.fromColor} sleeping={p.pet.sleeping} peeking={docked && edge==='peek'} peekSide={edgeSide ?? undefined} edgeEntry={entering ? edgeSide ?? undefined : undefined} dragging={dragging} dragTilt={0} onActionEnd={p.onActionEnd}/>}
      </button>
      {working&&<DesktopRestaurantWork pet={p.pet} onView={p.onViewRestaurant} onStop={p.onStopWork}/>}
      {p.pet.outing&&<div className="pet-away-note" role="status"><img src="./assets/original/ui/icon-book-large.png" alt=""/><span>去{p.pet.outing.place}啦</span><small>{new Date(p.pet.outing.returnsAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 回来</small><button onClick={p.onRecall}>叫拉姆回来</button></div>}
      {toolsVisible && <><div className="compact-hover-bridge" onPointerEnter={revealTools}/><nav className="pet-actions" data-testid="pet-actions" aria-label="拉姆快捷操作" onPointerEnter={revealTools}>
                <button aria-label="状态" onClick={() => show('status')}><Icon path={icons.status}/></button>
        <button aria-label="玩耍" onClick={() => show('play')}><Icon path={icons.play}/></button>
        <button className={`timer-tool ${p.timerRunning?'running':''}`} aria-label={p.timerRunning?'取消计时':'开始计时'} aria-pressed={p.timerRunning} disabled={!p.reminders} onClick={p.onFocus}><Icon path={icons.timer}/></button>

        <button aria-label="进入小屋" onClick={p.onHome}><Icon path={icons.home}/></button>
      </nav></>}
      {(p.pet.activity?.kind==='course'||p.courseCompletion)&&!docked&&<div className="school-desktop-status">{p.pet.activity?<ActivityCountdown activity={p.pet.activity}/>:<span role="status">{p.courseCompletion}</span>}</div>}
      {resizing&&<div className="pet-resize-ui" role="group" aria-label="拖动边角调整拉姆大小">
        <span className="pet-resize-hint">拖动边角调整大小</span><div className="pet-resize-frame"/>
        {(['nw','ne','sw','se'] as const).map(corner=><button key={corner} className={`pet-resize-handle resize-${corner}`} aria-label={`调整大小 ${corner}`} onPointerDown={e=>resizeDown(e,corner)} onPointerMove={resizeMove} onPointerUp={()=>{resizeDrag.current=null;void window.desktop?.stopPetResizeDrag?.()}} onPointerCancel={()=>{resizeDrag.current=null;void window.desktop?.stopPetResizeDrag?.()}}/>)}
        <div className="pet-resize-confirm"><button onClick={()=>finishResize(false)}>取消</button><button onClick={()=>finishResize(true)}>完成</button></div>
      </div>}
      {p.saveError && <span className="compact-save-error">存档未保存，请到小屋备份</span>}
    </div>
    {p.panel&&<section className={`companion-panel panel-${p.panel}`} role="dialog" aria-label={`拉姆${labels[p.panel]}`} data-testid="companion-panel">
      {p.panel==='status'?p.statusContent:p.panel==='food'?p.pocketContent:<><header><strong>一起玩耍</strong><button aria-label="关闭小窗" onClick={()=>p.onPanel(null)}>×</button></header><OfficialClipMenu pet={p.pet} busy={p.moodBusy} onPlay={p.onOriginalPlay} onElementSkill={p.onElementSkill} onMagic={p.onMagic} onStop={p.onStopUploaded} playing={isOfficialAction(p.action)||p.action.startsWith('element-')||p.action==='skill-magic'} activities={<div className="desktop-play">
        {(!p.native||Boolean(window.desktop?.openSizeEditor))&&<button aria-label="放大缩小" disabled={reading} onClick={beginResize}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H3v6m12 12h6v-6M3 3l7 7m11 11-7-7"/></svg>调整大小</button>}
        <button aria-label={working?'结束餐厅打工':'去餐厅打工'} disabled={!working&&(p.moodBusy||p.stage===0)} onClick={working?p.onStopWork:p.onWork}><img alt="" src="./assets/generated/school/icons/restaurant.png"/>{working?'结束打工':'餐厅打工'}</button>
        <button onClick={p.onViewRestaurant}><img alt="" src="./assets/original/restaurant/dock.png"/>进入餐厅</button>
        <button disabled={p.pet.sleeping||p.moodBusy} onClick={()=>p.onCare('play')}><Icon path="items/180004"/>一起玩球</button>
        <button disabled={p.pet.sleeping||p.moodBusy} onClick={p.onPet}><Icon path="ui/icon-happy"/>摸摸拉姆</button>
        <button disabled={p.moodBusy||p.stage===0||p.pet.sleeping||Boolean(p.pet.outing)} onClick={p.onOuting}><svg className="outing-icon" aria-hidden="true" viewBox="0 0 32 32" fill="none"><path d="M6 26c1-5 5-7 9-9s8-4 10-10" stroke="#a77d45" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3"/><path d="M18 7c0-4 7-4 7 0 0 3-3.5 7-3.5 7S18 10 18 7Z" fill="#df7648" stroke="#9d5431" strokeWidth="1.3"/><circle cx="21.5" cy="6.5" r="1.4" fill="#fff5d9"/><path d="M3 26c0-4 3-7 5-7s3 4 1 6-6 3-6 1Z" fill="#b6c973" stroke="#7c9347" strokeWidth="1.3"/></svg>出门逛逛</button>
        <button disabled={p.pet.sleeping||p.moodBusy} onClick={p.onCurious}><img alt="" src="./assets/generated/v15-butterfly.png"/>和蝴蝶玩</button>
        <button disabled={p.moodBusy&&!p.pet.sleeping} onClick={()=>p.onCare('sleep')}><Icon path="ui/status-sleep"/>{p.pet.sleeping?'轻轻叫醒':'睡一会儿'}</button>
        <button onClick={p.onBoard}><img alt="" src="./assets/original/message-board/board.png"/>留言板</button>
        <button onClick={p.onSchool}><Icon path="ui/icon-book-large"/>学院</button>
        <button onClick={p.onHome}><Icon path={icons.home}/>回小屋</button>
      </div>}/></>}
    </section>}

  </div>;
}

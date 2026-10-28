import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Evolution, PetColor, Stage } from '../game';
import type { RoomBackground } from '../room-media';
import type { ScenePhase } from '../scene-time';
import { sceneSheetPosition } from '../scene-time';
import { playGameSound,stopGameSounds } from '../pet-audio';
import type { GameReceipt } from './game-receipt';
import Ram from './Ram';
import { createTreasureRound, findTreasure, treasureHint, treasureScore } from './treasure-rules';
import './TreasureGame.css';

interface Props {
  background: RoomBackground; phase: ScenePhase; color: PetColor; stage: Stage; evolution?: Evolution;
  costume?:string;
  sound?: boolean; onClose: () => void; onComplete: (score: number) => GameReceipt;
}
type RoundPhase = 'ready' | 'playing' | 'collected' | 'finished' | 'closed';

export default function TreasureGame({ background, phase, color, stage, evolution, costume, sound = false, onClose, onComplete }: Props) {
  useEffect(()=>()=>stopGameSounds(),[]);
  const [round, setRound] = useState(createTreasureRound);
  const [mode, setMode] = useState<RoundPhase>('ready');
  const [found, setFound] = useState<string[]>([]);
  const hinted = useRef<string[]>([]);
  const [hintedId, setHintedId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [feedback, setFeedback] = useState('');
  const [receipt, setReceipt] = useState<GameReceipt | null>(null);
  const [reaction, setReaction] = useState({ action: 'idle', id: 0 });
  const dialog = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const modeRef = useRef(mode); modeRef.current = mode;
  const foundRef = useRef(found); foundRef.current = found;
  const pausedRef = useRef(paused || hidden); pausedRef.current = paused || hidden;
  const manualPause = useRef(false);
  const claimed = useRef(false);
  const closeRef = useRef(() => {});
  const callbacks = useRef({ onClose, onComplete }); callbacks.current = { onClose, onComplete };
  const stopped = paused || hidden;
  const position = sceneSheetPosition(phase);
  const sceneStyle = { '--scene-x': position.x, '--scene-y': position.y } as CSSProperties;

  function close() {
    if (modeRef.current === 'closed') return;
    claimed.current = true; modeRef.current = 'closed'; setMode('closed'); callbacks.current.onClose();
  }
  closeRef.current = close;
  function start() {
    playGameSound('start',sound);
    setRound(createTreasureRound()); foundRef.current = []; setFound([]); hinted.current = []; setHintedId(null);
    setReceipt(null); setFeedback('慢慢找，我陪着你。'); claimed.current = false;
    manualPause.current = false; pausedRef.current = document.hidden; setPaused(false); modeRef.current = 'playing'; setMode('playing');
    setReaction(previous => ({ action: 'idle', id: previous.id + 1 }));
  }
  function pick(id: string) {
    if (modeRef.current !== 'playing' || pausedRef.current || document.hidden) return;
    if (foundRef.current.includes(id)) return;
    const next = findTreasure(round, foundRef.current, id);
    if (!next) { playGameSound('miss',sound);setFeedback('这件不在清单上，再看看旁边吧。'); return; }
    foundRef.current = next; setFound(next); if (hintedId === id) setHintedId(null);
    playGameSound(next.length===round.targets.length?'combo':'catch', sound); setReaction(previous => ({ action: 'catch', id: previous.id + 1 }));
    setFeedback(`找到${round.objects.find(object => object.id === id)!.name}啦！`);
    if (next.length === round.targets.length) { modeRef.current = 'collected'; setMode('collected'); setFeedback('都找到啦！这份小小的默契，收好。'); }
  }
  function hint() {
    if (modeRef.current !== 'playing' || pausedRef.current || document.hidden || hintedId) return;
    const id = treasureHint(round, foundRef.current); if (!id) return;
    playGameSound('hint',sound);
    setHintedId(id); if (!hinted.current.includes(id)) hinted.current = [...hinted.current, id];
    setReaction(previous => ({ action: 'look-around', id: previous.id + 1 })); setFeedback('看看轻轻发光的地方～');
  }
  function collect() {
    if (modeRef.current !== 'collected' || claimed.current || document.hidden || pausedRef.current) return;
    claimed.current = true; modeRef.current = 'finished'; setMode('finished');
    setReceipt(callbacks.current.onComplete(treasureScore(round, foundRef.current, hinted.current)));
    setReaction(previous => ({ action: 'happy', id: previous.id + 1 }));
  }
  function togglePause() { const next = !paused;playGameSound(next?'pause':'resume',sound); manualPause.current = next; pausedRef.current = next || document.hidden; setPaused(next); }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const visibility = () => { pausedRef.current = document.hidden || manualPause.current; setHidden(document.hidden); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      // The room's underlying dialog must not compete with this modal's trap.
      event.stopPropagation();
      const items = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []).filter(button => button.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], outside = !dialog.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard, true); document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('keydown', keyboard, true); document.removeEventListener('visibilitychange', visibility); previous?.focus(); };
  }, []);
  useEffect(() => {
    if (mode === 'ready' || mode === 'collected' || mode === 'finished' || paused) primary.current?.focus();
    else if (mode === 'playing') dialog.current?.focus();
  }, [mode, paused]);

  if (mode === 'closed') return null;
  const looking = mode === 'playing', targets = round.targets.map(id => round.objects.find(object => object.id === id)!);
  return <div className="treasure-backdrop"><div ref={dialog} tabIndex={-1} className="treasure-dialog" role="dialog" aria-modal="true" aria-labelledby="treasure-title" data-testid="treasure-game" data-phase={mode}>
    <header className="treasure-heading"><div><h2 id="treasure-title">小屋寻宝</h2><span>{background.label}</span></div><button type="button" className="treasure-close" aria-label={looking || mode === 'collected' ? '退出游戏，本局不领取奖励' : '关闭寻宝'} onClick={close}/></header>
    {mode !== 'ready' && <div className="treasure-checklist" role="list" aria-label="寻宝清单" data-testid="treasure-targets">{targets.map(item => <div key={item.id} role="listitem" data-target-id={item.id} data-found={found.includes(item.id)}><img src={item.image} alt=""/><span>{item.name}</span><b aria-label={found.includes(item.id) ? '已找到' : '还没找到'}>{found.includes(item.id) ? '✓' : '·'}</b></div>)}</div>}
    <div className={`treasure-scene ${background.phaseSheet ? 'has-phase-art' : ''} ${stopped ? 'is-paused' : ''}`} data-scene-phase={phase} style={sceneStyle}>
      <div className="treasure-scene-art" aria-hidden="true"><img className={background.phaseSheet ? 'treasure-scene-sheet' : 'treasure-scene-image'} src={background.src} alt=""/></div>
      {mode !== 'ready' && round.objects.map(item => <button type="button" key={item.id} className={`treasure-object ${found.includes(item.id) ? 'is-found' : ''} ${hintedId === item.id ? 'is-hinted' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} aria-label={`寻找${item.name}`} data-treasure-id={item.id} disabled={!looking || stopped || found.includes(item.id)} onClick={() => pick(item.id)}><img src={item.image} alt=""/>{found.includes(item.id) && <span className="treasure-pickup" aria-hidden="true">✧</span>}</button>)}
      <div className="treasure-ram"><Ram costume={costume} color={color} stage={stage} evolution={evolution} action={stopped ? 'still' : reaction.action} actionId={reaction.id} sound={sound && !stopped} onActionEnd={() => setReaction(previous => ({ ...previous, action: 'idle' }))}/></div>
      {mode === 'ready' && <div className="treasure-intro"><h3>一起找找小宝物</h3><p>照着清单，找到藏在小屋里的三样用品。</p><span>不用赶时间，拉姆陪你慢慢找。</span></div>}
      {looking && stopped && <div className="treasure-pause-cover"><h3>{hidden ? '等你回来' : '歇一小会儿'}</h3>{!hidden && <button ref={primary} type="button" className="treasure-button" onClick={togglePause}>继续寻宝</button>}</div>}
      {mode === 'collected' && <div className="treasure-collected"><b>我们找齐啦！</b><span>{found.length} / {round.targets.length}</span></div>}
    </div>
    {mode === 'ready' && <button ref={primary} className="treasure-button treasure-start" type="button" data-testid="treasure-start" onClick={start}>开始寻宝</button>}
    {looking && <><div className="treasure-toolbar"><strong aria-label={`已经找到${found.length}件，共${round.targets.length}件`}>{found.length} / {round.targets.length}</strong><button type="button" className="treasure-button secondary" disabled={stopped || Boolean(hintedId)} onClick={hint}>拉姆提示</button><button type="button" className="treasure-button secondary" disabled={stopped} onClick={togglePause}>暂停寻宝</button></div><p className="treasure-feedback" role="status">{feedback}</p></>}
    {mode === 'collected' && <div className="treasure-claim"><p role="status">一起找到的小宝物，收进今天的回忆。</p><button ref={primary} type="button" className="treasure-button" disabled={stopped} onClick={collect}>收好宝物</button></div>}
    {mode === 'finished' && <div className="treasure-result"><h3>又多了一段小小的冒险</h3>{receipt && <><div className="treasure-receipt"><span>摩尔豆 <b>+{receipt.coins}</b></span><span>用品 <b>+{receipt.food}</b></span></div><p role="status">{receipt.message}</p></>}<div className="treasure-result-actions"><button type="button" className="treasure-button secondary" onClick={start}>再找一局</button><button ref={primary} type="button" className="treasure-button" onClick={close}>完成</button></div></div>}
  </div></div>;
}

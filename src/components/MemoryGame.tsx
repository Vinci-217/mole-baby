import GameRewardItem from './GameRewardItem';
import type { GameReceipt } from './game-receipt';
import { useEffect, useRef, useState } from 'react';
import './MemoryGame.css';
import GameArt from './GameArt';
import { playGameSound,stopGameSounds } from '../pet-audio';

type Phase = 'ready' | 'preview' | 'playing' | 'celebrating' | 'finished';
type Card = { id: number; kind: number; matched: boolean };
const symbols = ['apple', 'biscuit', 'juice', 'bath', 'ball', 'moon'] as const;
const names = ['可可果', '熊熊饼干', '浆果果汁', '泡泡浴', '运动足球', '时钟'];
function shuffle(): Card[] {
  const cards = Array.from({ length: 12 }, (_, id) => ({ id, kind: id % 6, matched: false }));
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

export default function MemoryGame({ onComplete, onClose, sound=false }: { onComplete: (score: number) => GameReceipt | void; onClose: () => void; sound?: boolean }) {
  useEffect(()=>()=>stopGameSounds(),[]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [board, setBoard] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [pairs, setPairs] = useState(0);
  const [turns, setTurns] = useState(0);
  const [seconds, setSeconds] = useState(45);
  const [previewSeconds, setPreviewSeconds] = useState(3);
  const [receipt, setReceipt] = useState<GameReceipt | null>(null);
  const [score, setScore] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const firstButton = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<Card[]>([]);
  const selectedRef = useRef<number[]>([]);
  const pairsRef = useRef(0);
  const turnsRef = useRef(0);
  const locked = useRef(false);
  const startedAt = useRef(0);
  const completed = useRef(false);
  const lastWarning=useRef(4);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onComplete, onClose }); callbacks.current = { onComplete, onClose };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstButton.current?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); callbacks.current.onClose(); }
      if (e.key === 'Tab') {
        const items = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); clearTimeout(flipTimer.current); previous?.focus(); };
  }, []);

  function finish() {
    if (completed.current) return;
    completed.current = true; locked.current = true; clearTimeout(flipTimer.current);
    // Matching every pair earns ten points; partially finished rounds still reward practice.
    const finalScore = Math.min(10, Math.round(pairsRef.current / 6 * 10));
    setScore(finalScore); setSelected([]); selectedRef.current = []; setPhase('finished');
    setReceipt(callbacks.current.onComplete(finalScore) ?? null);
  }

  useEffect(() => {
    if (!['preview', 'playing', 'celebrating'].includes(phase)) return;
    const timer = setInterval(() => {
      const elapsed = (performance.now() - startedAt.current) / 1000;
      const remaining=Math.ceil(45-elapsed);if(remaining>0&&remaining<=3&&remaining<lastWarning.current){lastWarning.current=remaining;playGameSound('countdown',sound)}
      setSeconds(Math.max(0, Math.ceil(45 - elapsed)));
      setPreviewSeconds(Math.max(0, Math.ceil(3 - elapsed)));
      if (elapsed >= 45 || (phase === 'celebrating' && elapsed >= 10)) finish();
      else if (phase === 'preview' && elapsed >= 3) setPhase('playing');
    }, 100);
    return () => clearInterval(timer);
  }, [phase,sound]);

  function start() {
    lastWarning.current=4;playGameSound('start',sound);
    clearTimeout(flipTimer.current);
    const cards = shuffle(); boardRef.current = cards; setBoard(cards);
    selectedRef.current = []; setSelected([]); pairsRef.current = 0; setPairs(0);
    turnsRef.current = 0; setTurns(0); setSeconds(45); setPreviewSeconds(3);
    setReceipt(null); locked.current = false; completed.current = false; startedAt.current = performance.now(); setPhase('preview');
  }
  function flip(index: number) {
    if (phase !== 'playing' || locked.current || boardRef.current[index].matched || selectedRef.current.includes(index)) return;
    const next = [...selectedRef.current, index]; selectedRef.current = next; setSelected(next);
    if (next.length !== 2) {playGameSound('flip',sound);return;}
    turnsRef.current += 1; setTurns(turnsRef.current);
    const [a, b] = next;
    if (boardRef.current[a].kind === boardRef.current[b].kind) {
      playGameSound('match',sound);
      const cards = boardRef.current.map((card, i) => i === a || i === b ? { ...card, matched: true } : card);
      boardRef.current = cards; setBoard(cards); pairsRef.current += 1; setPairs(pairsRef.current);
      selectedRef.current = []; setSelected([]);
      if (pairsRef.current === 6) {
        if (performance.now() - startedAt.current >= 10_000) finish();
        else setPhase('celebrating');
      }
    } else {
      playGameSound('mismatch',sound);
      locked.current = true;
      flipTimer.current = setTimeout(() => { selectedRef.current = []; setSelected([]); locked.current = false; }, 720);
    }
  }

  return <div className="memory-backdrop"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="memory-title" className="memory-dialog" data-phase={phase}>
    <div className="memory-heading"><div><span className="memory-eyebrow">拉姆游乐场</span><h2 id="memory-title">拉姆翻翻乐</h2></div><button className="memory-close" onClick={onClose} aria-label={['preview', 'playing'].includes(phase) ? '退出翻牌游戏，本局不领取奖励' : '关闭翻牌游戏'}></button></div>
    <p className="memory-description">记住熟悉的拉姆用品，把相同图案配成一对。</p>
    {phase === 'ready' && <><div className="memory-preview">{(['apple', 'biscuit', 'ball'] as const).map((kind, i) => <div key={i}><GameArt kind={kind}/><span>{names[symbols.indexOf(kind)]}</span></div>)}</div><div className="memory-instructions"><img className="memory-help-icon" src="./assets/original/ui/icon-book.png" alt="" /><div><strong>找到图案相同的两张卡片</strong><p>先用 3 秒记住位置，再翻开卡片配对。<br/>45 秒内找到全部 6 对，即可获得满分奖励。</p></div></div><button ref={firstButton} className="memory-primary" onClick={start} data-testid="memory-start">开始翻牌<span>45 秒</span></button></>}
    {['preview', 'playing', 'celebrating'].includes(phase) && <><div className="memory-scoreboard"><span><GameArt kind="clock"/><strong>{seconds}</strong> 秒</span><span data-testid="memory-pairs">配对 <strong>{pairs}</strong> / 6</span><span>已翻 {turns} 次</span></div><p className="memory-prompt" role="status">{phase === 'preview' ? `记住这些拉姆用品…… ${previewSeconds}` : phase === 'celebrating' ? '太棒啦！拉姆正在把奖励装进小口袋……' : '选两张，看看它们是不是好朋友？'}</p><div className="memory-board" data-testid="memory-board">{board.map((card, i) => { const shown = phase === 'preview' || card.matched || selected.includes(i); const kind = symbols[card.kind]; return <button key={card.id} data-testid="memory-card" data-kind={phase === 'preview' ? card.kind : undefined} className={`memory-card ${shown ? 'revealed' : ''} ${card.matched ? 'matched' : ''}`} aria-label={shown ? `${names[card.kind]}${card.matched ? '，已配对' : ''}` : `翻开第 ${i + 1} 张卡片`} disabled={phase !== 'playing' || card.matched} onClick={() => flip(i)}>{shown ? <><GameArt kind={kind}/><span className="memory-card-name">{names[card.kind]}</span>{card.matched && <span className="memory-matched-check">✓</span>}</> : <img className="memory-card-back" src="./assets/original/ui/sprout.png" alt="" />}</button>; })}</div><p className="memory-hint">点击翻牌，或使用 Tab 和 Enter 操作 · Esc 退出</p></>}
    {phase === 'finished' && <div className="memory-result" data-testid="memory-result"><div className="memory-trophy"><GameArt kind="trophy"/></div><h3>{pairs === 6 ? '拉姆用品，全部配对成功！' : '拉姆翻翻乐，完成啦！'}</h3><p>找到了 {pairs} 对图案 · 翻牌 {turns} 次 · {score} 分</p><div className="memory-rewards"><div><strong>+{receipt?.coins ?? (4 + score * 2)}</strong><span>摩尔豆</span></div><div><GameRewardItem receipt={receipt}/></div></div><p className="memory-saved">{receipt?.message ?? '奖励已装进口袋'}</p><div className="memory-result-actions"><button className="memory-secondary" onClick={start}>再玩一次</button><button className="memory-primary" onClick={onClose}>{receipt?.ok === false ? '返回' : '收好奖励'}</button></div></div>}
    <p className="memory-footnote">配对越多，奖励越多。完整结束一局即可领奖，中途退出不发奖励。</p>
  </div></div>;
}

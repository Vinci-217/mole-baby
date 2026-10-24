import { useEffect, useRef, useState } from 'react';
import type { GameReceipt } from './game-receipt';
import GameArt from './GameArt';
import {
  activeFrameDelta, createOrchard, createPuzzle, ORCHARD_DURATION, orchardClaim,
  orchardScore, puzzleMove, puzzleSolved, RHYTHM_BEATS, RHYTHM_DURATION, rhythmHit, rhythmScore,
} from './extra-game-rules';
import type { BeatJudgment, OrchardFruit } from './extra-game-rules';
import './MoreGames.css';
import { playGameSound } from '../pet-audio';

export type ExtraGame = 'rhythm' | 'orchard' | 'puzzle';
type Props = { kind: ExtraGame; onComplete: (score: number) => GameReceipt | void; onClose: () => void; sound?: boolean };
type Phase = 'ready' | 'playing' | 'finished' | 'closed';
const titles: Record<ExtraGame, string> = { rhythm: '节奏拍拍乐', orchard: '草地采果', puzzle: '小屋拼拼乐' };
const instructions: Record<ExtraGame, string> = {
  rhythm: '果子到达圆圈时，点击拍一拍或按空格。',
  orchard: '点击草地上冒出的果子，看看能采到几个！',
  puzzle: '点击空格旁的图片，把小屋拼完整。',
};
const orchardImages = ['180027', '180028', '180030'] as const;

/** A keyed session prevents a parent changing the selected game from sharing a round. */
export default function MoreGames(props: Props) { return <GameSession key={props.kind} {...props}/>; }

function GameSession({ kind, onComplete, onClose, sound=false }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [judgments, setJudgments] = useState<BeatJudgment[]>(() => RHYTHM_BEATS.map(() => null));
  const [fruits, setFruits] = useState<OrchardFruit[]>([]);
  const [claimed, setClaimed] = useState(new Set<number>());
  const [board, setBoard] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [feedback, setFeedback] = useState({ message: '', at: 0 });
  const [receipt, setReceipt] = useState<GameReceipt | null>(null);
  const [score, setScore] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const firstButton = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onComplete, onClose }); callbacks.current = { onComplete, onClose };
  const elapsedRef = useRef(0);
  const lastFrame = useRef<number | null>(null);
  const judgmentsRef = useRef(judgments);
  const fruitsRef = useRef(fruits);
  const claimedRef = useRef(claimed);
  const boardRef = useRef(board);
  const lastTap = useRef(-Infinity);
  const completed = useRef(false);
  const lastWarning=useRef(4);
  const manualPause = useRef(false);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const pausedRef = useRef(paused || hidden); pausedRef.current = paused || hidden;
  const keyboardActions = useRef({ tap: () => {}, move: (_index: number) => {}, close: () => {} });

  function close() {
    if (phaseRef.current === 'closed') return;
    completed.current = true; phaseRef.current = 'closed'; setPhase('closed'); callbacks.current.onClose();
  }
  function finish(finalScore: number) {
    if (completed.current || phaseRef.current !== 'playing') return;
    completed.current = true; phaseRef.current = 'finished'; setScore(finalScore); setPhase('finished');
    setReceipt(callbacks.current.onComplete(finalScore) ?? null);
  }
  function start() {
    lastWarning.current=4;playGameSound('start',sound);
    elapsedRef.current = 0; lastFrame.current = null; setElapsed(0); manualPause.current = false; setPaused(false);
    completed.current = false; setReceipt(null); setFeedback({ message: '', at: 0 });
    judgmentsRef.current = RHYTHM_BEATS.map(() => null); setJudgments(judgmentsRef.current); lastTap.current = -Infinity;
    fruitsRef.current = createOrchard(); setFruits(fruitsRef.current);
    claimedRef.current = new Set(); setClaimed(claimedRef.current);
    boardRef.current = createPuzzle(); setBoard(boardRef.current); setMoves(0);
    phaseRef.current = 'playing'; setPhase('playing');
  }
  function tap() {
    if (phaseRef.current !== 'playing' || pausedRef.current) return;
    const hit = rhythmHit(elapsedRef.current, judgmentsRef.current, lastTap.current);
    lastTap.current = elapsedRef.current;
    if (!hit) { playGameSound('miss',sound);setFeedback({ message: '跟着果子的节奏来～', at: elapsedRef.current }); return; }
    playGameSound(hit.judgment==='perfect'?'perfect':'catch',sound);
    const next = [...judgmentsRef.current]; next[hit.index] = hit.judgment;
    judgmentsRef.current = next; setJudgments(next);
    setFeedback({ message: hit.judgment === 'perfect' ? '正好！' : '接上啦！', at: elapsedRef.current });
  }
  function pick(slot: number) {
    if (phaseRef.current !== 'playing' || pausedRef.current) return;
    const index = orchardClaim(fruitsRef.current, claimedRef.current, elapsedRef.current, slot);
    if (index < 0) return;
    playGameSound((claimedRef.current.size+1)%3===0?'combo':'catch',sound);
    const next = new Set(claimedRef.current); next.add(index); claimedRef.current = next; setClaimed(next);
    setFeedback({ message: '+1 采到啦！', at: elapsedRef.current });
  }
  function move(index: number) {
    if (phaseRef.current !== 'playing' || pausedRef.current) return;
    const next = puzzleMove(boardRef.current, index);
    if (!next) return;
    if(!puzzleSolved(next))playGameSound('move',sound);
    boardRef.current = next; setBoard(next); setMoves(previous => previous + 1);
    if (puzzleSolved(next)) finish(10);
  }
  keyboardActions.current = { tap, move, close };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstButton.current?.focus();
    const visibility = () => { lastFrame.current = null; pausedRef.current = document.hidden || manualPause.current; setHidden(document.hidden); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); keyboardActions.current.close(); return; }
      if (event.key === 'Tab') {
        const items = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
      if (phaseRef.current !== 'playing' || pausedRef.current || event.repeat) return;
      if (kind === 'rhythm' && (event.code === 'Space' || event.key === ' ')) {
        // Handle once here; prevent the focused button from also receiving a synthetic click.
        event.preventDefault(); keyboardActions.current.tap();
      }
      if (kind === 'puzzle' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const blank = boardRef.current.indexOf(0);
        const candidate = blank + ({ ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 }[event.key] ?? 0);
        if ((event.key === 'ArrowLeft' && blank % 3 === 0) || (event.key === 'ArrowRight' && blank % 3 === 2)) return;
        keyboardActions.current.move(candidate);
      }
    };
    document.addEventListener('keydown', keyboard); document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('keydown', keyboard); document.removeEventListener('visibilitychange', visibility); previous?.focus(); };
    // pausedRef is updated synchronously when pausing; this session owns one listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let frame = 0;
    function tick(now: number) {
      if (phaseRef.current !== 'playing') return;
      const delta = activeFrameDelta(now, lastFrame.current, pausedRef.current || document.hidden);
      lastFrame.current = now;
      elapsedRef.current += delta;
      setElapsed(elapsedRef.current);
      const remaining=Math.ceil(((kind==='rhythm'?RHYTHM_DURATION:ORCHARD_DURATION)-elapsedRef.current)/1000);
      if(kind!=='puzzle'&&remaining>0&&remaining<=3&&remaining<lastWarning.current){lastWarning.current=remaining;playGameSound('countdown',sound)}
      if (kind === 'rhythm') {
        let changed = false;
        const next = judgmentsRef.current.map((judgment, index) => {
          if (judgment === null && elapsedRef.current > RHYTHM_BEATS[index] + 180) { changed = true; return 'miss' as const; }
          return judgment;
        });
        if (changed) { playGameSound('miss',sound);judgmentsRef.current = next; setJudgments(next); }
        if (elapsedRef.current >= RHYTHM_DURATION) { finish(rhythmScore(judgmentsRef.current)); return; }
      } else if (kind === 'orchard' && elapsedRef.current >= ORCHARD_DURATION) {
        finish(orchardScore(claimedRef.current.size)); return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); lastFrame.current = null; };
    // All changing game values live in session refs so no animation clock restarts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, kind,sound]);

  function togglePause() {
    const next = !paused;playGameSound(next?'pause':'resume',sound); manualPause.current = next; pausedRef.current = next || hidden; lastFrame.current = null; setPaused(next);
  }

  if (phase === 'closed') return null;
  const duration = kind === 'rhythm' ? RHYTHM_DURATION : ORCHARD_DURATION;
  const currentFruit = fruits.findIndex(fruit => elapsed >= fruit.start && elapsed < fruit.end);
  const hits = judgments.filter(judgment => judgment === 'perfect' || judgment === 'good').length;
  const playing = phase === 'playing';
  const stopped = paused || hidden;

  return <div className="extra-game-backdrop"><div ref={dialog} className="extra-game-dialog" role="dialog" aria-modal="true" aria-labelledby="extra-game-title" data-testid={`extra-game-${kind}`} data-phase={phase} data-elapsed={Math.floor(elapsed)}>
    <header className="extra-game-heading"><h2 id="extra-game-title">{titles[kind]}</h2><button className="extra-game-close" aria-label={playing ? '退出游戏，本局不领取奖励' : '关闭游戏'} onClick={close}/></header>
    {phase === 'ready' && <>
      <div className={`extra-game-preview preview-${kind}`}>
        {kind === 'rhythm' ? <><GameArt kind="ball"/><span className="extra-game-musical">♪ ♫ ♪</span></> : kind === 'orchard' ? <>{orchardImages.map(item => <img className="raster-game-art" key={item} src={`./assets/original/items/${item}.png`} alt=""/>)}</> : <img src="./assets/original/scenes/ramu-home.png" alt="等待拼好的拉姆小屋"/>}
      </div>
      <p className="extra-game-instruction">{instructions[kind]}</p>
      <button ref={firstButton} className="extra-game-primary extra-game-start" data-testid="extra-game-start" onClick={start}>开始游戏{kind !== 'puzzle' && <span>{duration / 1000} 秒</span>}</button>
    </>}
    {playing && <>
      <div className="extra-game-scorebar">
        <strong data-testid="extra-game-score">{kind === 'puzzle' ? `${moves} 步` : kind === 'rhythm' ? `${hits} / 20` : `${claimed.size} / 15`}</strong>
        <span data-testid="extra-game-time">{kind === 'puzzle' ? `${Math.floor(elapsed / 1000)} 秒` : `${Math.max(0, Math.ceil((duration - elapsed) / 1000))} 秒`}</span>
        <button className="extra-game-secondary" onClick={togglePause}>{paused ? '继续' : '暂停'}</button>
      </div>
      <div className="extra-game-playfield">
        {kind === 'rhythm' && <div className="extra-game-rhythm">
          <div className="extra-game-track" aria-label="果子向左移动，到圆圈时拍一下">
            <div className="extra-game-hit-ring"/>
            {RHYTHM_BEATS.map((time, index) => {
              const distance = time - elapsed;
              if (distance > 1700 || distance < -450 || judgments[index] === 'perfect' || judgments[index] === 'good') return null;
              return <div className={`extra-game-note ${distance < -180 ? 'missed' : ''}`} key={index} style={{ left: `${26 + distance / 1700 * 70}%` }}><GameArt kind="apple"/></div>;
            })}
          </div>
          <button className="extra-game-tap" onClick={tap} disabled={stopped} data-testid="extra-game-tap">拍一拍<span>空格</span></button>
          <div className="extra-game-beats" aria-label={`已经过 ${judgments.filter(Boolean).length} 拍`}>{judgments.map((judgment, index) => <span key={index} className={judgment ?? ''}/>)}</div>
        </div>}
        {kind === 'orchard' && <div className="extra-game-orchard" data-testid="orchard-board">
          {Array.from({ length: 9 }, (_, slot) => {
            const active = currentFruit >= 0 && fruits[currentFruit].slot === slot && !claimed.has(currentFruit);
            return <button key={slot} className={`extra-game-grass ${active ? 'has-fruit' : ''}`} data-testid="orchard-slot" data-active={active} aria-label={active ? `采第 ${slot + 1} 格的果子` : `第 ${slot + 1} 块草地`} disabled={!active || stopped} onClick={() => pick(slot)}>{active ? <img className="raster-game-art" src={`./assets/original/items/${orchardImages[fruits[currentFruit].kind]}.png`} alt=""/> : <img src="./assets/original/ui/sprout.png" alt=""/>}</button>;
          })}
        </div>}
        {kind === 'puzzle' && <div className="extra-game-puzzle-wrap"><div className="extra-game-puzzle" data-testid="puzzle-board">
          {board.map((value, index) => <button key={index} className={`extra-game-piece ${value === 0 ? 'blank' : ''}`} style={value ? { backgroundPosition: `${(value - 1) % 3 * 50}% ${Math.floor((value - 1) / 3) * 50}%` } : undefined} onClick={() => move(index)} disabled={value === 0 || stopped} aria-label={value ? `移动拼图 ${value}` : '空格'} data-value={value}><span>{value || ''}</span></button>)}
        </div><img className="extra-game-puzzle-reference" src="./assets/original/scenes/ramu-home.png" alt="完整小屋参考图"/></div>}
        {stopped && <div className="extra-game-paused" role="status"><strong>歇一歇</strong><span>{hidden ? '回到窗口后继续' : '计时已暂停'}</span>{!hidden && <button className="extra-game-primary" onClick={togglePause}>继续游戏</button>}</div>}
      </div>
      <p className="extra-game-feedback" role="status">{elapsed - feedback.at < 750 && feedback.message ? feedback.message : kind === 'puzzle' ? '方向键也能移动空格' : kind === 'rhythm' ? '果子到圈里，拍！' : '找找下一个果子'}</p>
    </>}
    {phase === 'finished' && <div className="extra-game-result" data-testid="extra-game-result">
      <GameArt kind="trophy"/><h3>{kind === 'puzzle' ? '小屋拼好啦！' : '玩得真开心！'}</h3><strong className="extra-game-final-score">{score} 分</strong>
      {kind === 'puzzle' && <p>{moves} 步 · {Math.floor(elapsed / 1000)} 秒</p>}
      {receipt && <><div className="extra-game-rewards"><span><strong>+{receipt.coins}</strong> 摩尔豆</span><span><strong>+{receipt.food}</strong> 用品</span></div><p className="extra-game-receipt" role="status">{receipt.message}</p></>}
      <div className="extra-game-result-actions"><button className="extra-game-secondary" onClick={start}>再玩一次</button><button className="extra-game-primary" onClick={close}>{receipt?.ok === false ? '返回小屋' : '完成'}</button></div>
    </div>}
  </div></div>;
}

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { PetColor, Stage } from '../game';
import './FruitGame.css';
import GameArt from './GameArt';
import Ram from './Ram';

interface FruitGameProps {
  onComplete: (score: number) => void;
  onClose: () => void;
  color?: PetColor;
  stage?: Stage;
}

type Phase = 'ready' | 'playing' | 'finished';
type Berry = { id: number; x: number; y: number; speed: number; rotation: number };
type GameModel = { basket: number; berries: Berry[]; spawned: number; score: number };
type GameFrame = { basket: number; berries: Berry[]; score: number; seconds: number };

const GAME_SECONDS = 20;
const MAX_SCORE = 10;
const BASKET_Y = 83;
const SPAWN_POSITIONS = [24, 72, 42, 80, 19, 57, 35, 78, 26, 64];
const initialModel = (): GameModel => ({ basket: 50, berries: [], spawned: 0, score: 0 });
const initialFrame = (): GameFrame => ({ basket: 50, berries: [], score: 0, seconds: GAME_SECONDS });
const clampBasket = (position: number) => Math.min(89, Math.max(11, position));

function BerryIllustration({ className = '' }: { className?: string }) { return <GameArt kind="apple" className={className}/>; }

export default function FruitGame({ onComplete, onClose, color = 'red', stage = 1 }: FruitGameProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [frame, setFrame] = useState<GameFrame>(initialFrame);
  const model = useRef<GameModel>(initialModel());
  const dialogRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const heldKeys = useRef(new Set<string>());
  const awarded = useRef(false);
  const completeRef = useRef(onComplete);
  const closeRef = useRef(onClose);
  completeRef.current = onComplete;
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    startRef.current?.focus();
    const handleDocumentKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const clearKeys = () => heldKeys.current.clear();
    document.addEventListener('keydown', handleDocumentKey);
    window.addEventListener('blur', clearKeys);
    return () => {
      document.removeEventListener('keydown', handleDocumentKey);
      window.removeEventListener('blur', clearKeys);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (phase === 'finished') replayRef.current?.focus();
    if (phase !== 'playing') return;
    arenaRef.current?.focus();
    let animationId = 0;
    const startedAt = performance.now();
    let previousTime = startedAt;
    const animate = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      const delta = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;
      const current = model.current;
      if (elapsed >= GAME_SECONDS) {
        heldKeys.current.clear();
        const finalScore = Math.min(MAX_SCORE, Math.max(0, current.score));
        setFrame({ basket: current.basket, berries: [], score: finalScore, seconds: 0 });
        setPhase('finished');
        if (!awarded.current) {
          awarded.current = true;
          completeRef.current(finalScore);
        }
        return;
      }
      const direction = Number(heldKeys.current.has('ArrowRight')) - Number(heldKeys.current.has('ArrowLeft'));
      current.basket = clampBasket(current.basket + direction * delta * 66);
      if (current.spawned < MAX_SCORE && elapsed >= 0.45 + current.spawned * 1.7) {
        const id = current.spawned++;
        current.berries.push({ id, x: SPAWN_POSITIONS[id], y: -7, speed: 29 + (id % 3), rotation: (id % 2 ? 1 : -1) * 13 });
      }
      current.berries = current.berries.filter((berry) => {
        const lastY = berry.y;
        berry.y += berry.speed * delta;
        if (lastY < BASKET_Y && berry.y >= BASKET_Y && Math.abs(berry.x - current.basket) <= 11) {
          current.score = Math.min(MAX_SCORE, current.score + 1);
          return false;
        }
        return berry.y < 112;
      });
      setFrame({ basket: current.basket, berries: current.berries.map((berry) => ({ ...berry })), score: current.score, seconds: Math.ceil(GAME_SECONDS - elapsed) });
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [phase]);

  const startGame = () => {
    model.current = initialModel();
    awarded.current = false;
    heldKeys.current.clear();
    setFrame(initialFrame());
    setPhase('playing');
  };

  const moveBasket = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'playing') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width) model.current.basket = clampBasket(((event.clientX - bounds.left) / bounds.width) * 100);
  };

  const handleArenaKey = (event: KeyboardEvent<HTMLDivElement>, pressed: boolean) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (pressed) heldKeys.current.add(event.key);
    else heldKeys.current.delete(event.key);
  };

  return (
    <div className="fruit-backdrop">
      <div ref={dialogRef} className="fruit-dialog" role="dialog" aria-modal="true" aria-labelledby="fruit-title" aria-describedby="fruit-description">
        <div className="fruit-heading">
          <div><span className="fruit-eyebrow">拉姆游乐场</span><h2 id="fruit-title">拉姆接果子</h2></div>
          <button type="button" className="fruit-close" onClick={onClose} aria-label={phase === 'playing' ? '退出游戏，本局不领取奖励' : '关闭小游戏'}></button>
        </div>
        <p id="fruit-description" className="fruit-description">和拉姆一起，接住掉下来的可可果。</p>

        {phase === 'ready' && <>
          <div className="fruit-preview" aria-hidden="true">
            <BerryIllustration className="fruit-preview-berry fruit-preview-berry-one" />
            <BerryIllustration className="fruit-preview-berry fruit-preview-berry-two" />
            <BerryIllustration className="fruit-preview-berry fruit-preview-berry-three" />
            <div className="fruit-preview-basket"><Ram color={color} stage={stage} action="play" artStyle="classic" /></div>
            <span className="fruit-preview-label">拉姆准备好啦！</span>
          </div>
          <div className="fruit-instructions"><GameArt kind="apple" className="fruit-instruction-icon" /><div><strong>移动拉姆，接住落下的可可果</strong><p>移动鼠标、滑动屏幕，或按 <kbd>←</kbd> <kbd>→</kbd> 移动拉姆。每局 20 秒，共有 10 颗可可果。</p></div></div>
          <button ref={startRef} type="button" className="fruit-primary" onClick={startGame} data-testid="fruit-game-start">开始游戏<span>20 秒</span></button>
        </>}

        {phase === 'playing' && <>
          <div className="fruit-scoreboard">
            <span className={frame.seconds <= 5 ? 'fruit-timer fruit-timer-urgent' : 'fruit-timer'}><GameArt kind="clock" /><strong>{frame.seconds}</strong> 秒</span>
            <span className="fruit-score"><BerryIllustration /><strong data-testid="fruit-game-score">{frame.score}</strong><span>/ 10 颗</span></span>
          </div>
          <div className="fruit-time-track" role="progressbar" aria-label="剩余游戏时间" aria-valuemin={0} aria-valuemax={20} aria-valuenow={frame.seconds}><span style={{ width: `${frame.seconds / GAME_SECONDS * 100}%` }} /></div>
          <div ref={arenaRef} className="fruit-arena" data-testid="game-arena" tabIndex={0} role="application" aria-label="接可可果场地，使用左右方向键移动拉姆，按 Escape 退出游戏" onPointerMove={moveBasket} onPointerDown={(event) => { event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); moveBasket(event); }} onKeyDown={(event) => handleArenaKey(event, true)} onKeyUp={(event) => handleArenaKey(event, false)} onBlur={() => heldKeys.current.clear()}>
            {frame.berries.map((berry) => <div key={berry.id} className="fruit-falling-berry" style={{ left: `${berry.x}%`, top: `${berry.y}%`, transform: `translate(-50%, -50%) rotate(${berry.rotation}deg)` }}><BerryIllustration /></div>)}
            <div className="fruit-basket" data-testid="fruit-game-basket" style={{ left: `${frame.basket}%` }}><Ram color={color} stage={stage} action="play" artStyle="classic" /></div>
          </div>
          <p className="fruit-controls">移动鼠标 / 滑动屏幕 <span>或</span> <kbd>←</kbd><kbd>→</kbd></p>
          <p className="fruit-exit-hint">完成整局即可领奖，中途退出不获得奖励</p>
        </>}

        {phase === 'finished' && <div className="fruit-result" data-testid="fruit-game-result">
          <div className="fruit-trophy"><GameArt kind="trophy"/></div>
          <h3>{frame.score >= 7 ? '拉姆接到了好多果子！' : frame.score > 0 ? '可可果收好啦！' : '练习完成，下次会更棒！'}</h3>
          <p>你和拉姆一起接住了 <strong>{frame.score}</strong> 颗可可果</p>
          <div className="fruit-rewards"><div><strong>+{4 + frame.score * 2}</strong><span>摩尔豆</span></div><div><GameArt kind={frame.score >= 8 ? 'juice' : frame.score >= 5 ? 'biscuit' : 'apple'} /><strong>+1</strong><span>{frame.score >= 8 ? '浆果果汁' : frame.score >= 5 ? '熊熊饼干' : '可可果'}</span></div><div><img className="fruit-growth-icon" src="./assets/original/ui/sprout.png" alt="" /><strong>+{3 + frame.score}</strong><span>成长值</span></div></div>
          <p className="fruit-reward-saved">奖励已放进你的小背包</p>
          <div className="fruit-result-actions"><button ref={replayRef} type="button" className="fruit-secondary" onClick={startGame}>再来一局</button><button type="button" className="fruit-primary" onClick={onClose}>收好奖励</button></div>
        </div>}

        <p className="fruit-reward-note">每颗可可果 +2 摩尔豆、+1 成长<br />完成另得 4 摩尔豆、3 成长和 1 份食物</p>
      </div>
    </div>
  );
}

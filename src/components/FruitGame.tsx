import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { PetColor, Stage } from '../game';
import './FruitGame.css';
import GameArt from './GameArt';
import Ram from './Ram';
import type { GameReceipt } from './game-receipt';
import { advanceFruitGame, initialFruitModel, getCatchBand, FRUIT_ARENA, FRUIT_SIZE, PET_WIDTH, PET_HEIGHT, GAME_SECONDS } from './fruit-physics';
import type { FruitModel } from './fruit-physics';

interface FruitGameProps {
  onComplete: (score: number) => GameReceipt | void;
  onClose: () => void;
  color?: PetColor;
  stage?: Stage;
}

type Phase = 'ready' | 'playing' | 'finished';
function BerryIllustration({ className = '' }: { className?: string }) { return <GameArt kind="apple" className={className}/>; }

export default function FruitGame({ onComplete, onClose, color = 'red', stage = 1 }: FruitGameProps) {
  const [receipt, setReceipt] = useState<GameReceipt | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [frame, setFrame] = useState<FruitModel>(initialFruitModel);
  const model = useRef<FruitModel>(initialFruitModel());
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
    let previousTime = 0;
    const animate = (now: number) => {
      if (document.hidden) { previousTime = 0; animationId = requestAnimationFrame(animate); return; }
      const delta = previousTime ? (now - previousTime) / 1000 : 0;
      previousTime = now;
      const direction = Number(heldKeys.current.has('ArrowRight')) - Number(heldKeys.current.has('ArrowLeft'));
      const next = advanceFruitGame(model.current, delta, direction, stage);
      model.current = next; setFrame(next);
      if (next.elapsed >= GAME_SECONDS) {
        heldKeys.current.clear(); setPhase('finished');
        if (!awarded.current) { awarded.current = true; setReceipt(completeRef.current(next.score) ?? null); }
        return;
      }
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [phase, stage]);

  const startGame = () => {
    if (stage === 0) return;
    model.current = initialFruitModel(); awarded.current = false; heldKeys.current.clear();
    setFrame(initialFruitModel()); setReceipt(null); setPhase('playing');
  };
  const moveBasket = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'playing' || stage === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width) model.current.target = ((event.clientX - bounds.left) / bounds.width) * FRUIT_ARENA.width;
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
            <div className="fruit-preview-basket"><Ram color={color} stage={stage} action="still" /></div>
            <span className="fruit-preview-label">{stage === 0 ? '长大离开花盆后再来接果子' : '碰到头顶接取线才算接住'}</span>
          </div>
          <div className="fruit-instructions"><GameArt kind="apple" className="fruit-instruction-icon" /><div><strong>移动拉姆，让果子落到头顶</strong><p>移动鼠标、滑动屏幕，或按 <kbd>←</kbd> <kbd>→</kbd> 移动拉姆。每局 20 秒，共有 10 颗可可果。</p></div></div>
          <button ref={startRef} type="button" className="fruit-primary" disabled={stage === 0} onClick={startGame} data-testid="fruit-game-start">开始游戏<span>20 秒</span></button>
        </>}

        {phase === 'playing' && <>
          <div className="fruit-scoreboard">
            <span className={Math.max(0, Math.ceil(GAME_SECONDS - frame.elapsed)) <= 5 ? 'fruit-timer fruit-timer-urgent' : 'fruit-timer'}><GameArt kind="clock" /><strong>{Math.max(0, Math.ceil(GAME_SECONDS - frame.elapsed))}</strong> 秒</span>
            <span className="fruit-score"><BerryIllustration /><strong data-testid="fruit-game-score">{frame.score}</strong><span>/ 10 颗</span></span>
          </div>
          <div className="fruit-time-track" role="progressbar" aria-label="剩余游戏时间" aria-valuemin={0} aria-valuemax={20} aria-valuenow={Math.max(0, Math.ceil(GAME_SECONDS - frame.elapsed))}><span style={{ width: `${Math.max(0, Math.ceil(GAME_SECONDS - frame.elapsed)) / GAME_SECONDS * 100}%` }} /></div>
          <div ref={arenaRef} className="fruit-arena" data-testid="game-arena" tabIndex={0} role="application" aria-label="接可可果场地，使用左右方向键移动拉姆，按 Escape 退出游戏" onPointerMove={moveBasket} onPointerDown={(event) => { event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); moveBasket(event); }} onKeyDown={(event) => handleArenaKey(event, true)} onKeyUp={(event) => handleArenaKey(event, false)} onBlur={() => heldKeys.current.clear()}>
            {frame.berries.map((berry) => <div key={berry.id} className="fruit-falling-berry" style={{ left: `${berry.x / FRUIT_ARENA.width * 100}%`, top: `${berry.y / FRUIT_ARENA.height * 100}%`, width: `${FRUIT_SIZE.width / FRUIT_ARENA.width * 100}%`, height: `${FRUIT_SIZE.height / FRUIT_ARENA.height * 100}%`, transform: `translate(-50%, -50%) rotate(${berry.rotation}deg)` }}><BerryIllustration /></div>)}
            <div className="fruit-catch-band" data-testid="fruit-catch-band" style={{ left: `${getCatchBand(stage, frame.basket).x / 4}%`, top: `${getCatchBand(stage, frame.basket).y / 3}%`, width: `${getCatchBand(stage, frame.basket).halfWidth * 2 / 4}%` }}/>
            <div className="fruit-basket" data-testid="fruit-game-basket" style={{ left: `${frame.basket / 4}%`, top: `${getCatchBand(stage, frame.basket).spriteTop / 3}%`, width: `${PET_WIDTH / 4}%`, height: `${PET_HEIGHT / 3}%` }}><Ram color={color} stage={stage} action={frame.elapsed - frame.lastCatchAt < .249 ? 'catch' : 'still'} actionId={frame.score}/></div>
            {frame.feedback.map(effect => <div key={effect.id} className={`fruit-feedback ${effect.kind}`} data-testid={`fruit-${effect.kind}`} style={{ left: `${effect.x / 4}%`, top: `${effect.y / 3}%` }}><span>{effect.kind === 'caught' ? '+1 可可果' : '没接住'}</span>{effect.kind === 'caught' && <BerryIllustration/>}</div>)}
          </div>
          <p className="fruit-controls">移动鼠标 / 滑动屏幕 <span>或</span> <kbd>←</kbd><kbd>→</kbd></p>
          <p className="fruit-exit-hint">完成整局即可领奖，中途退出不获得奖励</p>
        </>}

        {phase === 'finished' && <div className="fruit-result" data-testid="fruit-game-result">
          <div className="fruit-trophy"><GameArt kind="trophy"/></div>
          <h3>{frame.score >= 7 ? '拉姆接到了好多果子！' : frame.score > 0 ? '可可果收好啦！' : '练习完成，下次会更棒！'}</h3>
          <p>本局接取计分：<strong>{frame.score}</strong> / 10 颗</p>
          <div className="fruit-rewards"><div><strong>+{receipt?.coins ?? (4 + frame.score * 2)}</strong><span>摩尔豆</span></div><div><GameArt kind={frame.score >= 8 ? 'juice' : frame.score >= 5 ? 'biscuit' : 'apple'} /><strong>+{receipt?.food ?? 1}</strong><span>{frame.score >= 8 ? '浆果果汁' : frame.score >= 5 ? '熊熊饼干' : '可可果'}</span></div><div><img className="fruit-growth-icon" src="./assets/original/ui/sprout.png" alt="" /><strong>+{receipt?.growth ?? (3 + frame.score)}</strong><span>成长值</span></div></div>
          <p className="fruit-reward-saved">{receipt?.ok === false ? receipt.message : `${receipt?.message ?? '以上奖励已入背包'} 接到的果子用于本局计分。`}</p>
          <div className="fruit-result-actions"><button ref={replayRef} type="button" className="fruit-secondary" onClick={startGame}>再来一局</button><button type="button" className="fruit-primary" onClick={onClose}>{receipt?.ok === false ? '返回' : '收好奖励'}</button></div>
        </div>}

        <p className="fruit-reward-note">每次成功接取折算 +2 摩尔豆、+1 成长<br />完成另得 4 摩尔豆、3 成长和 1 份食物（不是每颗入背包）</p>
      </div>
    </div>
  );
}

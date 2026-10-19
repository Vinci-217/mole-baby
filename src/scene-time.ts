import { useEffect, useState } from 'react';

export type ScenePhase = 'morning' | 'noon' | 'dusk' | 'night';
export type SceneTimeMode = 'auto' | ScenePhase;
export const SCENE_PHASES: readonly { id: ScenePhase; label: string }[] = [
  { id: 'morning', label: '早晨' }, { id: 'noon', label: '白天' },
  { id: 'dusk', label: '傍晚' }, { id: 'night', label: '夜晚' },
];

/** Intentionally uses the user's local clock, never a server/UTC clock. */
export function scenePhaseAt(date: Date): ScenePhase {
  const hour = date.getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'noon';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export function sceneSheetPosition(phase: ScenePhase) {
  return {
    x: phase === 'noon' || phase === 'night' ? '-75%' : '-25%',
    y: phase === 'dusk' || phase === 'night' ? '-75%' : '-25%',
  };
}

export function useLocalScenePhase() {
  const [phase, setPhase] = useState(() => scenePhaseAt(new Date()));
  useEffect(() => {
    const refresh = () => setPhase(scenePhaseAt(new Date()));
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return phase;
}

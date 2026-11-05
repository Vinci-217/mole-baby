import type { WorkerPose } from './restaurant-painter';

export const DESKTOP_WORK_BOUNDS = { x: -96, y: 5, width: 352, height: 200 };
export const DESKTOP_WORK_CYCLE = 9000;
export function desktopRestaurantFrame(elapsedMs: number) {
  const t = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) % DESKTOP_WORK_CYCLE;
  const left = { x: 119, y: 144 }, right = { x: 244, y: 144 };
  let phase: 'collect' | 'deliver' | 'serve' | 'return' | 'ready' = 'ready';
  let worker: WorkerPose = { position: left, from: left, to: right, moving: false, carrying: false };
  if (t >= 700 && t < 1300) { phase = 'collect'; worker = { ...worker, carrying: t >= 1000 }; }
  else if (t >= 1300 && t < 4000) { phase = 'deliver'; worker = { ...worker, position: { x: left.x + (right.x - left.x) * (t - 1300) / 2700, y: left.y }, moving: true, carrying: true }; }
  else if (t >= 4000 && t < 4800) { phase = 'serve'; worker = { ...worker, position: right, carrying: t < 4400 }; }
  else if (t >= 4800 && t < 7800) { phase = 'return'; worker = { position: { x: right.x + (left.x - right.x) * (t - 4800) / 3000, y: right.y }, from: right, to: left, moving: true, carrying: false }; }
  return { phase, worker, dishVisible: t >= 4400 && t < 8500, dishOpacity: t < 7900 ? 1 : Math.max(0, (8500 - t) / 600) };
}

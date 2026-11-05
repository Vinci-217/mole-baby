import layouts from './restaurant-layouts.json';

export const RESTAURANT_BACKGROUNDS = Object.keys(layouts);
export const WORK_CYCLE_MS = 26_000;
export type WorkPhase = 'ready' | 'enter' | 'wait' | 'fetch' | 'collect' | 'deliver' | 'serve' | 'eat' | 'leave';
export type Point = { x: number; y: number };
type Layout = Record<string, Point>;
export const WORK_PHASE_LABELS: Record<WorkPhase, string> = {
  ready: '拉姆正在迎接下一位客人', enter: '客人进店啦', wait: '客人坐下点餐',
  fetch: '拉姆去取餐', collect: '取好餐，准备出发', deliver: '拉姆正在端盘送餐',
  serve: '热腾腾的菜上桌啦', eat: '客人正在享用美食', leave: '吃饱啦，欢迎下次再来',
};
const HOME = { x: 500, y: 475 };
const DOOR = { x: 480, y: 625 };

/** Follow a route at a constant speed, including its corners. */
function along(route: Point[], progress: number) {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
  let remaining = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const from = route[i], to = route[i + 1], t = lengths[i] ? remaining / lengths[i] : 1;
      return { position: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, from, to };
    }
    remaining -= lengths[i];
  }
  return { position: route[0], from: route[0], to: route[0] };
}

/** Presentation only: no wallet, inventory, clocks or player-save mutations. */
export function restaurantWorkFrame(roomId: string, elapsedMs: number) {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const t = elapsed % WORK_CYCLE_MS, cycle = Math.floor(elapsed / WORK_CYCLE_MS);
  const layout = (layouts as Record<string, Layout>)[roomId] ?? (layouts as Record<string, Layout>)[RESTAURANT_BACKGROUNDS[0]];
  const seats = Object.keys(layout).filter(k => /^tablePoint\d+$/.test(k)).sort();
  const seatKey = seats[cycle % seats.length], suffix = seatKey.replace('tablePoint', '');
  const seat = layout[seatKey], service = layout[`point${suffix}`] ?? seat;
  const counter = layout.movePoint51 ?? { x: 430, y: 395 };
  const table = layout[`table${suffix}`] ?? seat;
  // Rear counters lead around the back of the tables; front counters use the aisle.
  const waypoints = counter.y < 330
    ? [counter, { x: service.x, y: Math.min(counter.y, service.y) - 30 }, service]
    : [counter, { x: counter.x, y: Math.max(counter.y, service.y) + 30 }, { x: service.x, y: Math.max(counter.y, service.y) + 30 }, service];
  const arrival = [DOOR, HOME, service, seat];
  let phase: WorkPhase = 'ready';
  if (t >= 1000 && t < 4500) phase = 'enter';
  else if (t >= 4500 && t < 6000) phase = 'wait';
  else if (t >= 6000 && t < 9000) phase = 'fetch';
  else if (t >= 9000 && t < 10000) phase = 'collect';
  else if (t >= 10000 && t < 13500) phase = 'deliver';
  else if (t >= 13500 && t < 14500) phase = 'serve';
  else if (t >= 14500 && t < 20500) phase = 'eat';
  else if (t >= 20500 && t < 25000) phase = 'leave';
  let worker = { ...along([HOME, HOME], 0), moving: false, carrying: false };
  if (phase === 'fetch') worker = { ...along([HOME, counter], (t - 6000) / 3000), moving: true, carrying: false };
  else if (phase === 'collect') worker = { ...along([counter, counter], 0), moving: false, carrying: t >= 9500 };
  else if (phase === 'deliver') worker = { ...along(waypoints, (t - 10000) / 3500), moving: true, carrying: true };
  else if (phase === 'serve') worker = { ...along([service, service], 0), moving: false, carrying: t < 14000 };
  else if (phase === 'eat' && t < 17500) worker = { ...along([...waypoints].reverse().concat([HOME]), (t - 14500) / 3000), moving: true, carrying: false };
  const guest = phase === 'ready' ? null : phase === 'enter'
    ? along(arrival, (t - 1000) / 3500).position
    : phase === 'leave' ? along([...arrival].reverse(), (t - 20500) / 4500).position : seat;
  return { phase, cycle, worker, guest, eating: phase === 'eat', guestMoving: phase === 'enter' || phase === 'leave',
    table, dishVisible: t >= 14000 && t < 20500, dishOpacity: t < 19500 ? 1 : Math.max(0, (20500 - t) / 1000) };
}

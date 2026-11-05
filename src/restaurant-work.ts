import layouts from './restaurant-layouts.json';

export const RESTAURANT_BACKGROUNDS = Object.keys(layouts);
export const WORK_CYCLE_MS = 26_000;
export type WorkPhase = 'ready' | 'enter' | 'wait' | 'fetch' | 'collect' | 'deliver' | 'serve' | 'eat' | 'leave';
export type Point = { x: number; y: number };
type Layout = Record<string, Point>;
const routeCache = new Map<string, Point[]>();

/** Keep feet in the aisles. Inflate tabletops so a character does not cut through them. */
function aisleRoute(layout: Layout, from: Point, to: Point, key: string): Point[] {
  const cached = routeCache.get(key); if (cached) return cached;
  const step = 10, width = 97, height = 57;
  const tables = Object.entries(layout).filter(([name]) => /^table\d+$/.test(name)).map(([, p]) => p);
  const blocked = (p: Point) => Math.hypot(p.x - from.x, p.y - from.y) > 21 && Math.hypot(p.x - to.x, p.y - to.y) > 21 && tables.some(table => ((p.x - table.x) / 52) ** 2 + ((p.y - table.y - 12) / 42) ** 2 < 1);
  const start = {x: Math.round(from.x / step), y: Math.round(from.y / step)}, goal = {x: Math.round(to.x / step), y: Math.round(to.y / step)};
  const index = (p: Point) => p.y * width + p.x;
  const queue: {x:number;y:number;cost:number;estimate:number}[] = [{...start,cost:0,estimate:0}];
  const costs = new Map<number,number>([[index(start),0]]), parents = new Map<number,number>();
  let found = false;
  while (queue.length) {
    queue.sort((a,b)=>b.estimate-a.estimate); const p = queue.pop()!;
    if (p.x === goal.x && p.y === goal.y) { found = true; break; }
    if (p.cost > costs.get(index(p))!) continue;
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const next={x:p.x+dx,y:p.y+dy}; if (next.x<18||next.x>=width-15||next.y<23||next.y>=height-3) continue;
      if (blocked({x:next.x*step,y:next.y*step}) || dx && dy && (blocked({x:p.x*step+dx*step,y:p.y*step}) || blocked({x:p.x*step,y:p.y*step+dy*step}))) continue;
      const cost=p.cost+Math.hypot(dx,dy); if(cost >= (costs.get(index(next))??Infinity)) continue;
      costs.set(index(next),cost);parents.set(index(next),index(p));queue.push({...next,cost,estimate:cost+Math.hypot(goal.x-next.x,goal.y-next.y)});
    }
  }
  let route: Point[] = [from,to];
  if (found) {
    const points: Point[]=[];let cursor=index(goal);
    while(cursor!==index(start)){points.push({x:cursor%width*step,y:Math.floor(cursor/width)*step});cursor=parents.get(cursor)!;}
    points.reverse();route=[from,...points,to];
    const clear=(a:Point,b:Point)=>{const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5);for(let i=1;i<n;i++)if(blocked({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
    const simple=[from];let i=0;while(i<route.length-1){let end=route.length-1;while(end>i+1&&!clear(route[i],route[end]))end--;simple.push(route[end]);i=end;}route=simple;
  }
  routeCache.set(key,route);return route;
}
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
  const fetchRoute = aisleRoute(layout, HOME, counter, `${roomId}:fetch`);
  const waypoints = aisleRoute(layout, counter, service, `${roomId}:${suffix}:serve`);
  const arrival = [DOOR,...aisleRoute(layout, HOME, seat, `${roomId}:${suffix}:guest`)];
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
  if (phase === 'fetch') worker = { ...along(fetchRoute, (t - 6000) / 3000), moving: true, carrying: false };
  else if (phase === 'collect') worker = { ...along([counter, counter], 0), moving: false, carrying: t >= 9500 };
  else if (phase === 'deliver') worker = { ...along(waypoints, (t - 10000) / 3500), moving: true, carrying: true };
  else if (phase === 'serve') worker = { ...along([service, service], 0), moving: false, carrying: t < 14000 };
  else if (phase === 'eat' && t < 17500) worker = { ...along(aisleRoute(layout,service,HOME,`${roomId}:${suffix}:return`), (t - 14500) / 3000), moving: true, carrying: false };
  const guestPose = phase === 'enter' ? along(arrival,(t-1000)/3500) : phase === 'leave' ? along([...arrival].reverse(),(t-20500)/4500) : {position:seat,from:seat,to:table};
  const guest = phase === 'ready' ? null : guestPose.position;
  return { phase, cycle, worker, guest, eating: phase === 'eat', guestMoving: phase === 'enter' || phase === 'leave',
    guestDirection:guestPose.to.x-guestPose.from.x||(phase==='leave'?HOME.x-seat.x:seat.x-HOME.x), table, dishVisible: t >= 14000 && t < 20500, dishOpacity: t < 19500 ? 1 : Math.max(0, (20500 - t) / 1000) };
}

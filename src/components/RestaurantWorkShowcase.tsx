import { useEffect, useRef, useState } from 'react';
import { Images, X } from 'lucide-react';
import type { GameState, PetColor } from '../game';
import { petColorOffsets } from '../pet-color';
import { restaurantWorkFrame, RESTAURANT_BACKGROUNDS, WORK_PHASE_LABELS, type WorkPhase } from '../restaurant-work';
import workerArt from '../restaurant-worker-art.json';
import './RestaurantWorkShowcase.css';

const ASSET = './assets/original/restaurant/';
const BACKGROUND_KEY = 'ramu-restaurant-background-v1';
const GUEST_COLORS = ['pink', 'yellow', 'blue', 'red'];

async function loadImage(src: string) {
  const img = new Image();
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error(src)); img.src = src; });
  return img;
}

/** Only tint the cyan body below the uniform; keep eyes, red hat and tray intact. */
function workerPalette(img: HTMLImageElement, color: PetColor): CanvasImageSource {
  if (color === 'blue') return img;
  const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), p = pixels.data;
  const offsets = petColorOffsets(color), blue = petColorOffsets('blue');
  for (let y = 128; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    if (p[i + 3] && p[i + 2] - p[i] > 40 && p[i + 1] - p[i] > 25) {
      for (let channel = 0; channel < 3; channel++) p[i + channel] = Math.max(0, Math.min(255, p[i + channel] + offsets[channel] - blue[channel]));
    }
  }
  ctx.putImageData(pixels, 0, 0); return canvas;
}

function initialBackground(pet: GameState) {
  let id = String(pet.restaurant?.interior ?? RESTAURANT_BACKGROUNDS[0]);
  try { id = localStorage.getItem(BACKGROUND_KEY) ?? id; } catch { /* A session can still switch backgrounds when storage is unavailable. */ }
  return RESTAURANT_BACKGROUNDS.includes(id) ? id : RESTAURANT_BACKGROUNDS[0];
}

export default function RestaurantWorkShowcase({ pet, onClose }: { pet: GameState; onClose: () => void }) {
  const root = useRef<HTMLElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [roomId, setRoomId] = useState(() => initialBackground(pet));
  const [phase, setPhase] = useState<WorkPhase>('ready');
  const [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [online, setOnline] = useState(navigator.onLine !== false);
  const latest = useRef({ roomId, onClose }); latest.current = { roomId, onClose };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); latest.current.onClose(); }
      if (e.key === 'Tab') {
        const buttons = root.current?.querySelectorAll<HTMLButtonElement>('button'); if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus(); };
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    let raf = 0, disposed = false, elapsed = 0, last = 0, previousRoom = latest.current.roomId;
    let currentPhase: WorkPhase = 'ready', nativeVisible = true;
    const rooms = new Map<string, HTMLImageElement>();
    const neededRooms = new Set<string>();
    const loadRoom = (id: string) => {
      if (neededRooms.has(id)) return;
      neededRooms.add(id);
      void loadImage(`${ASSET}rooms/${id}.webp`).then(img => {
        if (!disposed) { rooms.set(id, img); if (latest.current.roomId === id) setLoading(false); }
      }).catch(() => { if (!disposed) { neededRooms.delete(id); if (latest.current.roomId === id) { setLoading(false); setError(true); } } });
    };
    const connectivity = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
    const unsubscribe = window.desktop?.onStateChanged(state => { nativeVisible = state.windowVisible !== false && !state.petMode; });
    const load = async () => {
      const keys = Object.keys(workerArt);
      const [workers, guests, dishes, background] = await Promise.all([
        Promise.all(keys.map(async key => [key, workerPalette(await loadImage(`${ASSET}workers/${key}.webp`), pet.color)] as const)),
        Promise.all(GUEST_COLORS.map(color => loadImage(`${ASSET}guests/${color}.webp`))),
        Promise.all([1340001, 1340002, 1340003].map(id => loadImage(`${ASSET}dishes/${id}.webp`))),
        loadImage(`${ASSET}rooms/${previousRoom}.webp`),
      ]);
      if (disposed) return;
      const workerImages = Object.fromEntries(workers);
      rooms.set(previousRoom, background); neededRooms.add(previousRoom); setLoading(false);
      const paint = (now: number) => {
        if (disposed) return;
        const id = latest.current.roomId;
        if (id !== previousRoom) { previousRoom = id; elapsed = 0; setError(false); setLoading(!rooms.has(id)); loadRoom(id); }
        const ready = rooms.has(id);
        const active = !document.hidden && nativeVisible && navigator.onLine !== false && ready;
        if (last && active) elapsed += Math.min(100, now - last);
        last = now;
        const frame = restaurantWorkFrame(id, elapsed);
        if (frame.phase !== currentPhase) { currentPhase = frame.phase; setPhase(frame.phase); }
        const element = canvas.current;
        if (element) { element.dataset.phase = frame.phase; element.dataset.cycle = String(frame.cycle); element.dataset.background = id; element.dataset.paused = String(!active); element.dataset.loadedColor = pet.color; }
        ctx.clearRect(0, 0, 960, 560);
        const room = rooms.get(id);
        if (room) ctx.drawImage(room, 0, 0, 960, 560);
        const guestImage = guests[frame.cycle % guests.length];
        if (frame.guest) {
          const guestFrame = frame.eating ? Math.floor(elapsed * 24 / 1000) % 16 : frame.guestMoving ? Math.floor(elapsed * 12 / 1000) % 6 : 0;
          ctx.save(); ctx.translate(frame.guest.x, frame.guest.y);
          if (frame.guest.x > frame.table.x) ctx.scale(-1, 1);
          ctx.drawImage(guestImage, guestFrame * 100, 0, 100, 96, -42, -67, 84, 81); ctx.restore();
        }
        const dish = dishes[frame.cycle % dishes.length];
        if (frame.dishVisible) {
          const width = 40, height = width * dish.height / dish.width;
          ctx.save(); ctx.globalAlpha = frame.dishOpacity;
          ctx.drawImage(dish, frame.table.x - width / 2, frame.table.y - height - 2, width, height); ctx.restore();
        }
        const worker = frame.worker, dx = worker.to.x - worker.from.x, dy = worker.to.y - worker.from.y;
        const key = worker.carrying ? '1200042-rightdown' : worker.moving && dy < -15 ? '1200043-leftup' : dx < -10 ? '1200043-left' : '1200043-rightdown';
        const spec = (workerArt as Record<string, { moving: number[] }>)[key];
        const cell = worker.moving ? spec.moving[Math.floor(elapsed * 24 / 1000) % spec.moving.length] : 1;
        ctx.save(); ctx.translate(worker.position.x, worker.position.y);
        if (worker.carrying && dx < 0 || key === '1200043-leftup' && dx > 0) ctx.scale(-1, 1);
        ctx.drawImage(workerImages[key], cell * 200, 0, 200, 240, -110, -198, 220, 264); ctx.restore();
        raf = requestAnimationFrame(paint);
      };
      raf = requestAnimationFrame(paint);
    };
    void load().catch(() => { if (!disposed) { setLoading(false); setError(true); } });
    return () => { disposed = true; cancelAnimationFrame(raf); window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); unsubscribe?.(); };
  }, [pet.color]);

  const changeBackground = () => {
    const next = RESTAURANT_BACKGROUNDS[(RESTAURANT_BACKGROUNDS.indexOf(roomId) + 1) % RESTAURANT_BACKGROUNDS.length];
    setRoomId(next); try { localStorage.setItem(BACKGROUND_KEY, next); } catch { /* Cosmetic choice only. */ }
  };

  return <div className="restaurant-work-overlay">
    <section ref={root} className="restaurant-work-dialog" role="dialog" aria-modal="true" aria-label="拉姆餐厅" tabIndex={-1}>
      <header className="restaurant-work-header">
        <img src="./assets/original/restaurant/dock.png" alt="" />
        <div><h1>拉姆餐厅</h1><p>{pet.name}正在餐厅打工</p></div>
        <button className="restaurant-work-close" type="button" onClick={onClose} aria-label="离开餐厅"><X size={20} /></button>
      </header>
      <div className="restaurant-work-stage">
        <canvas ref={canvas} width={960} height={560} role="img" aria-label="拉姆取餐、端盘送餐，客人进店、用餐、离开的循环动画" />
        {(loading || error) && <div className="restaurant-work-loading" role="status">{error ? '餐厅素材暂时未能加载，请退出后重试。' : '拉姆正在系好围裙…'}</div>}
        <aside className="restaurant-work-controls" aria-label="餐厅背景控制">
          <button type="button" onClick={changeBackground} aria-label="切换餐厅背景" title={`切换背景 · ${RESTAURANT_BACKGROUNDS.indexOf(roomId) + 1}/${RESTAURANT_BACKGROUNDS.length}`}>
            <Images size={26} aria-hidden="true" /><span>换背景</span>
          </button>
        </aside>
      </div>
      <p className="restaurant-work-status" role="status"><span aria-hidden="true" />{online ? WORK_PHASE_LABELS[phase] : '网络已断开，打工暂停'}</p>
    </section>
  </div>;
}

import type { PetColor } from './game';
import { petColorOffsets } from './pet-color';
import workerArt from './restaurant-worker-art.json';
import type { Point } from './restaurant-work';

export const RESTAURANT_ASSET = './assets/original/restaurant/';
export const GUEST_COLORS = ['pink', 'yellow', 'blue', 'red'];
export async function loadRestaurantImage(src: string) {
  const img = new Image();
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error(src)); img.src = src; });
  return img;
}
/** Cyan body only: never recolour the uniform, eyes or tray. */
function workerPalette(img: HTMLImageElement, color: PetColor): CanvasImageSource {
  if (color === 'blue') return img;
  const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), p = pixels.data;
  const offsets = petColorOffsets(color), blue = petColorOffsets('blue');
  for (let y = 128; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4;
    if (p[i + 3] && p[i + 2] - p[i] > 40 && p[i + 1] - p[i] > 25) {
      for (let c = 0; c < 3; c++) p[i + c] = Math.max(0, Math.min(255, p[i + c] + offsets[c] - blue[c]));
    }
  }
  ctx.putImageData(pixels, 0, 0); return canvas;
}
export async function loadRestaurantWorkers(color: PetColor) {
  return Object.fromEntries(await Promise.all(Object.keys(workerArt).map(async key => [key, workerPalette(await loadRestaurantImage(`${RESTAURANT_ASSET}workers/${key}.webp`), color)] as const)));
}
export interface WorkerPose { position: Point; from: Point; to: Point; moving: boolean; carrying: boolean }
export function paintRestaurantWorker(ctx: CanvasRenderingContext2D, images: Record<string, CanvasImageSource>, worker: WorkerPose, elapsed: number, scale = 1.1) {
  const dx = worker.to.x - worker.from.x, dy = worker.to.y - worker.from.y;
  const key = worker.carrying ? '1200042-rightdown' : worker.moving && dy < -15 ? '1200043-leftup' : dx < -1 ? '1200043-left' : '1200043-rightdown';
  const spec = (workerArt as Record<string, {moving: number[]}>)[key];
  const cell = worker.moving ? spec.moving[Math.floor(elapsed * 24 / 1000) % spec.moving.length] : 1;
  ctx.save(); ctx.translate(worker.position.x, worker.position.y);
  if (worker.carrying && dx < 0 || key === '1200043-leftup' && dx > 0) ctx.scale(-1, 1);
  ctx.drawImage(images[key], cell * 200, 0, 200, 240, -100 * scale, -180 * scale, 200 * scale, 240 * scale); ctx.restore();
}

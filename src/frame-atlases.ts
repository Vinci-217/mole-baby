import {loadAnimationImage} from './animation-image';
import {tintAtlas} from './atlas-tint';
import {DecodedAssetCache} from './decoded-asset-cache';
import type {FrameAtlasPage} from './frame-clip-spec';
import {petColorOffsets, type PetColor} from './pet-color';

const pages = new DecodedAssetCache<HTMLCanvasElement>(
  () => (window.mobile ? 32 : 64) * 1024 ** 2,
  canvas => canvas.width * canvas.height * 4,
);

function preparePage(page: FrameAtlasPage, offsets: readonly number[], scale: number) {
  const key = JSON.stringify([page.neutral, page.mask, page.width, page.height, offsets, scale]);
  return pages.get(key, async () => {
    const width = page.width * scale;
    const height = page.height * scale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw new Error('无法打开原版动作图集');

    const neutral = await loadAnimationImage(page.neutral, page);
    context.drawImage(neutral, 0, 0, width, height);
    neutral.removeAttribute('src');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

    const mask = await loadAnimationImage(page.mask, page);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(mask, 0, 0, width, height);
    mask.removeAttribute('src');
    const coverage = context.getImageData(0, 0, canvas.width, canvas.height);
    await tintAtlas(pixels.data, coverage.data, offsets, true);
    context.putImageData(pixels, 0, 0);
    return canvas;
  });
}

/** Share pixels by texture pair and palette. Every clip keeps its own pose table. */
export async function prepareFrameAtlases(source: readonly FrameAtlasPage[], color: PetColor, scale: number) {
  const offsets = petColorOffsets(color);
  const prepared: HTMLCanvasElement[] = [];
  // Decode one page at a time so a long clip doesn't load every source image at once.
  for (const page of source) prepared.push(await preparePage(page, offsets, scale));
  return prepared;
}

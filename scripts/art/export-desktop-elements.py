#!/usr/bin/env python3
"""Pack complete original timelines with one fixed registration per skill.
The first source pose determines scale/ground, never the maximum effect bounds.
Tight frame rectangles save memory; original offsets preserve all source motion.
"""
import argparse
import concurrent.futures
import hashlib
import json
import math
import subprocess
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/original/element-skills'
PAGE_SIZE = 2048
PADDING = 2


def export(meta, exporter, work):
    raw = ROOT / f"research/references/original-element-skills/raw/{meta['sourceId']}.swf"
    dest = work / str(meta['sourceId'])
    signature = {
        'sourceSha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
        'exporterSha256': hashlib.sha256((ROOT / 'scripts/art/SourceExporter.java').read_bytes()).hexdigest(),
        'sprite': meta['actionSprite'], 'frame': meta['rootFrame'],
        'frames': meta['frames'], 'zoom': 4,
        'clearedSprites': meta['clearedRuntimeItemSprites'],
    }
    receipt = dest / 'export-receipt.json'
    frames = list(dest.rglob('*.png'))
    # Frame count alone cannot identify an export: older cached frames still
    # contain the game's item placeholder even after the clearing rule changed.
    cached = json.loads(receipt.read_text()) if receipt.exists() else None
    if len(frames) != meta['frames'] or cached != signature:
        if dest.exists():
            shutil.rmtree(dest)
        subprocess.run([exporter, 'nested', str(raw), str(dest), str(meta['actionSprite']),
                        str(meta['rootFrame']), str(meta['frames']), '4',
                        ','.join(map(str, meta['clearedRuntimeItemSprites']))],
                       check=True, stdout=subprocess.DEVNULL)
        receipt.write_text(json.dumps(signature, indent=2) + '\n')
    frames = sorted(dest.rglob('*.png'), key=lambda p: int(p.stem))
    if len(frames) != meta['frames']:
        raise ValueError('Incomplete original frames: ' + meta['id'])
    boxes = []
    for file in frames:
        with Image.open(file) as im:
            boxes.append(im.getbbox())
    visible = [b for b in boxes if b]
    first = visible[0]
    bounds = (min(b[0] for b in visible), min(b[1] for b in visible),
              max(b[2] for b in visible), max(b[3] for b in visible))
    scale = min(130 / (first[2] - first[0]), 150 / (first[3] - first[1]))
    width = math.ceil((bounds[2] - bounds[0]) * scale) + PADDING * 2
    height = math.ceil((bounds[3] - bounds[1]) * scale) + PADDING * 2
    unique, lookup, frame_map = [], {}, []
    for file, box in zip(frames, boxes):
        if box:
            # Quantize absolute coordinates, keeping registration and scale.
            x = round((box[0] - bounds[0]) * scale) + PADDING
            y = round((box[1] - bounds[1]) * scale) + PADDING
            right = round((box[2] - bounds[0]) * scale) + PADDING
            bottom = round((box[3] - bounds[1]) * scale) + PADDING
            with Image.open(file) as im:
                crop = im.convert('RGBA').crop(box).resize(
                    (max(1, right - x), max(1, bottom - y)), Image.Resampling.LANCZOS)
        else:
            x = y = PADDING
            crop = Image.new('RGBA', (1, 1))
        assert x >= 0 and y >= 0 and x + crop.width <= width and y + crop.height <= height
        digest = hashlib.sha256(crop.tobytes() + str((crop.size, x, y)).encode()).hexdigest()
        if digest not in lookup:
            lookup[digest] = len(unique)
            unique.append((crop, x, y))
        frame_map.append(lookup[digest])

    # Shelf pack large frames first, retaining limits for old Windows GPUs.
    bins, rectangles = [], [None] * len(unique)
    for index in sorted(range(len(unique)), key=lambda i: unique[i][0].height, reverse=True):
        im, dx, dy = unique[index]
        w, h = im.size
        if max(w, h) > PAGE_SIZE - 2:
            raise ValueError(f"Source frame exceeds texture limit: {meta['id']} {im.size}")
        slot = None
        for page, state in enumerate(bins):
            for shelf in state['shelves']:
                if h <= shelf['height'] and shelf['x'] + w + 1 <= PAGE_SIZE:
                    slot = (page, shelf['x'], shelf['y'])
                    shelf['x'] += w + 1
                    break
            if slot:
                break
            if state['bottom'] + h + 1 <= PAGE_SIZE:
                slot = (page, 1, state['bottom'])
                state['shelves'].append({'x': w + 2, 'y': state['bottom'], 'height': h})
                state['bottom'] += h + 1
                break
        if slot is None:
            bins.append({'shelves': [{'x': w + 2, 'y': 1, 'height': h}], 'bottom': h + 2})
            slot = (len(bins) - 1, 1, 1)
        rectangles[index] = [*slot, w, h, dx, dy]
    target = OUT / meta['id']
    pages = []
    for page in range(len(bins)):
        entries = [(im, r) for (im, _, _), r in zip(unique, rectangles) if r[0] == page]
        atlas = Image.new('RGBA', (max(r[1] + r[3] + 1 for _, r in entries),
                                   max(r[2] + r[4] + 1 for _, r in entries)))
        for im, r in entries:
            atlas.paste(im, (r[1], r[2]))
        name = f'atlas-{page}.png'
        atlas.save(target / name, optimize=True)
        pages.append(name)
    for old in target.glob('atlas-*.png'):
        if old.name not in pages:
            old.unlink()
    result = {k: v for k, v in meta.items() if k not in ['cell', 'columns', 'pageFrames']}
    result.update(frameMap=frame_map, pages=pages, rectangles=rectangles, width=width, height=height,
                  sourceBounds=list(bounds), registration={
                      'method': 'One fixed scale and origin for the full original timeline; effects overflow',
                      'sourceRasterZoom': 4, 'scale': scale, 'referenceBounds': list(first),
                      'centerX': ((first[0] + first[2]) / 2 - bounds[0]) * scale + PADDING,
                      'baseY': (first[3] - bounds[1]) * scale + PADDING,
                      'cssPixelsPerAtlasPixel': 160 / 288})
    (target / 'clip.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(meta['id'], meta['frames'], 'fixed-scale source frames,', len(pages), 'packed pages', flush=True)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--exporter', required=True)
    parser.add_argument('--work', default='/tmp/mole-original-element-export')
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    metas = json.loads((OUT / 'clips.json').read_text())
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda m: export(m, args.exporter, work), metas.values()))
    (OUT / 'clips.json').write_text(json.dumps({m['id']: m for m in results}, ensure_ascii=False, indent=2) + '\n')

#!/usr/bin/env python3
"""Rasterize furniture and its embedded Ram together at the original frame rate."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
VAULT = ROOT / 'local-assets'
OUT = ROOT / 'public/assets/original/furniture-actions'
RECEIPT = ROOT / 'research/original-furniture-import.json'

# The source starts with a hidden pet and holds the selected facing on state 2.
# Shape IDs are the original white/gray body fills below pet.petBody.
ITEMS = {
    '160202': ('跳舞', 43, 29, (12, 16, 18, 20, 22, 24, 26), 0),
    '160203': ('跑步', 41, 31, (13, 16, 19, 22, 25, 28), 0),
    '160206': ('荡秋千', 27, 21, (13,), 1),
    '160208': ('蹦床', 42, 29, (14, 23, 24, 25, 26, 27, 28), 0),
    '160229': ('在小窝休息', 23, 12, (8,), 0),
    '160773': ('在城堡小窝休息', 33, 22, (18,), 0),
    '160840': ('在南瓜猫车里休息', 28, 19, (15,), 0),
    '160889': ('在花骨朵床上休息', 17, 8, (4,), 0),
    # This set has two original characters in its second state. The gray
    # peBody slot follows the user's color, while the blue guest stays intact.
    '1220317': ('一起野餐', 87, 49, (5,), 0),
}
PALETTE_PROBE = {(255, 255, 255): (255, 0, 255), (204, 204, 204): (0, 255, 255),
                 (153, 153, 153): (255, 255, 0)}
PAGE = 2048


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def rgba(path):
    with Image.open(path) as image:
        return image.convert('RGBA')


def body_mask(neutral, probe):
    rgb = np.asarray(neutral)
    delta = rgb[:, :, :3].astype(np.float32) - np.asarray(probe)[:, :, :3]
    gray = np.clip((delta[:, :, 0] + 2 * delta[:, :, 2] / 3) / 170, 0, 1)
    dark = np.clip((delta[:, :, 2] + 51 * gray) / 153, 0, 1)
    white = np.clip((delta[:, :, 1] + 51 * gray + 102 * dark) / 255, 0, 1)
    result = np.dstack([white * 255, gray * 255, dark * 255, rgb[:, :, 3]]).round().astype('uint8')
    result[rgb[:, :, 3] == 0] = 0
    return Image.fromarray(result)


def pack(art, masks, destination):
    width, height = art[0].size
    tiles, frame_map, seen = [], [], {}
    for neutral, mask in zip(art, masks):
        key = hashlib.sha256(neutral.tobytes() + mask.tobytes()).digest()
        if key not in seen:
            seen[key] = len(tiles)
            tiles.append((neutral, mask))
        frame_map.append(seen[key])
    if len(tiles) < 2:
        raise ValueError(f'No motion in {destination.name}')
    columns, rows = PAGE // width, PAGE // height
    capacity = columns * rows
    pages, rectangles = [], []
    for start in range(0, len(tiles), capacity):
        group = tiles[start:start + capacity]
        page_size = (min(columns, len(group)) * width, math.ceil(len(group) / columns) * height)
        neutral, mask = [Image.new('RGBA', page_size) for _ in range(2)]
        for index, (source, source_mask) in enumerate(group):
            x, y = (index % columns) * width, (index // columns) * height
            neutral.paste(source, (x, y))
            mask.paste(source_mask, (x, y))
            rectangles.append([len(pages), x, y, width, height])
        neutral_name, mask_name = f'frame-{len(pages)}.webp', f'body-{len(pages)}.webp'
        neutral.save(destination / neutral_name, lossless=True, method=4)
        mask.save(destination / mask_name, lossless=True, method=4)
        pages.append(dict(neutral=neutral_name, mask=mask_name, width=page_size[0], height=page_size[1]))
    return dict(pages=pages, rectangles=rectangles, frameMap=frame_map,
                poses=[[[index, 0, 0]] for index in range(len(tiles))])


def export(item_id, source, stage, java):
    label, state_id, body_id, shape_ids, start = ITEMS[item_id]
    raw = VAULT / 'raw' / source['path']
    work = stage / item_id
    work.mkdir(exist_ok=True)
    xml, probe = work / 'source.xml', work / 'probe.swf'
    subprocess.run(java('SourceExporter', 'xml', raw, xml), check=True, stdout=subprocess.DEVNULL)
    tree = ET.parse(xml)
    tags = tree.getroot().find('tags')
    sprites = {int(tag.get('spriteId')): tag for tag in tags if tag.get('spriteId')}
    shapes = {int(tag.get('shapeId')): tag for tag in tags if tag.get('shapeId')}
    frame_count = int(sprites[body_id].get('frameCount'))
    facing = next(tag for tag in sprites[source['sprite']].find('subTags')
                  if tag.get('characterId') == str(state_id))
    matrix = facing.find('matrix')
    scale = float(matrix.get('scaleX', '1'))
    if scale != float(matrix.get('scaleY', '1')) or matrix.get('hasRotate') != 'false':
        raise ValueError(f'Unexpected facing transform for {item_id}')
    zoom = source['zoom'] * scale
    for shape_id in shape_ids:
        for node in shapes[shape_id].iter():
            channels = ('red', 'green', 'blue')
            if not all(channel in node.attrib for channel in channels):
                continue
            colour = tuple(int(node.get(channel)) for channel in channels)
            if colour in PALETTE_PROBE:
                for channel, value in zip(channels, PALETTE_PROBE[colour]):
                    node.set(channel, str(value))
    tree.write(xml, encoding='utf-8', xml_declaration=True)
    subprocess.run(java('SourceExporter', 'xml2swf', xml, probe), check=True, stdout=subprocess.DEVNULL)
    subprocess.run(java('RoomFurnitureFrames', raw, probe, work, state_id, frame_count, zoom, start), check=True)

    reference = rgba(work / 'reference.png').getbbox()
    still = rgba(work / 'idle.png').crop(reference)
    pairs = [(rgba(work / f'{i}-n.png'), rgba(work / f'{i}-p.png')) for i in range(frame_count)]
    boxes = [neutral.getbbox() for neutral, _ in pairs]
    view = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    width, height = view[2] - view[0], view[3] - view[1]
    neutral, masks = [], []
    for live, recoloured in pairs:
        live, recoloured = live.crop(view), recoloured.crop(view)
        if live.getchannel('A').tobytes() != recoloured.getchannel('A').tobytes():
            raise ValueError(f'Body probe changed source transparency for {item_id}')
        neutral.append(live)
        masks.append(body_mask(live, recoloured))
    if not any(np.any(np.asarray(mask)[:, :, :3]) for mask in masks):
        raise ValueError(f'Empty body mask for {item_id}')

    destination = OUT / item_id
    destination.mkdir(parents=True, exist_ok=True)
    still.save(destination / 'idle.webp', lossless=True, method=4)
    timeline = json.loads((VAULT / 'timelines' / (source['path'] + '.json')).read_text())
    fps = timeline['fps']
    spec = dict(assetRoot='furniture-actions', id=item_id, assetKey=item_id, form='furniture', label=label,
                width=width, height=height, frames=frame_count, durationMs=math.ceil(frame_count * 1000 / fps),
                registration=dict(scale=zoom, cssPixelsPerAtlasPixel=1 / zoom, centerX=width / 2, baseY=height),
                placement=dict(left=(view[0] - reference[0]) * 100 / still.width,
                               top=(view[1] - reference[1]) * 100 / still.height, width=width * 100 / still.width))
    clip = dict(**spec, fps=fps, **pack(neutral, masks, destination))
    write_json(destination / 'clip.json', clip)
    print(f'{item_id}: {frame_count} source frames at {fps:g} fps, {len(clip["rectangles"])} distinct frames', flush=True)
    record = dict(
        id=item_id, name=source['name'], path=source['path'], sha256=sha(raw), facing=source['sprite'],
        clickStateSprite=state_id, bodyTimeline=body_id, bodyShapeIds=shape_ids, frames=frame_count,
        fps=fps, firstNestedFrame=start + 1, originalStageRect=(work / 'source-camera.txt').read_text(),
        originalIdlePixels=still.size, exportedPages={p.name: sha(p) for p in sorted(destination.glob('*.webp'))},
    )
    if item_id == '1220317':
        record['trigger'] = 'Original picnic frame 2, including the two source participants and nested props'
    return f'original-{item_id}', spec, record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--ffdec-lib', type=Path, default=Path('/opt/jpexs/26.4.0/lib'))
    parser.add_argument('--item', action='append', choices=ITEMS)
    args = parser.parse_args()
    stage = args.work.resolve()
    classes = stage / 'classes'
    classes.mkdir(parents=True, exist_ok=True)
    subprocess.run(['java', '-m', 'jdk.compiler/com.sun.tools.javac.Main', '-cp', str(args.ffdec_lib / 'ffdec_lib.jar'),
                    '-d', str(classes), str(ROOT / 'scripts/art/SourceExporter.java'),
                    str(ROOT / 'scripts/art/RoomFurnitureFrames.java')], check=True)

    def java(tool, *arguments):
        return ['java', '-Djava.awt.headless=true', '-Xmx360m', '-cp', f'{classes}:{args.ffdec_lib}/*',
                tool, *map(str, arguments)]

    archive = {item['id']: item for item in json.loads(RECEIPT.read_text())['records']}
    with ThreadPoolExecutor(max_workers=2) as threads:
        exported = list(threads.map(lambda item_id: export(item_id, archive[item_id], stage, java), args.item or ITEMS))
    index = json.loads((OUT / 'index.json').read_text()) if args.item else {}
    index.update({id: spec for id, spec, _ in exported})
    previous = json.loads((OUT / 'sources.json').read_text())['sources'] if args.item else []
    records = {record['id']: record for record in previous}
    records.update({record['id']: record for _, _, record in exported})
    write_json(OUT / 'index.json', index)
    write_json(OUT / 'sources.json', dict(
        trigger='ClientAppDLL.swf → newEditHouseView.changeStatus → mc2.needPet → frame 2 → GF.setPetColor',
        archive=json.loads(RECEIPT.read_text())['archiveRevision'],
        playback='Original facing and nested frames, synchronized furniture and body. The host cancels or stops the loop after complete cycles.',
        sources=list(records.values()),
    ))


if __name__ == '__main__':
    main()

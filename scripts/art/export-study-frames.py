"""Bake the complete classroom read/write SWFs into transparent, tintable frames.

Use the original timelines at 24 fps. Project changes are limited to one
registration per clip and a body-only colour mask. Source files stay intact.
Requires Pillow, NumPy and the bundled library from a JPEXS installation.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'public/assets/original'
PALETTE = {(255, 255, 255): (255, 0, 255), (204, 204, 204): (0, 255, 255), (153, 153, 153): (255, 255, 0)}
FORMS = {2: 'junior', 3: 'middle', 4: 'senior', 101: 'classic'}


def write_atlas(directory, frames):
    rectangles, poses, pages = [], [], []
    limit = 1536
    n_atlas = Image.new('RGBA', (limit, limit))
    m_atlas = Image.new('RGBA', (limit, limit))
    x = y = row_height = used_width = 0

    def flush():
        number = len(pages)
        width, height = used_width, y + row_height
        names = [f'neutral-{number}.webp', f'mask-{number}.webp']
        for atlas, name in zip((n_atlas, m_atlas), names):
            atlas.crop((0, 0, width, height)).save(directory / name, lossless=True, exact=True)
        pages.append(dict(neutral=names[0], mask=names[1], width=width, height=height))

    for normal, mask, left, top in frames:
        width, height = normal.size
        if max(width, height) > limit:
            raise ValueError('Frame is larger than one atlas page')
        if x + width > limit:
            x, y, row_height = 0, y + row_height, 0
        if y + height > limit:
            flush()
            n_atlas = Image.new('RGBA', (limit, limit))
            m_atlas = Image.new('RGBA', (limit, limit))
            x = y = row_height = used_width = 0
        n_atlas.paste(normal, (x, y)); m_atlas.paste(mask, (x, y))
        poses.append([[len(rectangles), left, top]])
        rectangles.append([len(pages), x, y, width, height])
        x += width
        row_height = max(row_height, height)
        used_width = max(used_width, x)
    flush()
    return pages, rectangles, poses


def export(clip, args):
    form = FORMS[clip['level']]
    action = 'read' if clip['path'].endswith('/14.swf') else 'write'
    key = f'{form}-{action}'
    work = args.work / key
    work.mkdir(parents=True, exist_ok=True)
    folder = args.output / key
    folder.mkdir(parents=True, exist_ok=True)
    source = PUBLIC / 'official/files' / clip['path']
    if hashlib.sha256(source.read_bytes()).hexdigest() != clip['sha256']:
        raise ValueError(f'Source mismatch for {key}')
    xml = work / 'source.xml'
    cli = ['java', '-Xmx420m', '-Djava.awt.headless=true', '-jar', str(args.ffdec / 'ffdec-cli.jar')]
    def run(command):
        with (work / 'export.log').open('a') as log:
            subprocess.run(command, stdout=log, stderr=log, check=True)
    run(cli + ['-swf2xml', source, xml])
    tree = ET.parse(xml)
    tags = tree.getroot().find('tags')
    sprite = next(tag.get('characterId') for tag in tags if tag.get('type', '').startswith('Place'))
    changed = []
    for tag in tags:
        if not tag.get('type', '').startswith(('DefineShape', 'DefineMorphShape')):
            continue
        colors = [c for c in tag.iter('color') if 'red' in c.attrib]
        color_key = lambda c: tuple(int(c.get(name)) for name in ('red', 'green', 'blue'))
        existing = {color_key(c) for c in colors}
        if len(existing) < 2 or not existing <= PALETTE.keys():
            continue
        changed.append(tag.get('shapeId') or tag.get('characterId'))
        for swatch in colors:
            for channel, value in zip(('red', 'green', 'blue'), PALETTE[color_key(swatch)]):
                swatch.set(channel, str(value))
    if not changed:
        raise ValueError(f'No separable body colours in {key}')
    probe_xml, probe = work / 'probe.xml', work / 'probe.swf'
    tree.write(probe_xml, encoding='utf-8', xml_declaration=True)
    run(cli + ['-xml2swf', probe_xml, probe])
    exports = work / 'frames'
    run(['java', '-Xmx540m', '-Djava.awt.headless=true', '-cp', f'{args.classes}:{args.ffdec}/lib/*',
         'UploadedSwfExporter', 'frames', source, probe, exports, sprite, str(clip['effectFrames']), '3'])
    positions = json.loads((exports / 'frames.json').read_text())['frames']
    body = json.loads((ROOT / 'electron/edge-visibility.json').read_text())['forms'][form]['body']
    origin_x, origin_y = min(p[0] for p in positions), min(p[1] for p in positions)
    scale = center_x = base_y = None
    frame_map, unique, known = [], [], {}
    canvas_width = canvas_height = 0
    for index, (left, top, width, height) in enumerate(positions):
        original = Image.open(exports / f'{index}-n.png').convert('RGBA')
        paint = np.asarray(original)
        tinted = np.asarray(Image.open(exports / f'{index}-p.png').convert('RGBA'))
        delta = paint[:, :, :3].astype(np.float32) - tinted[:, :, :3]
        mid = np.clip((delta[:, :, 0] + 2 * delta[:, :, 2] / 3) / 170, 0, 1)
        dark = np.clip((delta[:, :, 2] + 51 * mid) / 153, 0, 1)
        white = np.clip((delta[:, :, 1] + 51 * mid + 102 * dark) / 255, 0, 1)
        mask = np.rint(np.dstack((white * 255, mid * 255, dark * 255, paint[:, :, 3]))).astype('uint8')
        mask[paint[:, :, 3] == 0] = 0
        if index == 0:
            ys, xs = np.where(((white + mid + dark) > .5) & (paint[:, :, 3] > 180))
            if not len(xs):
                raise ValueError(f'No registered body in the first frame of {key}')
            scale = 2 * (body[2] - body[0]) / (1 + xs.max() - xs.min())
            center_x = (left - origin_x + (xs.min() + xs.max() + 1) / 2) * scale + 2
            base_y = (top - origin_y + ys.max() + 1) * scale + 2
        offset_x, offset_y = round((left - origin_x) * scale) + 2, round((top - origin_y) * scale) + 2
        size = max(1, round(width * scale)), max(1, round(height * scale))
        normal = original.resize(size, Image.Resampling.LANCZOS)
        coverage = Image.fromarray(mask).resize(size, Image.Resampling.LANCZOS)
        digest = hashlib.sha256(normal.tobytes() + coverage.tobytes() + str((size, offset_x, offset_y)).encode()).digest()
        if digest not in known:
            known[digest] = len(unique)
            unique.append((normal, coverage, offset_x, offset_y))
        frame_map.append(known[digest])
        canvas_width, canvas_height = max(canvas_width, offset_x + size[0] + 2), max(canvas_height, offset_y + size[1] + 2)
    if len(unique) < 3:
        raise ValueError(f'Nested timeline did not advance in {key}')
    pages, rectangles, poses = write_atlas(folder, unique)
    meta = dict(assetRoot='study-frames', assetKey=key, id=action, form=form, frames=len(frame_map),
                durationMs=math.ceil(len(frame_map) / clip['fps'] * 1000), width=canvas_width, height=canvas_height,
                registration=dict(scale=scale, cssPixelsPerAtlasPixel=.5, centerX=center_x, baseY=base_y))
    (folder / 'clip.json').write_text(json.dumps(dict(meta, source=clip['path'], sourceSha256=clip['sha256'],
        fps=clip['fps'], bodyShapeIds=changed, pages=pages, rectangles=rectangles, poses=poses, frameMap=frame_map),
        separators=(',', ':')) + '\n')
    print(key, len(frame_map), len(unique), canvas_width, canvas_height, flush=True)
    return clip['id'], meta


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for flag in ('ffdec', 'work', 'classes', 'output'):
        parser.add_argument('--' + flag, type=Path, required=True)
    args = parser.parse_args()
    catalogue = json.loads((PUBLIC / 'official/manifest.json').read_text())
    clips = [clip for clip in catalogue['clips'] if '/lahmMovie/' in clip['path'] and clip['kind'] == 'school'
             and clip['level'] in FORMS and clip['path'].endswith(('/13.swf', '/14.swf'))]
    if len(clips) != 8:
        raise ValueError('Expected a read and write source for each classroom form')
    index = dict(export(clip, args) for clip in clips)
    (args.output / 'index.json').write_text(json.dumps(index, indent=2) + '\n')

"""Export original closed-eye flight rigs, retaining the original down timeline.

Requires JPEXS 26.3, Pillow and NumPy. Source SWFs are deliberately not bundled.
See public/assets/original/comfort/source.json for original URLs and hashes.
"""
import argparse
import concurrent.futures
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--sources', type=Path, required=True)
parser.add_argument('--ordinary-xml', type=Path, required=True)
parser.add_argument('--ffdec', required=True)
parser.add_argument('--work', type=Path, required=True)
parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
parser.add_argument('--reuse-exports', action='store_true')
args = parser.parse_args()
args.work.mkdir(parents=True, exist_ok=True)
output = args.repo / 'public/assets/original/comfort'
output.mkdir(parents=True, exist_ok=True)
forms = {
    'senior': (1777, 1539, 1534, None, 148, 12, 1533, [1, 3, 4, 6, 7, 8]),
    'super': (940, 46, 36, 32, 31, 35, 27, [1, 5, 8, 12, 15, 19]),
    'water': (538, 19, 15, 11, 10, 14, 6, [1, 3, 4, 6, 7, 9]),
    'wood': (1029, 25, 15, 11, 10, 14, 6, [1, 3, 4, 6, 7, 9]),
    'fire': (898, 31, 25, 11, 10, 14, 23, [1, 3, 4, 6, 7, 9]),
}
ordinary = ET.parse(args.ordinary_xml)
eyelid = ordinary.getroot().find("tags/item[@shapeId='665']")
assert eyelid is not None


def nodes_for(tree):
    return {int(n.get('spriteId') or n.get('shapeId')): n
            for n in tree.getroot().find('tags') if n.get('spriteId') or n.get('shapeId')}


def hide(node):
    node.set('placeFlagHasColorTransform', 'true')
    old = node.find('colorTransform')
    if old is not None:
        node.remove(old)
    ET.SubElement(node, 'colorTransform', type='CXFORMWITHALPHA', hasAddTerms='false',
                  hasMultTerms='true', nbits='10', redMultTerm='256', greenMultTerm='256',
                  blueMultTerm='256', alphaMultTerm='0', redAddTerm='0', greenAddTerm='0',
                  blueAddTerm='0', alphaAddTerm='0')


def prepare(form, probe):
    master, down, body, eye_sprite, eye_shape, pupil, body_shape, frames = forms[form]
    tree = copy.deepcopy(ordinary) if form == 'senior' else ET.parse(args.sources / f'{form}.xml')
    nodes = nodes_for(tree)
    cache = {}

    def length(sid, seen=None):
        if sid in cache:
            return cache[sid]
        seen = set() if seen is None else set(seen)
        if sid not in nodes or sid in seen:
            return 1
        seen.add(sid)
        node = nodes[sid]
        own = int(node.get('frameCount', '1'))
        if own == 1:
            own = max([own] + [length(int(n.get('characterId')), seen)
                              for n in node.iter() if n.get('characterId')])
        cache[sid] = own
        return own

    for sid, node in nodes.items():
        if node.get('type') == 'DefineSpriteTag' and node.get('frameCount') == '1':
            count = length(sid)
            for _ in range(count - 1):
                ET.SubElement(node.find('subTags'), 'item', type='ShowFrameTag', forceWriteAsLong='false')
            node.set('frameCount', str(count))

    tags = tree.getroot().find('tags')
    lid_id = max(nodes) + 1
    lid = copy.deepcopy(eyelid)
    lid.set('shapeId', str(lid_id))
    # Define before its first placement, as required by the SWF display list.
    tags.insert(0, lid)
    eye_definition = nodes[eye_shape]
    while eye_definition.find('shapeBounds') is None:
        child = next(n for n in eye_definition.iter() if n.get('characterId'))
        eye_definition = nodes[int(child.get('characterId'))]
    bounds = eye_definition.find('shapeBounds')
    x0, x1, y0, y1 = (int(bounds.get(k)) for k in ['Xmin', 'Xmax', 'Ymin', 'Ymax'])
    scale = (x1 - x0) * .85 / 334
    eye_id = eye_sprite or lid_id + 1
    if eye_sprite:
        eye = nodes[eye_sprite]
        # Original eye wrapper includes a -19 twip translation and a white
        # colour transform. Retain its centre, discard only that whitening.
        cx = (x0 + x1) / 2 - 19
        eye.remove(eye.find('subTags'))
    else:
        eye = ET.Element('item', type='DefineSpriteTag', forceWriteAsLong='true',
                         frameCount='1', hasEndTag='true', spriteId=str(eye_id))
        tags.insert(1, eye)
        cx = (x0 + x1) / 2
        for placement in nodes[body].iter():
            if placement.get('characterId') == str(eye_shape):
                placement.set('characterId', str(eye_id))
                placement.set('placeFlagHasColorTransform', 'false')
                white = placement.find('colorTransform')
                if white is not None:
                    placement.remove(white)
    eye.set('frameCount', '1')
    sub = ET.SubElement(eye, 'subTags')
    place = ET.SubElement(sub, 'item', type='PlaceObject2Tag', characterId=str(lid_id), depth='1',
                          forceWriteAsLong='false', placeFlagHasCharacter='true',
                          placeFlagHasMatrix='true', placeFlagMove='false',
                          placeFlagHasColorTransform='false', placeFlagHasClipActions='false',
                          placeFlagHasClipDepth='false', placeFlagHasName='false', placeFlagHasRatio='false')
    ET.SubElement(place, 'matrix', type='MATRIX', hasRotate='false', hasScale='true',
                  nRotateBits='0', nScaleBits='31', nTranslateBits='31',
                  scaleX=str(scale), scaleY=str(scale), translateX=str(round(cx + 206 * scale)),
                  translateY=str(round((y0 + y1) / 2 + 15.5 * scale)))
    ET.SubElement(sub, 'item', type='ShowFrameTag', forceWriteAsLong='false')
    for placement in nodes[body].iter():
        if placement.get('characterId') == str(pupil):
            hide(placement)
    # Ordinary senior has an independent ground shadow at depth 1. Elemental
    # down rigs use depth 1 for the BACK of their crown, which must stay visible.
    if form == 'senior':
        for placement in nodes[down].find('subTags'):
            if placement.get('type', '').startswith('Place') and placement.get('depth') == '1':
                hide(placement)

    root = nodes[master]
    original = list(root.find('subTags'))
    start = next(i for i, n in enumerate(original) if n.get('name') == 'down')
    down_place = next(n for n in original[start + 1:] if n.get('characterId'))
    root.remove(root.find('subTags'))
    sequence = ET.SubElement(root, 'subTags')
    sequence.append(copy.deepcopy(down_place))
    count = 21 if form == 'super' else 11
    for _ in range(count):
        ET.SubElement(sequence, 'item', type='ShowFrameTag', forceWriteAsLong='false')
    root.set('frameCount', str(count))
    if probe:
        for color in nodes[body_shape].iter('color'):
            key = tuple(int(color.get(k, 0)) for k in ['red', 'green', 'blue'])
            value = {(255, 255, 255): (255, 0, 255), (204, 204, 204): (0, 255, 255),
                     (153, 153, 153): (255, 255, 0)}.get(key)
            if value:
                for channel, amount in zip(['red', 'green', 'blue'], value):
                    color.set(channel, str(amount))
    name = form + ('-probe' if probe else '-neutral')
    xml = args.work / f'{name}.xml'
    swf = args.work / f'{name}.swf'
    tree.write(xml, encoding='utf-8', xml_declaration=True)
    with (args.work / f'{name}.log').open('w') as log:
        subprocess.run(['java', '-Djava.awt.headless=true', '-jar', args.ffdec, '-xml2swf', str(xml), str(swf)], stdout=log, stderr=log, check=True)
        subprocess.run(['java', '-Djava.awt.headless=true', '-jar', args.ffdec, '-selectid', str(master), '-select', f'{master}:1-{count}', '-zoom', '4', '-ignorebackground', '-export', 'sprite', str(args.work / name), str(swf)], stdout=log, stderr=log, check=True)
    print(name, 'exported', flush=True)


if not args.reuse_exports:
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda job: prepare(*job), [(form, probe) for form in forms for probe in [False, True]]))


def coverage(neutral, probe):
    a, b = np.asarray(neutral), np.asarray(probe)
    d = a[:, :, :3].astype(float) - b[:, :, :3].astype(float)
    gray = np.clip((d[:, :, 0] + 2 * d[:, :, 2] / 3) / 170, 0, 1)
    dark = np.clip((d[:, :, 2] + 51 * gray) / 153, 0, 1)
    white = np.clip((d[:, :, 1] + 51 * gray + 102 * dark) / 255, 0, 1)
    mask = np.dstack([np.rint(white * 255), np.rint(gray * 255), np.rint(dark * 255), a[:, :, 3]]).astype('uint8')
    mask[a[:, :, 3] == 0] = 0
    return Image.fromarray(mask)


def body_bounds(images):
    boxes = []
    for im in images:
        a = np.asarray(im)
        y, x = np.where((a[:, :, :3].sum(axis=2) > 90) & (a[:, :, 3] > 150))
        boxes.append((int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1))
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]


metadata = {'description': 'Original down rigs with original eyelid shape 665; no new character drawing.',
            'cell': [192, 208], 'columns': 6, 'eyelidSource': 'lamubone.swf / shape665',
            'registration': 'Existing original front body/crown retained pixel-for-pixel outside the exported eye regions.',
            'sourceFiles': {'lamubone.swf': {'url': 'http://mole.61.com/resource/NPC/lamubone.swf',
                'sha256': '01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf'}}, 'forms': {}}
paths = {'super': 'pet101/skill_7.swf', 'water': 'pet5/skill_2.swf', 'wood': 'pet5/skill_4.swf', 'fire': 'pet5/skill_1.swf'}
for form, path in paths.items():
    metadata['sourceFiles'][f'{form}.swf'] = {
        'url': 'http://mole.61.com/resource/petcloth/swf2/' + path,
        'archive': 'https://raw.githubusercontent.com/Miigon/RecMoleRes/master/root/resource/petcloth/swf2/' + path,
        'sha256': hashlib.sha256((args.sources / f'{form}.swf').read_bytes()).hexdigest()}
for form, spec in forms.items():
    master, *_, frames = spec
    images = []
    masks = []
    for frame in frames:
        paths = [next((args.work / f'{form}-{mode}').glob(f'DefineSprite_{master}*/{frame}.png')) for mode in ['neutral', 'probe']]
        neutral, probe = [Image.open(path).convert('RGBA') for path in paths]
        images.append(neutral)
        masks.append(coverage(neutral, probe))
    old = Image.open(args.repo / f'public/assets/classic/{form}-mask.png').convert('RGBA')
    target = body_bounds([old.crop((i * 192, 0, (i + 1) * 192, 208)) for i in range(6)])
    source = body_bounds(masks)
    scale = (target[2] - target[0]) / (source[2] - source[0])
    dx = (target[0] + target[2]) / 2 - (source[0] + source[2]) / 2 * scale
    dy = target[3] - source[3] * scale
    placed = [[im.transform((192, 208), Image.Transform.AFFINE,
                           (1 / scale, 0, -dx / scale, 0, 1 / scale, -dy / scale), Image.Resampling.BICUBIC)
               for im in parts] for parts in [images, masks]]
    # Reuse the EXISTING original front frames exactly. Export only the eye
    # region into them, so JPEXS's nested crown phase/bounds cannot change the
    # silhouette during an expression. This is packing original SWF layers,
    # not drawing a replacement body or estimating a new crown pose.
    front = Image.open(args.repo / f'public/assets/classic/{form}-neutral.png').convert('RGBA')
    patches = []
    for i in range(6):
        old_frame = front.crop((i * 192, 0, (i + 1) * 192, 208))
        boxes = []
        for im in [old_frame, placed[0][i]]:
            a = np.asarray(im)
            ys, xs = np.indices(a.shape[:2])
            eye = ((a[:, :, :3].max(axis=2) < 45) & (a[:, :, 3] > 150)
                   & (ys > target[1] + (target[3] - target[1]) * .4)
                   & (xs > target[0] + 10) & (xs < target[2] - 10))
            y, x = np.where(eye)
            assert len(x), (form, i, 'missing original eye ink')
            boxes.append((int(x.min()) - 3, int(y.min()) - 3, int(x.max()) + 4, int(y.max()) + 4))
        # Include the full original white eye ovals, not only their pupils.
        # Their body-colour mask is deliberately empty; leaving any rim behind
        # would show white stripes below a closed eye on a coloured pet.
        a = np.asarray(old_frame)
        mask = np.asarray(old.crop((i * 192, 0, (i + 1) * 192, 208)))
        ys, xs = np.indices(a.shape[:2])
        whites = ((a[:, :, :3].min(axis=2) > 240) & (a[:, :, 3] > 150)
                  & (mask[:, :, :3].max(axis=2) < 15)
                  & (ys > target[1] + (target[3] - target[1]) * .35)
                  & (xs > target[0] + 10) & (xs < target[2] - 10))
        y, x = np.where(whites)
        assert len(x), (form, i, 'missing original white eye ovals')
        boxes.append((int(x.min()) - 3, int(y.min()) - 3, int(x.max()) + 4, int(y.max()) + 4))
        patches.append((min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)))
    for index, mode in enumerate(['neutral', 'mask']):
        atlas = Image.new('RGBA', (192 * 6, 208))
        original = front if index == 0 else old
        for i, box in enumerate(patches):
            frame = original.crop((i * 192, 0, (i + 1) * 192, 208))
            frame.paste(placed[index][i].crop(box), box)
            atlas.paste(frame, (i * 192, 0))
        atlas.save(output / f'{form}-{mode}.png', optimize=True)
    metadata['forms'][form] = {'root': master, 'frames': frames, 'scale': scale, 'translation': [dx, dy],
                               'sourceBodyBounds': source, 'targetBodyBounds': target, 'originalEyeRegions': patches}
metadata['files'] = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in output.glob('*.png')}
(output / 'source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')

#!/usr/bin/env python3
"""Package shared model-drawn smoke/box layers and preview original Ram forms.

Only crops, registers, resizes and composites existing artwork. No character
drawing, interpolated poses, reverse playback or per-form generated animations.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SIZE = (288, 288)
CENTER = 144
BASE = 226
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FORMS = [('seed', '种子'), ('junior', '初级'), ('middle', '中级'),
         ('senior', '高级'), ('super', '神力超拉'), ('water', '水'),
         ('wood', '木'), ('fire', '火')]


def visible_bounds(im: Image.Image) -> tuple[int, int, int, int]:
    return im.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()


def split(path: Path, cols: int, rows: int, components: bool = False) -> list[Image.Image]:
    im = Image.open(path)
    if 'A' not in im.getbands() or im.getchannel('A').getextrema()[0] != 0:
        raise ValueError(f'{path}: true transparency required')
    im = im.convert('RGBA')
    # Some puff lobes extend across the nominal row boundary. Extract connected
    # source artwork by its cell of origin, rather than slicing a lobe in half.
    groups = {(row, col): [] for row in range(rows) for col in range(cols)}
    arr = np.asarray(im)
    if components:
        labels, _ = ndimage.label(arr[:, :, 3] > 32)
        for label, region in enumerate(ndimage.find_objects(labels), 1):
            if region is None:
                continue
            mask = labels[region] == label
            if mask.sum() < 5:
                continue
            y, x = ndimage.center_of_mass(mask)
            y += region[0].start
            x += region[1].start
            groups[(min(rows - 1, int(y / (im.height / rows))),
                    min(cols - 1, int(x / (im.width / cols))))].append(label)
    pad_x, pad_y = (round(im.width / cols * .15), round(im.height / rows * .15)) if components else (0, 0)
    result = []
    for row in range(rows):
        for col in range(cols):
            source = im
            if components:
                keep = ndimage.binary_dilation(np.isin(labels, groups[(row, col)]), iterations=2)
                pixels = arr.copy()
                pixels[:, :, 3] *= keep
                source = Image.fromarray(pixels)
            cell = source.crop((round(col * im.width / cols) - pad_x, round(row * im.height / rows) - pad_y,
                                round((col + 1) * im.width / cols) + pad_x, round((row + 1) * im.height / rows) + pad_y))
            bbox = visible_bounds(cell)
            if not bbox or bbox[0] == 0 or bbox[1] == 0 or bbox[2] == cell.width or bbox[3] == cell.height:
                raise ValueError(f'{path}: missing or clipped cell {len(result) + 1}')
            result.append(cell)
    return result


def place_subject(source: Image.Image, width: int = 144, height: int = 166) -> Image.Image:
    sprite = source.convert('RGBA').crop(visible_bounds(source.convert('RGBA')))
    sprite.thumbnail((width, height), Image.Resampling.LANCZOS)
    layer = Image.new('RGBA', SIZE)
    layer.alpha_composite(sprite, (CENTER - sprite.width // 2, BASE - sprite.height))
    return layer


def original(form: str, color: str) -> tuple[Image.Image, str]:
    if form == 'seed':
        path = ROOT / 'public/assets/original/seed/source-motion.gif'
    else:
        path = ROOT / f'public/assets/original/pets/{form}-{color}-idle.png'
    with Image.open(path) as im:
        im.seek(0)
        layer = place_subject(im.convert('RGBA'), 144, 150 if form in ('seed', 'junior') else 166)
    return layer, str(path.relative_to(ROOT))


def timeline() -> list[dict]:
    result = [{'subject': 'original', 'smoke': None, 'box': 0, 'ms': 400}]
    for index in range(16):
        result.append({'subject': 'original' if index < 7 else 'box', 'smoke': index,
                       'box': 0, 'ms': 70})
    result += [{'subject': 'box', 'smoke': None, 'box': b, 'ms': ms}
               for b, ms in [(0, 600), (1, 70), (2, 70), (3, 200), (0, 300)]]
    for index in range(16):
        result.append({'subject': 'box' if index < 7 else 'original', 'smoke': index,
                       'box': 0, 'ms': 70})
    result.append({'subject': 'original', 'smoke': None, 'box': 0, 'ms': 400})
    return result


def compose(subject: Image.Image, boxes: list[Image.Image], smoke: list[Image.Image], entry: dict) -> Image.Image:
    layer = (subject if entry['subject'] == 'original' else boxes[entry['box']]).copy()
    if entry['smoke'] is not None:
        layer.alpha_composite(smoke[entry['smoke']])
    return layer


def board(frames: list[Image.Image], labels: list[str], path: Path, columns: int = 4) -> None:
    rows = (len(frames) + columns - 1) // columns
    image = Image.new('RGB', (256 * columns, 286 * rows), '#f7f2e5')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, 15)
    for index, (frame, label) in enumerate(zip(frames, labels)):
        x, y = (index % columns) * 256, (index // columns) * 286
        thumbnail = frame.copy()
        thumbnail.thumbnail((256, 256), Image.Resampling.LANCZOS)
        image.paste(thumbnail, (x, y + 26), thumbnail)
        draw.text((x + 10, y + 5), label, font=font, fill='#624c34')
    image.save(path)


def gif(frames: list[Image.Image], entries: list[dict], path: Path, small: bool = False) -> int:
    result = []
    for frame in frames:
        size = (100, 108) if small else SIZE
        image = Image.new('RGBA', size, '#244852' if small else '#f7f2e5')
        artwork = frame.copy()
        artwork.thumbnail(size, Image.Resampling.LANCZOS)
        image.alpha_composite(artwork, ((size[0] - artwork.width) // 2, size[1] - artwork.height))
        result.append(image.convert('RGB'))
    result[0].save(path, save_all=True, append_images=result[1:], duration=[e['ms'] for e in entries],
                   loop=0, disposal=2, optimize=False)
    with Image.open(path) as encoded:
        return encoded.n_frames


def render(box_path: Path, smoke_path: Path, out: Path) -> None:
    for folder in ('shared/box', 'shared/smoke', 'subjects', 'forms'):
        (out / folder).mkdir(parents=True, exist_ok=True)
    box_cells = split(box_path, 2, 2)
    first_box = visible_bounds(box_cells[0])
    box_scale = min(144 / (first_box[2] - first_box[0]), 110 / (first_box[3] - first_box[1]))
    boxes = []
    for index, cell in enumerate(box_cells):
        bounds = visible_bounds(cell)
        layer = Image.new('RGBA', SIZE)
        layer.alpha_composite(cell.resize((round(cell.width * box_scale), round(cell.height * box_scale)), Image.Resampling.LANCZOS),
                              (round(CENTER - (bounds[0] + bounds[2]) / 2 * box_scale), round(BASE - bounds[3] * box_scale)))
        layer.save(out / f'shared/box/{index + 1:02d}.png')
        boxes.append(layer)
    cells = split(smoke_path, 4, 4, components=True)
    with Image.open(smoke_path) as sheet:
        common_scale = min(256 / (sheet.width / 4), 256 / (sheet.height / 4)) * 1.08
    smoke = []
    for index, cell in enumerate(cells):
        layer = Image.new('RGBA', SIZE)
        image = cell.resize((round(cell.width * common_scale), round(cell.height * common_scale)), Image.Resampling.LANCZOS)
        layer.alpha_composite(image, ((SIZE[0] - image.width) // 2, (SIZE[1] - image.height) // 2 - 32))
        layer.save(out / f'shared/smoke/{index + 1:02d}.png')
        smoke.append(layer)
    checks, forms, sources = {}, {}, {}
    # Validate one fixed effect against every original form and available color.
    smoke_alpha = np.asarray(smoke[7])[:, :, 3]
    for form, _ in FORMS:
        for color in (['source'] if form == 'seed' else ['red', 'yellow', 'blue', 'pink']):
            subject, source = original(form, color)
            mask = np.asarray(subject)[:, :, 3] > 128
            coverage = float((smoke_alpha[mask] >= 250).mean())
            checks[f'{form}-{color}'] = round(coverage * 100, 3)
            sources[source] = hashlib.sha256((ROOT / source).read_bytes()).hexdigest()
            if coverage < .995:
                raise ValueError(f'Swap smoke does not hide {form}-{color}: {coverage:.2%}')
    box_mask = np.asarray(boxes[0])[:, :, 3] > 128
    checks['box'] = round(float((smoke_alpha[box_mask] >= 250).mean()) * 100, 3)
    if checks['box'] < 99.5:
        raise ValueError('Swap smoke does not hide the whole box')
    entries = timeline()
    samples = [0, 2, 4, 7, 9, 11, 14, 16, 17, 20, 22, 25, 28, 32, 36, 38]
    form_board = []
    for form, title in FORMS:
        subject, source = original(form, 'source' if form == 'seed' else 'red')
        subject.save(out / f'subjects/{form}.png')
        frames = [compose(subject, boxes, smoke, entry) for entry in entries]
        encoded = gif(frames, entries, out / f'forms/{form}.gif')
        forms[form] = {'title': title, 'source': source, 'subject': f'subjects/{form}.png', 'gif_frames': encoded}
        form_board += [frames[0], frames[8], frames[17], frames[-1]]
        if form == 'middle':
            gif(frames, entries, out / 'preview.gif')
            gif(frames, entries, out / 'preview-100px.gif', True)
            board([frames[i] for i in samples], [f'{i + 1:02d}' for i in samples], out / 'sequence.png')
    board(form_board, [f'{title} · {phase}' for _, title in FORMS for phase in ('原形', '完全遮盖', '共用盒子', '恢复原形')], out / 'forms-overview.png')
    board(boxes, ['睁眼', '半眨眼', '闭眼', '睁眼'], out / 'box-poses.png', 2)
    board(smoke, [f'{i + 1:02d}' for i in range(16)], out / 'smoke-sequence.png')
    manifest = {
        'preview_only': True, 'official_animation': False,
        'model_drawn_cells': {'box': 4, 'smoke': 16},
        'source_sheets': [str(box_path.relative_to(ROOT)), str(smoke_path.relative_to(ROOT))],
        'source_sha256': [hashlib.sha256(p.read_bytes()).hexdigest() for p in (box_path, smoke_path)],
        'timeline_entries': entries, 'timeline_entry_count': len(entries),
        'duration_ms': sum(e['ms'] for e in entries),
        'hidden_swap_smoke_frame': 8, 'coverage_percent_at_swap': checks,
        'forms': forms, 'original_source_sha256': sources,
        'box_scale': box_scale, 'smoke_scale': common_scale,
        'canvas': list(SIZE),
        'smoke_extraction': 'Connected components assigned to source grid cells, with 15% padding for overlapping lobes. All smoke poses share one scale and -32px vertical registration.',
        'reuse': 'All forms use the identical box PNGs and smoke PNGs. Only original subject changes. Same smoke burst reused forwards for both swaps; no reverse or interpolation.',
        'processing': 'Equal grid crops, common scale per sheet, translation and composition of original artwork only. No program-drawn characters or effects.',
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'timeline_entries': len(entries), 'duration_ms': manifest['duration_ms'], 'coverage_percent_at_swap': checks}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--box-sheet', type=Path, required=True)
    parser.add_argument('--smoke-sheet', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    render(args.box_sheet.resolve(), args.smoke_sheet.resolve(), args.out.resolve())

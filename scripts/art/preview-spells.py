#!/usr/bin/env python3
"""Compose model-drawn spell keys with the original still Ram for review only.

This is a storyboard timing preview, not a game runtime or an extracted game
animation. Cells retain their full common canvas: no per-frame auto-cropping,
resizing, position normalization, or pretending these are original frames.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SPELLS = (('wind', '旋风术'), ('fire', '流火术'), ('ice', '寒冰术'), ('meteor', '陨石术'))
FONT_PATH = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'


def read_grid(path: Path, columns: int, rows: int) -> list[list[Image.Image]]:
    raw = Image.open(path)
    if 'A' not in raw.getbands():
        raise ValueError(f'{path}: 需要真实透明通道，不能使用不透明背景')
    im = raw.convert('RGBA')
    if im.getchannel('A').getextrema()[0] != 0:
        raise ValueError(f'{path}: 没有完全透明的背景像素')
    if im.width < columns * 32 or im.height < rows * 32:
        raise ValueError(f'{path}: 图像尺寸不足以拆分为 {columns}×{rows}')
    tiles = []
    for r in range(rows):
        row = []
        for c in range(columns):
            box = (round(c * im.width / columns), round(r * im.height / rows),
                   round((c + 1) * im.width / columns), round((r + 1) * im.height / rows))
            tile = im.crop(box)
            if sum(tile.getchannel('A').histogram()[16:]) < 20:
                raise ValueError(f'{path}: 第 {r + 1} 行第 {c + 1} 列没有有效内容，请补齐关键帧')
            row.append(tile)
        tiles.append(row)
    return tiles


def rescale_cells(cells: list[Image.Image], target=(310, 270)) -> list[Image.Image]:
    # One scale per entire sequence; preserve the relative size inside each cell.
    w, h = cells[0].size
    if any(abs(cell.width-w) > 1 or abs(cell.height-h) > 1 for cell in cells):
        raise ValueError('同一序列中的格子大小不一致')
    scale = min(target[0] / w, target[1] / h)
    size = (round(w * scale), round(h * scale))
    return [cell.resize(size, Image.Resampling.LANCZOS) for cell in cells]


def overlay(frame: Image.Image, layer: Image.Image, position: tuple[int, int], opacity: float = 1) -> Image.Image:
    out = frame.copy()
    if opacity < 1:
        layer = layer.copy()
        layer.putalpha(layer.getchannel('A').point(lambda value: round(value * opacity)))
    out.alpha_composite(layer, position)
    return out


def make_gif(name: str, title: str, cells: list[Image.Image], pet: Image.Image, output: Path) -> dict:
    w, h = 600, 360
    font = ImageFont.truetype(FONT_PATH, 20)
    small = ImageFont.truetype(FONT_PATH, 13)
    base = Image.new('RGBA', (w, h), '#fbf6e8')
    draw = ImageDraw.Draw(base)
    draw.text((22, 14), title, font=font, fill='#604625')
    draw.text((22, 333), '原角色静态素材 + 模型关键帧，时序为预览编排', font=small, fill='#806c53')
    base.alpha_composite(pet, (48, 111))
    cells = rescale_cells(cells)
    x = 280 + (310-cells[0].width)//2
    y = 48 + (270-cells[0].height)//2
    rendered = [overlay(base, c, (x, y)) for c in cells]
    # Deliberate holds and soft dissolves express intended rhythm. These are
    # composited model-drawn key poses, not separately drawn intermediate frames.
    frames = [base]
    durations = [160]
    for i, item in enumerate(rendered):
        if i:
            previous = cells[i-1]
            for alpha in (0.33, 0.67):
                a = overlay(base, previous, (x, y), 1-alpha)
                frames.append(overlay(a, cells[i], (x, y), alpha))
                durations.append(60)
        frames.append(item)
        durations.append(180 if i < len(rendered)-1 else 240)
    for alpha in (0.7, 0.4):
        frames.append(overlay(base, cells[-1], (x, y), alpha))
        durations.append(70)
    frames.append(base)
    durations.append(260)
    output.mkdir(parents=True, exist_ok=True)
    target = output / f'{name}.gif'
    frames[0].convert('RGB').save(target, save_all=True,
        append_images=[f.convert('RGB') for f in frames[1:]], duration=durations,
        loop=0, optimize=False, disposal=2)
    return {'file':target.name,'title':title,'model_keyframes':len(cells),
            'gif_frames':len(frames),'duration_ms':sum(durations),
            'pet':'public/assets/original/pets/middle-red-idle.png',
            'note':'原角色静态图与模型生成的透明关键帧合成；淡入淡出由程序编排，并非官方逐帧或应用实录。'}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--elements', required=True, type=Path, help='4×4 透明图：旋风、流火、寒冰、陨石各一行')
    parser.add_argument('--magic', required=True, type=Path, help='4×2 透明图：行优先排列 8 个魔术关键姿态')
    parser.add_argument('--out', required=True, type=Path, help='预览输出目录')
    args = parser.parse_args()
    elements = read_grid(args.elements, 4, 4)
    magic = read_grid(args.magic, 4, 2)
    pet = Image.open(ROOT / 'public/assets/original/pets/middle-red-idle.png').convert('RGBA')
    entries = [make_gif('magic', '魔术 · 帽子变花', sum(magic, []), pet, args.out)]
    for (name, title), row in zip(SPELLS, elements):
        entries.append(make_gif(name, title, row, pet, args.out))
    (args.out / 'preview-manifest.json').write_text(json.dumps({
        'preview_only':True, 'elements_sheet':str(args.elements), 'magic_sheet':str(args.magic),
        'animations':entries}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'已写入 {len(entries)} 个独立 GIF 和 preview-manifest.json：{args.out}')

if __name__ == '__main__':
    main()

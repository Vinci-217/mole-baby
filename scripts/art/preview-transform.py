#!/usr/bin/env python3
"""Review-only transformation GIFs made from image-model key poses.

Each row is one transformation; each of its four columns is a consecutive
pose. The full cell is kept at a constant scale and origin for the entire
row. The original static Ram bookends the model poses. Poses are timed as
discrete holds, not newly drawn frames or extracted official art.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[2]
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
RAM = ROOT / 'public/assets/original/pets/middle-red-idle.png'
KINDS = [('rabbit', '兔子变身'), ('bird', '小鸟变身'), ('tree', '小树变身')]


def split_grid(path: Path) -> list[list[Image.Image]]:
    img = Image.open(path)
    if 'A' not in img.getbands():
        raise ValueError(f'{path}: 缺少透明通道，不能作为透明帧表')
    img = img.convert('RGBA')
    a = img.getchannel('A')
    if a.getextrema()[0] != 0:
        raise ValueError(f'{path}: 背景没有完全透明的像素')
    # Model drawings may cross the nominal cell boundary. Label visible
    # components across the entire sheet, assign by their centre and include
    # padded regions, so the drawing is not sliced through the body.
    array = np.asarray(img)
    n, labels, stats, centers = cv2.connectedComponentsWithStats((array[:,:,3] > 32).astype('uint8'))
    groups = {(r, c): [] for r in range(3) for c in range(4)}
    for i in range(1,n):
        if stats[i, cv2.CC_STAT_AREA] < 16:
            continue
        x,y = centers[i]
        col=min(3, max(0, int(x*4/img.width)))
        row=min(2, max(0, int(y*3/img.height)))
        # Tiny isolated fragments at a cell border are usually pieces of the
        # preceding pose, rather than parts of this pose.
        if x-col*(img.width/4) < img.width/4*.04 and stats[i, cv2.CC_STAT_AREA] < 1500:
            continue
        groups[(row,col)].append(i)
    cell_w, cell_h = img.width/4, img.height/3
    padx, pady = round(cell_w*.17), round(cell_h*.17)
    rows = []
    for y in range(3):
        row = []
        for x in range(4):
            components=groups[(y,x)]
            if not components:
                raise ValueError(f'{path}: 第 {y+1} 行第 {x+1} 格缺少有效图像')
            keep=np.isin(labels,components).astype('uint8')
            keep=cv2.dilate(keep,np.ones((3,3),'uint8'))
            pixels=array.copy()
            pixels[:,:,3] *= keep
            # Outside-sheet padding is transparent. All cells keep the same
            # canvas and nominal centre; no pose-by-pose normalization.
            rect=(round(x*cell_w)-padx,round(y*cell_h)-pady,
                  round((x+1)*cell_w)+padx,round((y+1)*cell_h)+pady)
            cell=Image.fromarray(pixels).crop(rect)
            if sum(cell.getchannel('A').histogram()[32:]) < 50:
                raise ValueError(f'{path}: 第 {y+1} 行第 {x+1} 格缺少有效图像')
            row.append(cell)
        rows.append(row)
    return rows


def union_bounds(cells: list[Image.Image]) -> tuple[int, int, int, int]:
    bounds = []
    for cell in cells:
        # Ignore near-invisible antialiasing haze when establishing the anchor.
        alpha = cell.getchannel('A').point(lambda v: 255 if v >= 32 else 0)
        box = alpha.getbbox()
        if box:
            bounds.append(box)
    if not bounds:
        raise ValueError('序列没有可见像素')
    return (min(b[0] for b in bounds), min(b[1] for b in bounds),
            max(b[2] for b in bounds), max(b[3] for b in bounds))


def stage_frames(cells: list[Image.Image]) -> list[Image.Image]:
    # One shared bounding box and scaling per row: image-generator placement
    # stays unchanged between poses, preserving intentional size differences.
    box = union_bounds(cells)
    scale = min(240/(box[2]-box[0]), 220/(box[3]-box[1]))
    size = (round(cells[0].width*scale), round(cells[0].height*scale))
    x = round(240 - (box[0]+box[2])*scale/2)
    y = round(264 - box[3]*scale)
    layers = []
    for cell in cells:
        layer = Image.new('RGBA', (480, 330))
        scaled = cell.resize(size, Image.Resampling.LANCZOS)
        layer.alpha_composite(scaled, (x,y))
        layers.append(layer)
    return layers


def normal_ram() -> Image.Image:
    img = Image.open(RAM).convert('RGBA')
    img = img.crop(img.getbbox())
    img.thumbnail((180, 180), Image.Resampling.LANCZOS)
    layer = Image.new('RGBA', (480, 330))
    layer.alpha_composite(img, (240-img.width//2, 264-img.height))
    return layer


def render(name: str, title: str, cells: list[Image.Image], out: Path) -> dict:
    background = Image.new('RGBA', (480,330), '#fbf6e8')
    draw = ImageDraw.Draw(background)
    draw.text((18,12), title, font=ImageFont.truetype(FONT,20), fill='#604625')
    draw.text((18,303), '原角色 + 新绘关键姿态 · 预览编排', font=ImageFont.truetype(FONT,13), fill='#806c53')
    original = normal_ram()
    poses = stage_frames(cells)
    # Pose changes are deliberately discrete: transparent crossfades between
    # drawings with different eye locations create a disturbing doubled face.
    # Smoke in the model's second pose is the visual transition instead.
    sequence = [(original, 360), (poses[0], 220), (poses[1], 170),
                (poses[2], 260), (poses[3], 200), (poses[2], 180),
                (poses[3], 200), (poses[2], 230), (poses[1], 170),
                (poses[0], 200), (original, 360)]
    frames=[]
    for layer,_ in sequence:
        stage=background.copy()
        stage.alpha_composite(layer)
        frames.append(stage.convert('RGB'))
    out.mkdir(parents=True,exist_ok=True)
    file=out/f'{name}.gif'
    frames[0].save(file,save_all=True,append_images=frames[1:],duration=[d for _,d in sequence],
                   loop=0,optimize=False,disposal=2)
    return {'file':file.name,'title':title,'model_poses':len(cells),'gif_frames':len(frames),
            'duration_ms':sum(d for _,d in sequence),'role':'原拉姆静态原图作为首尾；模型姿态与定时编排用于候选预览，不是官方动画。'}


def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sheet',required=True,type=Path,help='透明图，4 列 × 3 行：兔子、小鸟、小树')
    parser.add_argument('--out',required=True,type=Path,help='仅用于预览的输出目录')
    args=parser.parse_args()
    rows=split_grid(args.sheet)
    entries=[render(name,title,row,args.out) for (name,title),row in zip(KINDS,rows)]
    (args.out/'manifest.json').write_text(json.dumps({'preview_only':True,'sheet':str(args.sheet),
       'random_selection':'本 GIF 集合不包含运行时随机逻辑', 'animations':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f'已生成 {len(entries)} 个变身 GIF: {args.out}')

if __name__ == '__main__':
    main()

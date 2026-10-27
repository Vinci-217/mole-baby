#!/usr/bin/env python3
"""Assemble three model-drawn 4x4 transformation sheets into preview GIFs.

Only makes previews. Original middle-red-idle is used at the beginning and
end; the 16 cells are model-drawn and already include return. No
invented in-between frames and no claim of official source animation.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
RAM = ROOT / 'public/assets/original/pets/middle-red-idle.png'
KINDS = [('rabbit','小兔变身'), ('bird','小鸟变身'), ('tree','小树变身')]


def split_grid(path: Path) -> list[Image.Image]:
    im=Image.open(path)
    if 'A' not in im.getbands(): raise ValueError(f'{path}: 需要透明通道')
    im=im.convert('RGBA'); arr=np.asarray(im)
    if arr[:,:,3].min()!=0: raise ValueError(f'{path}: 背景没有透明像素')
    n, labels, stats, centers=cv2.connectedComponentsWithStats((arr[:,:,3]>32).astype('uint8'))
    cw,ch=im.width/4,im.height/4
    groups={(y,x):[] for y in range(4) for x in range(4)}
    for i in range(1,n):
        if stats[i,cv2.CC_STAT_AREA]<10: continue
        x,y=centers[i]; col=min(3,max(0,int(x/cw))); row=min(3,max(0,int(y/ch)))
        groups[(row,col)].append(i)
    padx,pady=round(cw*.15),round(ch*.15); poses=[]
    for row in range(4):
        for col in range(4):
            group=groups[(row,col)]
            if not group: raise ValueError(f'{path}: 第 {row+1} 行第 {col+1} 列没有有效图像')
            keep=cv2.dilate(np.isin(labels,group).astype('uint8'),np.ones((3,3),'uint8'))
            pixels=arr.copy(); pixels[:,:,3]*=keep
            box=(round(col*cw)-padx,round(row*ch)-pady,round((col+1)*cw)+padx,round((row+1)*ch)+pady)
            cell=Image.fromarray(pixels).crop(box)
            if sum(cell.getchannel('A').histogram()[32:])<50: raise ValueError(f'{path}: 图 {row*4+col+1} 内容过少')
            poses.append(cell)
    return poses


def red_body_bounds(im: Image.Image) -> tuple[int, int, int, int]:
    a=np.asarray(im.convert('RGBA'))
    mask=(a[:,:,0]>200)&(a[:,:,1]<100)&(a[:,:,2]<100)&(a[:,:,3]>128)
    ys,xs=np.where(mask)
    if not len(xs): raise ValueError('帧缺少红色身体，无法对齐')
    return int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1


def place(cells: list[Image.Image]) -> list[Image.Image]:
    # One common scale for all poses. Align the center and bottom of the red
    # body, not the varying height of leaves, ears, wings or tree canopy.
    first=red_body_bounds(cells[0]); original=red_body_bounds(normal_ram())
    scale=(original[2]-original[0])/(first[2]-first[0])
    anchor_x=(original[0]+original[2])/2; anchor_y=original[3]
    size=(round(cells[0].width*scale),round(cells[0].height*scale))
    layers=[]
    for cell in cells:
        bounds=red_body_bounds(cell)
        x=round(anchor_x-(bounds[0]+bounds[2])*scale/2)
        y=round(anchor_y-bounds[3]*scale)
        layer=Image.new('RGBA',(480,330));layer.alpha_composite(cell.resize(size,Image.Resampling.LANCZOS),(x,y));layers.append(layer)
    return layers


def normal_ram() -> Image.Image:
    im=Image.open(RAM).convert('RGBA');im=im.crop(im.getbbox());im.thumbnail((180,180),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',(480,330));layer.alpha_composite(im,(240-im.width//2,264-im.height));return layer


def render(name:str,title:str,sheet:Path,out:Path)->dict:
    cells=split_grid(sheet);poses=place(cells);original=normal_ram()
    bg=Image.new('RGBA',(480,330),'#fbf6e8');draw=ImageDraw.Draw(bg)
    draw.text((18,12),title,font=ImageFont.truetype(FONT,20),fill='#604625')
    draw.text((18,303),'原角色 + 新绘姿态 · 完整演出预览',font=ImageFont.truetype(FONT,13),fill='#806c53')
    # All 16 poses include the transformation and return; play only forward.
    seq=[(original,320)]+[(pose,100 if index not in (8,9,10,11) else 140) for index,pose in enumerate(poses)]+[(original,320)]
    frames=[]
    for layer,_ in seq:
        f=bg.copy();f.alpha_composite(layer);frames.append(f.convert('RGB'))
    path=out/f'{name}.gif';frames[0].save(path,save_all=True,append_images=frames[1:],duration=[duration for _,duration in seq],loop=0,disposal=2,optimize=False)
    return {'file':path.name,'sheet':str(sheet),'model_drawn_poses':16,'gif_frames':len(frames),'duration_ms':sum(d for _,d in seq),'description':'原拉姆静态首尾，16 张模型新绘姿态依序播放（含变回）；无程序补帧，不是官方变身动画。'}


def main():
    ap=argparse.ArgumentParser();
    for name,_ in KINDS: ap.add_argument('--'+name,required=True,type=Path)
    ap.add_argument('--out',required=True,type=Path);args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    data=[render(n,t,getattr(args,n),args.out) for n,t in KINDS]
    (args.out/'manifest.json').write_text(json.dumps({'preview_only':True,'animations':data},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('Wrote',len(data),'transformation GIFs to',args.out)

if __name__=='__main__': main()

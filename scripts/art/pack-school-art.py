"""Compile model-drawn key poses into transparent prop animation atlases.
No character face/body is drawn here: the runtime uses original Ram frames.
"""
import argparse,json,math,hashlib
from pathlib import Path
import numpy as np,cv2
from PIL import Image,ImageDraw,ImageFont

p=argparse.ArgumentParser();p.add_argument('--magic',type=Path,required=True);p.add_argument('--furniture',type=Path,required=True);p.add_argument('--props',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args();out=a.repo/'public/assets/generated/school';(out/'clips').mkdir(parents=True,exist_ok=True);(out/'furniture').mkdir(exist_ok=True);(out/'icons').mkdir(exist_ok=True)
refs=a.repo/'skills/mole-classic-art/references/v38';refs.mkdir(parents=True,exist_ok=True)
def tiles(path,columns,rows):
 im=Image.open(path).convert('RGBA');arr=np.array(im);assert (arr[:,:,3]==0).mean()>.1,'Sheet must have true transparency'
 n,labels,stats,centres=cv2.connectedComponentsWithStats((arr[:,:,3]>32).astype('uint8'));groups={i:[] for i in range(columns*rows)}
 for i in range(1,n):
  if stats[i,4]<12:continue
  x,y=centres[i];col=min(columns-1,int(x/im.width*columns));row=min(rows-1,int(y/im.height*rows));groups[row*columns+col].append(i)
 result=[]
 for i in groups:
  keep=np.isin(labels,groups[i]).astype('uint8');keep=cv2.dilate(keep,np.ones((3,3),'uint8'));pixels=arr.copy();pixels[:,:,3]*=keep;piece=Image.fromarray(pixels);b=piece.getbbox();assert b,i;result.append(piece.crop(b))
 return result
fx=tiles(a.magic,4,4);furniture=tiles(a.furniture,3,3);props=tiles(a.props,3,3)
for name,path in [('elemental-keyframes.png',a.magic),('furniture-sheet.png',a.furniture),('study-service-keyframes.png',a.props)]:
 (refs/name).write_bytes(path.read_bytes())
fids=['leaf-rug','cushion','plant','bookcase','tea-table','lamp','leaf-clock','picture','certificate']
for name,im in zip(fids,furniture):
 im.thumbnail((320,320),Image.Resampling.LANCZOS);im.save(out/'furniture'/f'{name}.png',optimize=True)
font_paths=['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'];font=ImageFont.truetype(next(p for p in font_paths if Path(p).exists()),23)
def paste(canvas,im,x,y,width,angle=0,opacity=1,anchor='bottom'):
 image=im.copy();image.thumbnail((round(width),round(width*2)),Image.Resampling.LANCZOS)
 if angle:image=image.rotate(angle,Image.Resampling.BICUBIC,expand=True)
 if opacity<1:image.putalpha(image.getchannel('A').point(lambda v:round(v*max(0,opacity))))
 canvas.alpha_composite(image,(round(x-image.width/2),round(y-image.height if anchor=='bottom' else y-image.height/2)))
wand=Image.open(a.repo/'public/assets/original/wardrobe/star-wand.png').convert('RGBA');star=Image.open(a.repo/'public/assets/generated/v12-dizzy-star.png').convert('RGBA')
clips={};layouts={};before_pixels=0;after_pixels=0
for action in ['school-language','school-english','school-magic','restaurant','skill-language','skill-english','skill-magic','skill-wind','skill-fire','skill-ice','skill-meteor']:
 count=48 if action in ['school-language','school-english','school-magic','skill-language','skill-english'] else 72
 frames=[]
 for frame in range(count):
  t=frame/24;phase=frame/count;im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im)
  if action.startswith('school-') or action in ['skill-language','skill-english']:
   key=0 if frame<16 or frame>=44 else 1 if frame<28 else 2
   paste(im,props[key],128,224,112,math.sin(phase*2*math.pi)*1.5)
   words=['a','o','e'] if action=='school-language' else ['A','B','C'] if action in ['school-english','skill-english'] else ['★','✦','★'] if action=='school-magic' else ['你','好','呀']
   k=min(2,frame//16);age=(frame%16)/16;x=176+math.sin(age*math.pi)*12;y=126-age*17
   if action=='school-magic':paste(im,star,x,y,20,frame*3,opacity=max(0,math.sin(age*math.pi)),anchor='center')
   else:d.text((x,y),words[k],font=font,fill=(74,125,57,round(255*math.sin(age*math.pi))),anchor='mm',stroke_width=1)
   if action=='school-magic':paste(im,wand,72,165,35,math.sin(phase*2*math.pi)*12)
  elif action=='restaurant':
   # Carry the covered tray, present soup, then take away the empty dish.
   key=3 if frame<25 else 4 if frame<49 else 5
   x=200+4*math.sin(phase*2*math.pi);y=198+1.5*math.sin(phase*8*math.pi)
   paste(im,props[key],x,y,84)
   if 29<frame<45:paste(im,star,223,130-(frame-29)*.7,13,opacity=math.sin((frame-29)/16*math.pi))
  elif action=='skill-magic':
   key=6 if frame<22 else 7 if frame<41 else 8
   paste(im,props[key],199,223,90)
   if frame<50:paste(im,wand,77,155,44,-25+35*math.sin(min(1,phase*2)*math.pi))
   for i in range(3):
    if frame>25:paste(im,star,150+i*32,142-12*math.sin(phase*5+i),11+i*2,frame*4,opacity=max(0,math.sin(phase*math.pi)))
  else:
   kind=action[6:];row=['wind','fire','ice','meteor'].index(kind)
   if 10<=frame<68:
    key=0 if frame<23 else 1 if frame<36 else 2 if frame<51 else 3
    effect=fx[row*4+key].copy();arr=np.array(effect);yy,xx=np.indices(arr.shape[:2],dtype=np.float32)
    if kind in ['wind','fire']:
     # Bend internal ribbons/flames while the grounded effect stays anchored.
     amp=math.sin(t*9)*9;xx+=np.sin(yy/effect.height*math.pi)*amp
     if kind=='fire':yy+=np.sin(xx/effect.width*math.pi*3-t*8)*7*(1-yy/effect.height);effect=Image.fromarray(cv2.remap(arr,xx,yy,cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT))
    alpha=min(1,(frame-10)/5,(68-frame)/8);relative=effect.width/max(piece.width for piece in fx[row*4:row*4+4]);x,y=200,229
    if kind=='meteor' and key<2:
     fall=min(1,(frame-10)/26);x=221-21*fall;y=137+83*fall
    paste(im,effect,x,y,96*relative,opacity=alpha)
   if frame<37:paste(im,wand,76,156,42,-25+35*math.sin(min(1,phase*2)*math.pi))
  frames.append(im)
 boxes=[im.getbbox() for im in frames if im.getbbox()];bounds=(max(0,min(b[0] for b in boxes)-1),max(0,min(b[1] for b in boxes)-1),min(256,max(b[2] for b in boxes)+1),min(256,max(b[3] for b in boxes)+1));sw,sh=bounds[2]-bounds[0],bounds[3]-bounds[1]
 atlas=Image.new('RGBA',(sw*8,sh*math.ceil(count/8)))
 for i,im in enumerate(frames):
  part=im.crop(bounds);atlas.paste(part,(i%8*sw,i//8*sh));rebuilt=Image.new('RGBA',(256,256));rebuilt.paste(part,bounds[:2]);original=np.array(im);restored=np.array(rebuilt);assert np.array_equal(original[:,:,3],restored[:,:,3]) and np.array_equal(original[original[:,:,3]>0],restored[original[:,:,3]>0]),(action,i)
 layouts[action]={'cell':[sw,sh],'origin':list(bounds[:2]),'world':[256,256]};before_pixels+=count*256*256;after_pixels+=count*sw*sh
 atlas.save(out/'clips'/f'{action}.png',optimize=True);clips[action]={'frames':count,'fps':24,'keyPoses':3 if action in ['restaurant','skill-magic'] or action.startswith('school-') else 4,'source':'model-drawn prop keyframes; authored timing and internal follow-through; original character rendered separately'}
icons={'language':props[0],'english':props[1],'magic':props[8],'restaurant':props[3],**{k:fx[i*4+2] for i,k in enumerate(['wind','fire','ice','meteor'])}}
for name,im in icons.items():
 im=im.copy();im.thumbnail((112,112),Image.Resampling.LANCZOS);im.save(out/'icons'/f'{name}.png',optimize=True)
(out/'runtime.json').write_text(json.dumps(layouts,separators=(',',':'))+'\n')
(out/'source.json').write_text(json.dumps({'tool':'image_gen','date':'2026-10-26','referenceImages':['public/assets/original/scenes/ramu-home.png','public/assets/original/ui/reference-pet-panel.png','public/assets/original/items/180017.png','public/assets/original/pets/middle-red-idle.png'],'originalCharacterRedrawn':False,'officialMooreWarriorFrames':False,'note':'New spell designs following local Flash art references, not extracted or verified official Moore Warrior skill sequences. Props are drawn keyframes; temporal layout is authored.','decodedRGBA':{'before':before_pixels*4,'after':after_pixels*4,'verification':'Reconstructed world frames have identical alpha and visible RGBA; theoretical atlas decode area, not measured process/GPU memory.'},'clips':clips,'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in refs.glob('*.png')}},ensure_ascii=False,indent=2)+'\n')
print('Packed',len(clips),'transparent animation atlases, 9 furniture sprites and 8 icons; source keyframes kept outside client')

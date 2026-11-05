"""Review original eight-direction costume timelines; leaves raw SWFs untouched."""
from pathlib import Path
import copy,json,math,subprocess,hashlib,sys
import xml.etree.ElementTree as E
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from original_costume_timeline import Timeline,matrix,bounds,union
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'local-assets/research/wardrobe-directions';WORK.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'artifacts/wardrobe-motion-review';OUT.mkdir(parents=True,exist_ok=True)
FFDEC='/opt/jpexs/26.4.0/ffdec-cli.jar'
DIRECTIONS=[('down','正面'),('leftdown','左前'),('left','左侧'),('leftup','左后'),('up','背面'),('rightup','右后'),('right','右侧'),('rightdown','右前')]
ITEMS=[('flower-crown','1200006','鲜花花冠'),('knight-shield','1200024','骑士盾牌'),('angel-wings','1200040','天使羽翼')]
framesPerDirection=24;rows=[];receipt=[]
withBody='--with-body' in sys.argv
bodyTimeline=Timeline(ROOT/'local-assets/research/wardrobe-expansion/lamubone.xml') if withBody else None
registrations=json.loads((ROOT/'public/assets/original/wardrobe-motion/runtime.json').read_text())['outfits']
for name,sid,label in ITEMS:
 src=ROOT/f'local-assets/research/wardrobe-expansion/{sid}.xml';tl=Timeline(src);dirs,outer=tl.stage('middle')
 assert dirs and all(d in tl.labels(dirs) for d,_ in DIRECTIONS)
 poses=[];allBounds=[];bodyIds=set();holds=[];borrowedShapes={}
 for direction,_ in DIRECTIONS:
  previous=None
  for frame in range(1,framesPerDirection+1):
   shapes,_=tl.action(dirs,direction,frame,'cloth' if withBody else 'all');shapes=[(s,outer@m) for s,m in shapes]
   if withBody:
    baseShapes,_=bodyTimeline.action('1532',direction,3,'all');baseBody,_=bodyTimeline.action('1532',direction,3,'body');bb=union(bounds(bodyTimeline.ns[k],m) for k,m in baseBody)
    if bb is None:
     baseShapes,_=bodyTimeline.action('1532',direction,3,'all');baseBody,_=bodyTimeline.action('1532',direction,3,'body');bb=union(bounds(bodyTimeline.ns[k],m) for k,m in baseBody)
    originalBody,_=tl.action(dirs,direction,frame,'body');sb=union(bounds(tl.ns[k],outer@m) for k,m in originalBody) or bb
    sx=(bb[2]-bb[0])/(sb[2]-sb[0]);sy=(bb[3]-bb[1])/(sb[3]-sb[1]);B=np.array([[sx,0,bb[0]-sx*sb[0]],[0,sy,bb[1]-sy*sb[1]],[0,0,1.]])
    factor,localX,localY=registrations[name]['registrations']['middle']['adjustment'];cx=(sb[0]+sb[2])/2;top=sb[1];A=B@np.array([[factor,0,(1-factor)*cx+localX],[0,factor,(1-factor)*top+localY],[0,0,1.]])
    shapes=[(k,A@m) for k,m in shapes]
    if name=='knight-shield' and shapes:
     cb=union(bounds(tl.ns[k],m) for k,m in shapes);dx=(bb[0]+bb[2])/2+(bb[2]-bb[0])*.48-(cb[0]+cb[2])/2;dy=bb[1]+(bb[3]-bb[1])*.68-(cb[1]+cb[3])/2;shift=np.array([[1,0,dx],[0,1,dy],[0,0,1.]])
     shapes=[(k,shift@m) for k,m in shapes]
    if name=='flower-crown' and shapes:
     cb=union(bounds(tl.ns[k],m) for k,m in shapes);dx=(bb[0]+bb[2])/2-(cb[0]+cb[2])/2;dy=bb[1]-(bb[3]-bb[1])*.04-cb[3];shift=np.array([[1,0,dx],[0,1,dy],[0,0,1.]])
     shapes=[(k,shift@m) for k,m in shapes]
    combined=[]
    for k,m in baseShapes:
     n=bodyTimeline.ns[k]
     colors=[tuple(int(c.get(ch,0)) for ch in ('red','green','blue')) for c in n.iter('color')];bright=[c for c in colors if max(c)-min(c)>20]
     if name=='flower-crown' and bright and all(g>r*1.08 and g>b*1.08 for r,g,b in bright):continue
     newId=str(10000+int(k));borrowedShapes[newId]=n;combined.append((newId,m))
    bodyIds.update(str(10000+int(k)) for k,_ in baseBody);shapes=shapes+combined if name=='angel-wings' else combined+shapes
   if not shapes and previous:shapes=previous;holds.append([direction,frame])
   if shapes:previous=shapes
   assert shapes,(sid,direction,frame)
   poses.append(shapes);allBounds += [bounds(borrowedShapes.get(s,tl.ns.get(s)),m) for s,m in shapes]
   body,_=tl.action(dirs,direction,frame,'body');bodyIds.update(s for s,_ in body) if not withBody else None
 box=union(allBounds);scale=min(224/(box[2]-box[0]),220/(box[3]-box[1]));T=np.array([[scale,0,128-(box[0]+box[2])/2*scale],[0,scale,128-(box[1]+box[3])/2*scale],[0,0,1]])
 tree=copy.deepcopy(tl.tree);tags=tree.getroot().find('tags')
 for newId,shape in borrowedShapes.items():
  n=copy.deepcopy(shape);n.set('shapeId',newId);tags.append(n)
 for n in list(tags):
  if n.get('type') in ['DoABC2Tag','SymbolClassTag','ExportAssetsTag','PlaceObject2Tag','ShowFrameTag','DefineSceneAndFrameLabelDataTag']:tags.remove(n)
  if n.get('shapeId') in bodyIds:
   for c in n.iter('color'):
    rgb=[int(c.get(k,0)) for k in ['red','green','blue']]
    if rgb[0]==rgb[1]==rgb[2] and rgb[0] in [255,204,153]:
     for k,v,offset in zip(['red','green','blue'],rgb,[-215,-57,31]):c.set(k,str(max(0,min(255,v+offset))))
 master=tree.getroot();rect=master.find('displayRect');rect.set('Xmin','0');rect.set('Ymin','0');rect.set('Xmax','5120');rect.set('Ymax','5120');master.set('frameCount',str(len(poses)))
 node=E.SubElement(tags,'item',type='DefineSpriteTag',forceWriteAsLong='true',spriteId='30000',frameCount=str(len(poses)),hasEndTag='true');sub=E.SubElement(node,'subTags');maxDepth=0
 for shapes in poses:
  for depth in range(1,maxDepth+1):E.SubElement(sub,'item',type='RemoveObject2Tag',depth=str(depth),forceWriteAsLong='false')
  for depth,(shape,m) in enumerate(shapes,1):
   M=T@m;M[:2,:]*=20
   v=E.SubElement(sub,'item',type='PlaceObject2Tag',characterId=shape,depth=str(depth),forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasColorTransform='false',placeFlagHasMatrix='true',placeFlagHasName='false',placeFlagHasRatio='false',placeFlagMove='false')
   E.SubElement(v,'matrix',type='MATRIX',hasRotate='true',hasScale='true',nRotateBits='31',nScaleBits='31',nTranslateBits='31',scaleX=str(M[0,0]),scaleY=str(M[1,1]),rotateSkew0=str(M[1,0]),rotateSkew1=str(M[0,1]),translateX=str(round(M[0,2])),translateY=str(round(M[1,2])))
  maxDepth=len(shapes);E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false')
 place=E.SubElement(tags,'item',type='PlaceObject2Tag',characterId='30000',depth='1',forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasMatrix='false',placeFlagMove='false')
 for _ in poses:E.SubElement(tags,'item',type='ShowFrameTag',forceWriteAsLong='false')
 dest=WORK/(name+'-with-body' if withBody else name);dest.mkdir(exist_ok=True);xml=dest/'review.xml';swf=dest/'review.swf';tree.write(xml)
 with (dest/'export.log').open('w') as log:
  if '--reuse-render' not in sys.argv:subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',FFDEC,'-xml2swf',str(xml),str(swf)],stdout=log,stderr=log,check=True)
  if '--reuse-render' not in sys.argv:subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',FFDEC,'-ignorebackground','-export','frame',str(dest/'frames'),str(swf)],stdout=log,stderr=log,check=True)
 rows.append(dest/'frames');receipt.append({'id':sid,'name':label,'sourceSha256':hashlib.sha256(src.with_suffix('.swf').read_bytes()).hexdigest(),'sourceDirections':dict(DIRECTIONS),'sourceHolds':holds});print(name,'eight source directions exported',flush=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',18)
images=[]
for frame in range(framesPerDirection):
 im=Image.new('RGB',(1300,620),'#f6eedb');draw=ImageDraw.Draw(im)
 for col,(_,label) in enumerate(DIRECTIONS):draw.text((100+col*150+75,15),label,font=font,fill='#795332',anchor='mt')
 for row,((name,sid,label),folder) in enumerate(zip(ITEMS,rows)):
  draw.text((48,120+row*190),label,font=font,fill='#795332',anchor='mm')
  for col in range(8):
   part=Image.open(folder/f'{col*framesPerDirection+frame+1}.png').convert('RGBA');part.thumbnail((150,160),Image.Resampling.LANCZOS);im.paste(part,(100+col*150+(150-part.width)//2,40+row*190),part)
 images.append(im)
images[0].save(OUT/('assembled-eight-direction-outfits.gif' if withBody else 'original-costume-layers-eight-directions.gif'),save_all=True,append_images=images[1:],duration=round(1000/24),loop=0,optimize=True)
(OUT/('assembled-directions-source.json' if withBody else 'original-directions-source.json')).write_text(json.dumps({'items':receipt,'bodySource':{'path':'root/resource/NPC/lamubone.swf','sha256':hashlib.sha256((ROOT/'local-assets/raw/root/resource/NPC/lamubone.swf').read_bytes()).hexdigest()} if withBody else None,'withOriginalBody':withBody,'bodyAdaptation':'Original lamubone middle-stage neutral body pose (source frame 3), matching eight direction labels; crown kept above head and wings layered behind body to preserve the original face; original costume graphics mounted using desktop neutral registration. Shield uses the desktop body-side translation. This is an adapted assembled preview, not an original full-client recording.' if withBody else None,'adaptation':'Original vector display lists, all eight original directional labels, 24 sampled nested frames per direction. Shared full-figure fit and original blue body offsets; no added angles or redrawn clothing. This is a source comparison, not the desktop movement recording.'},ensure_ascii=False,indent=2)+'\n')

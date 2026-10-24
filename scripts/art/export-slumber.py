"""Export sleepy eyelids (not happy's smile eyes), original mouth and original Z.

The body/crown stay at their original normal registration. The mouth cycle is
an explicit desktop adaptation of source shape743; it is not a claimed official
sleep label. Requires Pillow, NumPy, Java and JPEXS 26.3.
"""
from pathlib import Path
import argparse,copy,json,subprocess,concurrent.futures,hashlib
import xml.etree.ElementTree as E
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--ordinary-xml',type=Path,required=True);p.add_argument('--sources',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True);out=a.repo/'public/assets/original/slumber';out.mkdir(parents=True,exist_ok=True)
CONFIG={
 'seed':(39,37,1,[4,9],[],None),
 'junior':(936,63,3,[4,7],[5,8],64),
 'middle':(1532,947,1,[3,5],[4,6],958),
 'senior':(1777,1534,1,[3,5],[6,7],1539),
 'super':(940,36,1,[4,8],[6,10],None),
 'water':(538,15,1,[4,8],[6,10],None),
 'wood':(1029,15,1,[4,8],[6,10],None),
 'fire':(898,25,1,[5,9],[7,11],None),
}
base=E.parse(a.ordinary_xml);base_ns={n.get('spriteId') or n.get('shapeId'):n for n in base.getroot().find('tags') if n.get('spriteId') or n.get('shapeId')}

def active(node,frame):
 state={};at=1
 for v in node.find('subTags'):
  kind=v.get('type','')
  if kind=='ShowFrameTag':
   if at==frame:break
   at+=1
  elif kind.startswith('PlaceObject'):
   depth=v.get('depth')
   if depth not in state or v.get('placeFlagMove')!='true':state[depth]=copy.deepcopy(v)
   else:
    old=state[depth];old.attrib.update(v.attrib)
    for c in v:
     prev=old.find(c.tag)
     if prev is not None:old.remove(prev)
     old.append(copy.deepcopy(c))
  elif kind=='RemoveObject2Tag':state.pop(v.get('depth'),None)
 for n in state.values():
  n.set('placeFlagMove','false');n.set('placeFlagHasCharacter','true')
  if n.find('matrix') is not None:n.set('placeFlagHasMatrix','true')
 return state

def freeze(node,state):
 old=node.find('subTags')
 if old is not None:node.remove(old)
 sub=E.SubElement(node,'subTags')
 for n in state.values():sub.append(n)
 E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false');node.set('frameCount','1')

def hide(n):
 n.set('placeFlagHasColorTransform','true');old=n.find('colorTransform')
 if old is not None:n.remove(old)
 E.SubElement(n,'colorTransform',type='CXFORMWITHALPHA',hasAddTerms='false',hasMultTerms='true',nbits='10',redMultTerm='256',greenMultTerm='256',blueMultTerm='256',alphaMultTerm='0',redAddTerm='0',greenAddTerm='0',blueAddTerm='0',alphaAddTerm='0')

def place(shape,depth,sx,sy,tx,ty,move=False):
 n=E.Element('item',type='PlaceObject2Tag',characterId=str(shape),depth=str(depth),forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasMatrix='true',placeFlagMove=str(move).lower(),placeFlagHasColorTransform='false',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasName='false',placeFlagHasRatio='false')
 E.SubElement(n,'matrix',type='MATRIX',hasRotate='false',hasScale='true',nRotateBits='0',nScaleBits='31',nTranslateBits='31',scaleX=str(sx),scaleY=str(sy),translateX=str(round(tx)),translateY=str(round(ty)))
 return n

def export(job):
 form,probe=job;root_id,body_id,body_frame,eyes,pupils,shadow=CONFIG[form];ordinary=form in ['seed','junior','middle','senior'];tree=copy.deepcopy(base) if ordinary else E.parse(a.sources/f'{form}.xml');tags=tree.getroot().find('tags');ns={n.get('spriteId') or n.get('shapeId'):n for n in tags if n.get('spriteId') or n.get('shapeId')};root=ns[str(root_id)]
 if form!='seed':
  old=list(root.find('subTags'));i=next(i for i,n in enumerate(old) if n.get('type')=='FrameLabelTag' and n.get('name')=='down');down=copy.deepcopy(next(n for n in old[i+1:] if n.get('characterId')))
  freeze(root,{'1':down})
 states={sid:active(n,body_frame if sid==str(body_id) else 1) for sid,n in ns.items() if n.get('type')=='DefineSpriteTag'}
 for sid,state in states.items():freeze(ns[sid],state)
 body=ns[str(body_id)];state=states[str(body_id)]
 if shadow:
  n=ns[str(shadow)].find("subTags/item[@depth='1']")
  if n is not None:hide(n)
 def bounds(sid):
  node=ns[sid];b=node.find('shapeBounds')
  if b is not None:return [float(b.get(k)) for k in ['Xmin','Ymin','Xmax','Ymax']]
  child=next(n for n in node.find('subTags') if n.get('characterId'));b=bounds(child.get('characterId'));m=child.find('matrix');return transform(b,m)
 def transform(b,m):
  sx=float(m.get('scaleX','1')) if m is not None and m.get('hasScale')=='true' else 1;sy=float(m.get('scaleY','1')) if m is not None and m.get('hasScale')=='true' else 1;r0=float(m.get('rotateSkew0','0')) if m is not None else 0;r1=float(m.get('rotateSkew1','0')) if m is not None else 0;tx=float(m.get('translateX','0')) if m is not None else 0;ty=float(m.get('translateY','0')) if m is not None else 0
  pts=[(x*sx+y*r1+tx,x*r0+y*sy+ty) for x in [b[0],b[2]] for y in [b[1],b[3]]];return [min(v[0] for v in pts),min(v[1] for v in pts),max(v[0] for v in pts),max(v[1] for v in pts)]
 eye_boxes=[transform(bounds(state[str(dep)].get('characterId')),state[str(dep)].find('matrix')) for dep in eyes];ex0=min(b[0] for b in eye_boxes);ex1=max(b[2] for b in eye_boxes);cx=sum((b[0]+b[2])/2 for b in eye_boxes)/2;cy=sum((b[1]+b[3])/2 for b in eye_boxes)/2;eh=sum(b[3]-b[1] for b in eye_boxes)/2
 for dep in [*eyes,*pupils]:hide(state[str(dep)])
 largest=max(map(int,ns));lid_id,mouth_id=largest+1,largest+2
 for original,new_id in [(35 if form=='seed' else 753 if form=='junior' else 1726,lid_id),(743,mouth_id)]:
  node=copy.deepcopy(base_ns[str(original)]);node.set('shapeId',str(new_id));tags.insert(0,node)
  if new_id==lid_id:
   # Keep the original sleepy curve, strengthen its ink at a 100px pet size.
   for color in node.iter('color'):
    for k,v in zip(['red','green','blue'],[91,56,39]):color.set(k,str(v))
  if new_id==mouth_id:
   # Source mouth silhouette, darkened for readability on all four body colours.
   for color in node.iter('color'):
    for k,v in zip(['red','green','blue'],[88,36,28]):color.set(k,str(v))
 lid=next(n for n in tags if n.get('shapeId')==str(lid_id));b=lid.find('shapeBounds');lx0,ly0,lx1,ly1=[float(b.get(k)) for k in ['Xmin','Ymin','Xmax','Ymax']];ls=(ex1-ex0)*.80/(lx1-lx0)
 sub=body.find('subTags');sub.insert(len(sub)-1,place(lid_id,60,ls,ls,cx-(lx0+lx1)/2*ls,cy-(ly0+ly1)/2*ls))
 mouth_width=(ex1-ex0)*.115;mx=mouth_width/532;my=mx*.58;mouth_y=cy+eh*(.48 if form=='seed' else .34)
 sub.remove(sub[-1])
 for frame,openness in enumerate([.02,.10,.23,.38,.55,.73,.9,1]):
  sy=my*openness;n=place(mouth_id,61,mx*(.72+.28*openness),sy,cx-266*mx*(.72+.28*openness),mouth_y-287*sy,frame>0);sub.append(n);E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false')
 body.set('frameCount','8')
 # Propagate the eight mouth frames through static original containers only.
 cache={}
 def length(sid):
  if sid in cache:return cache[sid]
  n=ns.get(sid)
  if n is None:return 1
  own=int(n.get('frameCount','1'));cache[sid]=own
  if own==1:own=max([own]+[length(v.get('characterId')) for v in n.iter() if v.get('characterId')])
  cache[sid]=own;return own
 for sid,n in ns.items():
  if n.get('frameCount')=='1':
   count=length(sid)
   for _ in range(count-1):E.SubElement(n.find('subTags'),'item',type='ShowFrameTag',forceWriteAsLong='false')
   n.set('frameCount',str(count))
 if probe:
  for n in tags:
   if not n.get('type','').startswith('DefineShape'):continue
   cols={tuple(int(c.get(k,'0')) for k in ['red','green','blue']) for c in n.iter('color')}
   if not ({(255,255,255),(204,204,204)}<=cols and cols<={(255,255,255),(204,204,204),(153,153,153)}):continue
   for c in n.iter('color'):
    key=tuple(int(c.get(k,'0')) for k in ['red','green','blue']);v={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}[key]
    for k,value in zip(['red','green','blue'],v):c.set(k,str(value))
 name=form+('-probe' if probe else '-neutral');xml=a.work/f'{name}.xml';swf=a.work/f'{name}.swf';tree.write(xml,encoding='utf-8',xml_declaration=True)
 with (a.work/f'{name}.log').open('w') as log:
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-xml2swf',str(xml),str(swf)],stdout=log,stderr=log,check=True)
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-selectid',str(root_id),'-select',f'{root_id}:1-8','-zoom','8','-ignorebackground','-export','sprite',str(a.work/name),str(swf)],stdout=log,stderr=log,check=True)
 print(name,'exported',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(export,[(f,probe) for f in CONFIG for probe in [False,True]]))

def coverage(n,p):
 a=np.asarray(n);d=a[:,:,:3].astype(float)-np.asarray(p)[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1);out=np.dstack([w*255,g*255,b*255,a[:,:,3]]).round().astype('uint8');out[a[:,:,3]==0]=0;return Image.fromarray(out)
metadata={'description':'Original sleepy eyelids from boring, original mouth silhouette743; a desktop breathing adaptation, not an official sleep clip.','eyes':{'seed':35,'junior':753,'other':1726},'mouth':743,'eyeInk':[91,56,39],'mouthInk':[88,36,28],'forms':{}}
for form,config in CONFIG.items():
 sid=config[0];nd=next((a.work/f'{form}-neutral').glob(f'DefineSprite_{sid}*'));pd=next((a.work/f'{form}-probe').glob(f'DefineSprite_{sid}*'));images=[Image.open(nd/f'{i}.png').convert('RGBA') for i in range(1,9)];masks=[coverage(im,Image.open(pd/f'{i+1}.png').convert('RGBA')) for i,im in enumerate(images)];target=Image.open(a.repo/('public/assets/original/seed/body-mask.png' if form=='seed' else f'public/assets/classic/{form}-mask.png')).convert('RGBA');w,h=(96,99) if form=='seed' else (192,208);target=np.asarray(target.crop((0,0,w,h)));source=np.asarray(masks[0]);sy,sx=np.where((source[:,:,:3].sum(2)>90)&(source[:,:,3]>150));ty,tx=np.where((target[:,:,:3].sum(2)>90)&(target[:,:,3]>150));scale=(tx.max()-tx.min()+1)/(sx.max()-sx.min()+1);dx=(tx.max()+tx.min()+1)/2-(sx.max()+sx.min()+1)/2*scale;dy=(ty.max()+1)-(sy.max()+1)*scale
 for kind,parts in [('neutral',images),('mask',masks)]:
  atlas=Image.new('RGBA',(w*8,h))
  for i,im in enumerate(parts):atlas.paste(im.transform((w,h),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),Image.Resampling.BICUBIC),(i*w,0))
  atlas.save(out/f'{form}-{kind}.png',optimize=True)
 mouth_diff=np.abs(np.asarray(images[7]).astype(int)-np.asarray(images[0]).astype(int)).sum(2)>30;yy,xx=np.where(mouth_diff);mouth_point=[((xx.min()+xx.max())/2*scale+dx)/w*100,((yy.min()+yy.max())/2*scale+dy)/h*100]
 metadata['forms'][form]={'cell':[w,h],'columns':8,'sourceSprite':sid,'scale':scale,'translation':[dx,dy],'mouthPoint':mouth_point,'snorePoint':[(tx.max()+1)/w*100+4,mouth_point[1]]}
# The Z glyph itself is original shape760, inside original sprite761.
source_swf=a.ordinary_xml.with_suffix('.swf')
if not source_swf.exists():
 source_swf=a.work/'original.swf'
 subprocess.run(['java','-Xmx512m','-Djava.awt.headless=true','-jar',a.ffdec,'-xml2swf',str(a.ordinary_xml),str(source_swf)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
subprocess.run(['java','-Xmx512m','-Djava.awt.headless=true','-jar',a.ffdec,'-selectid','761','-zoom','4','-ignorebackground','-export','sprite',str(a.work/'original-z'),str(source_swf)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
Image.open(next((a.work/'original-z').rglob('*.png'))).save(out/'z.png',optimize=True)
metadata['sourceFiles']=json.loads((a.repo/'public/assets/original/football/source.json').read_text())['sourceFiles']
metadata['z']={'sourceSprite':761,'shape':760}
(out/'source.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('*.png')},indent=2)+'\n')

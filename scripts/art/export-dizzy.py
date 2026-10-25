"""Export original normal bodies/eye whites and separate original pupil layers.

The body/crown stay at their original normal registration. Only the source
pupils are separated for smooth eye motion; this is a desktop adaptation. Requires Pillow, NumPy, Java and JPEXS 26.3.
"""
from pathlib import Path
import argparse,copy,json,subprocess,concurrent.futures,hashlib
import xml.etree.ElementTree as E
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--ordinary-xml',type=Path,required=True);p.add_argument('--sources',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--reuse-base',action='store_true');a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True);out=a.repo/'public/assets/original/dizzy';out.mkdir(parents=True,exist_ok=True)
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
 form,probe,part=job
 if a.reuse_base and part=='base' and list((a.work/(f'{form}-{part}'+('-probe' if probe else '-neutral'))).rglob('1.png')):return
 root_id,body_id,body_frame,eyes,pupils,shadow=CONFIG[form];ordinary=form in ['seed','junior','middle','senior'];tree=copy.deepcopy(base) if ordinary else E.parse(a.sources/f'{form}.xml');tags=tree.getroot().find('tags');ns={n.get('spriteId') or n.get('shapeId'):n for n in tags if n.get('spriteId') or n.get('shapeId')};root=ns[str(root_id)]
 if form!='seed':
  old=list(root.find('subTags'));i=next(i for i,n in enumerate(old) if n.get('type')=='FrameLabelTag' and n.get('name')=='down');down=copy.deepcopy(next(n for n in old[i+1:] if n.get('characterId')))
  freeze(root,{'1':down})
 states={sid:active(n,body_frame if sid==str(body_id) else 1) for sid,n in ns.items() if n.get('type')=='DefineSpriteTag'}
 for sid,state in states.items():freeze(ns[sid],state)
 body=ns[str(body_id)];state=states[str(body_id)]
 if shadow:
  n=ns[str(shadow)].find("subTags/item[@depth='1']")
  if n is not None:hide(n)

 # Separate the unchanged source whites/body from the original black pupils.
 # Seed eye sprite14 nests its pupil; the other forms place pupils directly.
 def two_frames(node,first,second):
  old=node.find('subTags');node.remove(old);sub=E.SubElement(node,'subTags')
  for state in [first,second]:
   for value in state.values():sub.append(value)
   E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false')
  node.set('frameCount','2')
 first=copy.deepcopy(state);second=copy.deepcopy(state)
 if form=='seed':
  eye=ns[first[str(eyes[0])].get('characterId')];eye_first=copy.deepcopy(states[eye.get('spriteId')]);eye_second=copy.deepcopy(eye_first)
  for depth,n in eye_first.items():
   if depth=='4':hide(n)
  for depth,n in eye_second.items():
   if depth!='4':hide(n)
  freeze(eye,eye_first if part=='base' else eye_second)
  for depth,n in second.items():
   if int(depth) not in eyes:hide(n)
   else:n.set('placeFlagMove','false')
 else:
  for depth in pupils:hide(first[str(depth)])
  for depth,n in second.items():
   if int(depth) not in pupils:hide(n)
 freeze(body,first if part=='base' else second)
 if part=='eyes':
  def path_to_body(sid,seen=None):
   if sid==str(body_id):return True
   if sid not in ns or ns[sid].find('subTags') is None:return False
   seen=set() if seen is None else set(seen)
   if sid in seen:return False
   seen.add(sid);items=[v for v in ns[sid].find('subTags')if v.get('characterId')]
   good=[v for v in items if path_to_body(v.get('characterId'),seen)]
   if not good:return False
   for v in items:
    if v not in good:hide(v)
   return True
  assert path_to_body(str(root_id))

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
 name=form+'-'+part+('-probe' if probe else '-neutral');xml=a.work/f'{name}.xml';swf=a.work/f'{name}.swf';tree.write(xml,encoding='utf-8',xml_declaration=True)
 with (a.work/f'{name}.log').open('w') as log:
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-xml2swf',str(xml),str(swf)],stdout=log,stderr=log,check=True)
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-selectid',str(root_id),'-select',f'{root_id}:1','-zoom','8','-ignorebackground','-export','sprite',str(a.work/name),str(swf)],stdout=log,stderr=log,check=True)
 print(name,'exported',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(export,[(f,probe,part) for f in CONFIG for probe in [False,True] for part in ['base','eyes']]))

def coverage(n,p):
 a=np.asarray(n);d=a[:,:,:3].astype(float)-np.asarray(p)[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1);out=np.dstack([w*255,g*255,b*255,a[:,:,3]]).round().astype('uint8');out[a[:,:,3]==0]=0;return Image.fromarray(out)
metadata={'description':'Unchanged original down body/eye whites and a separate original pupil layer. Smooth orbital eye motion is a desktop adaptation, not an official dizzy clip.','columns':2,'forms':{}}
for form,config in CONFIG.items():
 sid=config[0];images=[Image.open(next((a.work/f'{form}-{part}-neutral').rglob('1.png'))).convert('RGBA')for part in ['base','eyes']];masks=[coverage(im,Image.open(next((a.work/f'{form}-{part}-probe').rglob('1.png'))).convert('RGBA'))for im,part in zip(images,['base','eyes'])]
 target=Image.open(a.repo/('public/assets/original/seed/body-mask.png' if form=='seed' else f'public/assets/classic/{form}-mask.png')).convert('RGBA');w,h=(96,99) if form=='seed' else (192,208)
 target=np.asarray(target.crop((0,0,w,h)));source=np.asarray(masks[0]);sy,sx=np.where((source[:,:,:3].sum(2)>90)&(source[:,:,3]>150));ty,tx=np.where((target[:,:,:3].sum(2)>90)&(target[:,:,3]>150));scale=(tx.max()-tx.min()+1)/(sx.max()-sx.min()+1);dx=(tx.max()+tx.min()+1)/2-(sx.max()+sx.min()+1)/2*scale;dy=(ty.max()+1)-(sy.max()+1)*scale
 layers=[]
 for kind,parts in [('neutral',images),('mask',masks)]:
  atlas=Image.new('RGBA',(w*2,h))
  for i,im in enumerate(parts):
   view=im.transform((w,h),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),Image.Resampling.BICUBIC);atlas.paste(view,(i*w,0))
   if kind=='neutral':layers.append(view)
  atlas.save(out/f'{form}-{kind}.png',optimize=True)
 alpha=np.asarray(layers[1])[:,:,3];ys,xs=np.where(alpha>64)
 assert len(xs)>10 and len(xs)<w*h*.1,(form,'pupil layer must contain only the original pupils',len(xs))
 metadata['forms'][form]={'cell':[w,h],'sourceSprite':sid,'pupilBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],'orbit':[1.35 if form=='seed' else 2.7,1.05 if form=='seed' else 2.1],'scale':scale,'translation':[dx,dy]}
metadata['sourceFiles']=json.loads((a.repo/'public/assets/original/football/source.json').read_text())['sourceFiles']
(out/'source.json').write_text(json.dumps(metadata,indent=2)+'\n');(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest()for f in out.glob('*.png')},indent=2)+'\n')

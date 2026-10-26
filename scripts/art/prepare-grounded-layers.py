"""Export original middle body+leaves plates and exact vector face inbetweens.
Eyes/pupils/highlight use their original symbols and authored placement matrices.
"""
import argparse,copy,json,subprocess,concurrent.futures
from pathlib import Path
import xml.etree.ElementTree as E
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,required=True);p.add_argument('--probe',type=Path,required=True);p.add_argument('--original-frames',type=Path,required=True);p.add_argument('--clips',type=Path,required=True);p.add_argument('--ffdec',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
COUNT=17;views=['left','leftdown','down','rightdown','right'];specs=json.loads(a.clips.read_text())['middle']
def state_at(sprite,target):
 state={};frame=1
 for c in sprite.find('subTags'):
  kind=c.get('type','');depth=c.get('depth')
  if kind.startswith('Place'):
   if c.get('characterId') is not None and c.get('placeFlagMove')!='true':state[depth]=copy.deepcopy(c)
   else:
    old=copy.deepcopy(state.get(depth,c));old.attrib.update(c.attrib)
    for child in c:
     prev=old.find(child.tag)
     if prev is not None:old.remove(prev)
     old.append(copy.deepcopy(child))
    state[depth]=old
  elif kind.startswith('Remove'):state.pop(depth,None)
  elif kind=='ShowFrameTag':
   if frame==target:return state
   frame+=1
 raise ValueError(target)
def matrix(n):
 n=n.find('matrix')
 if n is None:return np.eye(3)
 return np.array([[float(n.get('scaleX',1)),float(n.get('rotateSkew1',0)),float(n.get('translateX',0))],[float(n.get('rotateSkew0',0)),float(n.get('scaleY',1)),float(n.get('translateY',0))],[0,0,1.]])
def ns(tree):return {n.get('spriteId') or n.get('shapeId'):n for n in tree.getroot().find('tags') if n.get('spriteId') or n.get('shapeId')}
def hide(n):
 n.set('placeFlagHasColorTransform','true');old=n.find('colorTransform')
 if old is not None:n.remove(old)
 E.SubElement(n,'colorTransform',type='CXFORMWITHALPHA',hasAddTerms='false',hasMultTerms='true',nbits='10',redMultTerm='256',greenMultTerm='256',blueMultTerm='256',alphaMultTerm='0',redAddTerm='0',greenAddTerm='0',blueAddTerm='0',alphaAddTerm='0')
def body_bottom(frame):
 nd=next((a.original_frames/'frames').glob('DefineSprite_1532_*'));pd=next((a.original_frames/'probe').glob('DefineSprite_1532_*'));n=np.array(Image.open(nd/f'{frame}.png').convert('RGBA'));q=np.array(Image.open(pd/f'{frame}.png').convert('RGBA'));d=n[:,:,:3].astype(float)-q[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1);y,x=np.where(((g+b+w)*255>90)&(n[:,:,3]>100));return int(y.max()+1)
def export(kind):
 tree=E.parse(a.probe if kind=='probe' else a.reference);nodes=ns(tree)
 if kind=='faces':
  master=E.SubElement(tree.getroot().find('tags'),'item',type='DefineSpriteTag',spriteId='7000',frameCount=str(COUNT*len(views)),hasEndTag='true',forceWriteAsLong='true');tags=E.SubElement(master,'subTags')
  invisible=E.SubElement(tags,'item',type='PlaceObject2Tag',characterId='1532',depth='100',placeFlagHasCharacter='true',placeFlagHasMatrix='true',placeFlagMove='false',forceWriteAsLong='false');E.SubElement(invisible,'matrix',type='MATRIX',hasScale='false',hasRotate='false',nTranslateBits='0',translateX='0',translateY='0');hide(invisible)
  for view in views:
   spec=specs[view];outer=state_at(nodes['1532'],spec['start'])['1'];direction=nodes[outer.get('characterId')];body=next(v for v in state_at(direction,1).values() if v.get('characterId') in ['947','967','979']);sprite=nodes[body.get('characterId')];sa,sb=state_at(sprite,1),state_at(sprite,5);parent=matrix(outer)@matrix(body);offset=(body_bottom(spec['start'])-body_bottom(spec['start']+4))/.6
   pairs=[];used={}
   for depth,part in sorted(sa.items(),key=lambda kv:int(kv[0])):
    if depth=='1':continue
    cid=part.get('characterId');candidates=[v for k,v in sorted(sb.items(),key=lambda kv:int(kv[0])) if k!='1' and v.get('characterId')==cid];ordinal=used.get(cid,0);used[cid]=ordinal+1;pairs.append((cid,parent@matrix(part),parent@matrix(candidates[ordinal])))
   for i in range(COUNT):
    t=i/(COUNT-1)
    for depth in range(1,7):E.SubElement(tags,'item',type='RemoveObject2Tag',depth=str(depth),forceWriteAsLong='false')
    for depth,(cid,ma,mb) in enumerate(pairs,1):
     m=ma*(1-t)+mb*t;m[1,2]+=offset*t
     place=E.SubElement(tags,'item',type='PlaceObject2Tag',characterId=cid,depth=str(depth),placeFlagHasCharacter='true',placeFlagHasMatrix='true',placeFlagMove='false',forceWriteAsLong='false')
     E.SubElement(place,'matrix',type='MATRIX',hasScale='true',hasRotate='true',nScaleBits='31',nRotateBits='31',nTranslateBits='31',scaleX=str(m[0,0]),scaleY=str(m[1,1]),rotateSkew0=str(m[1,0]),rotateSkew1=str(m[0,1]),translateX=str(round(m[0,2])),translateY=str(round(m[1,2])))
    E.SubElement(tags,'item',type='ShowFrameTag',forceWriteAsLong='false')
 else:
  for sid in ['947','967','979']:
   for child in nodes[sid].find('subTags'):
    if child.get('type','').startswith('Place') and child.get('depth')!='1':hide(child)
 xml=a.output/f'{kind}.xml';swf=a.output/f'{kind}.swf';tree.write(xml,encoding='utf-8',xml_declaration=True)
 with (a.output/f'{kind}.log').open('w') as log:
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',str(a.ffdec),'-xml2swf',str(xml),str(swf)],check=True,stdout=log,stderr=log)
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',str(a.ffdec),'-selectid','7000' if kind=='faces' else '1532','-zoom','12','-ignorebackground','-export','sprite',str(a.output/kind),str(swf)],check=True,stdout=log,stderr=log)
 print(kind,'original vector layers exported',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(export,['plate','probe','faces']))

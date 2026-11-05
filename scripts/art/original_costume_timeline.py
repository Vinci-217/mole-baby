"""Read original costume display lists without changing the archived SWFs."""
from pathlib import Path
import copy,re
import xml.etree.ElementTree as E
import numpy as np

FORMS={'seed':('junior','level1',936),'junior':('junior','level2',936),'middle':('middle','level3',1532),'senior':('senior','level4',1777),'super':('super','level101_7',940),'water':('water','level5_2',538),'wood':('wood','level5_4',1029),'fire':('fire','level5_1',898)}

def matrix(n):
 if n is None:return np.eye(3)
 return np.array([[float(n.get('scaleX',1)),float(n.get('rotateSkew1',0)),float(n.get('translateX',0))],[float(n.get('rotateSkew0',0)),float(n.get('scaleY',1)),float(n.get('translateY',0))],[0,0,1.]])
def bounds(n,m):
 b=n.find('shapeBounds')
 if b is None:return None
 pts=m@np.array([[float(b.get('Xmin')),float(b.get('Xmin')),float(b.get('Xmax')),float(b.get('Xmax'))],[float(b.get('Ymin')),float(b.get('Ymax')),float(b.get('Ymin')),float(b.get('Ymax'))],[1,1,1,1]])
 return [pts[0].min(),pts[1].min(),pts[0].max(),pts[1].max()]
def union(bs):
 bs=[b for b in bs if b is not None]
 return [min(b[0] for b in bs),min(b[1] for b in bs),max(b[2] for b in bs),max(b[3] for b in bs)] if bs else None
class Timeline:
 def __init__(self,path):
  self.tree=E.parse(path);self.tags=self.tree.getroot().find('tags');self.ns={n.get('spriteId') or n.get('shapeId') or n.get('characterID'):n for n in self.tags if n.get('spriteId') or n.get('shapeId') or n.get('characterID')};self.cache={};self.actions={};self.color={}
  self.cloth=set()
  for script in path.with_suffix('').rglob('*.as'):
   text=script.read_text();symbol=re.search(r'symbol(\d+)',text)
   if symbol and '"petBone3"'in text:self.cloth.add(symbol.group(1))
 def labels(self,sid):
  n=self.ns.get(sid);f=1;d={}
  if n is None or n.find('subTags') is None:return d
  for v in n.find('subTags'):
   if v.get('type')=='FrameLabelTag':d[v.get('name')]=f
   elif v.get('type')=='ShowFrameTag':f+=1
  return d
 def active(self,sid,age):
  key=(sid,age)
  if key in self.cache:return self.cache[key]
  n=self.ns[sid];own=int(n.get('frameCount',1));at=(age-1)%own+1 if own>1 else 1;state={};f=1
  for v in n.find('subTags'):
   t=v.get('type','')
   if t=='ShowFrameTag':
    if f==at:break
    f+=1
   elif t.startswith('PlaceObject'):
    dep=v.get('depth')
    if dep not in state or v.get('placeFlagMove')!='true':state[dep]=[copy.deepcopy(v),f]
    else:
     old=state[dep][0];character=old.get('characterId');old.attrib.update(v.attrib)
     if v.get('placeFlagHasCharacter')!='true' and character:old.set('characterId',character)
     if v.get('placeFlagHasCharacter')=='true':state[dep][1]=f
     for c in v:
      prev=old.find(c.tag)
      if prev is not None:old.remove(prev)
      old.append(copy.deepcopy(c))
   elif t=='RemoveObject2Tag':state.pop(v.get('depth'),None)
  result=[(v,(age if own==1 else at)-born+1) for v,born in state.values()];self.cache[key]=result;return result
 def flat(self,sid,age=1,m=None,inside=False,mode='all',seen=0):
  if seen>18:return []
  n=self.ns.get(sid)
  if n is None:return []
  m=np.eye(3) if m is None else m
  if n.get('shapeId'):
   colors=self.color.setdefault(sid,{tuple(int(c.get(k,0)) for k in ('red','green','blue')) for c in n.iter('color')})
   body={(255,255,255),(204,204,204)}<=colors and colors<={(255,255,255),(204,204,204),(153,153,153)}
   if mode=='body' and not body:return []
   if mode=='cloth' and self.cloth and not inside:return []
   if mode=='cloth' and not self.cloth:
    bright=[c for c in colors if max(c)-min(c)>20]
    if not bright or all(g>r*1.08 and g>b*1.08 for r,g,b in bright):return []
   return [(sid,m)]
  if n.find('subTags') is None:return []
  res=[]
  for v,childAge in self.active(sid,age):
   cid=v.get('characterId')
   if not cid:continue
   res+=self.flat(cid,childAge,m@matrix(v.find('matrix')),inside or sid in self.cloth or cid in self.cloth,mode,seen+1)
  return res
 def action(self,dirs,name,frame,mode):
  labels=self.labels(dirs);actual=name if name in labels else 'down'
  if actual not in labels:return [],actual
  values=self.active(dirs,labels[actual]);res=[]
  for v,_ in values:
   cid=v.get('characterId')
   if cid:res+=self.flat(cid,frame if actual==name else 3,matrix(v.find('matrix')),mode=mode)
  return res,actual
 def stage(self,form):
  candidates=[sid for sid in self.ns if 'level2'in self.labels(sid)];root=candidates[-1];labels=self.labels(root);label=FORMS[form][1]
  if label not in labels:label='level101' if form=='super' and 'level101'in labels else 'level2'
  def placed(stageLabel):
   # Some original labels precede the new rig by one ShowFrame. Selecting the
   # inherited display list at the label picks the previous stage instead.
   inside=False
   for v in self.ns[root].find('subTags'):
    if v.get('type')=='FrameLabelTag':
     if inside:break
     inside=v.get('name')==stageLabel
    if inside and v.get('type','').startswith('PlaceObject'):
     cid=v.get('characterId')
     if cid and 'down'in self.labels(cid):return cid,matrix(v.find('matrix'))
   return None
  return placed(label) or placed('level2') or (None,np.eye(3))

from pathlib import Path
import xml.etree.ElementTree as E,copy,subprocess,json,hashlib,concurrent.futures
import argparse
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--xml',type=Path,required=True);p.add_argument('--ffdec',required=True);args=p.parse_args()
base=args.work;src=args.xml;jar=args.ffdec;base.mkdir(parents=True,exist_ok=True)
r=E.parse(src);root=r.getroot();tags=root.find('tags');nodes={n.get('spriteId') or n.get('shapeId'):n for n in tags if n.get('spriteId') or n.get('shapeId')}
spec={}
cache={}
def deep_frames(sid,seen=None):
 if sid in cache:return cache[sid]
 node=nodes.get(sid);seen=set() if seen is None else set(seen)
 if node is None or sid in seen:return 1
 seen.add(sid);own=int(node.get('frameCount','1'))
 if own==1:
  own=max([own]+[deep_frames(n.get('characterId'),seen) for n in node.iter() if n.get('characterId')])
 cache[sid]=own;return own
for sid,node in nodes.items():
 if node.get('type')=='DefineSpriteTag' and int(node.get('frameCount','1'))==1:
  length=deep_frames(sid)
  for _ in range(length-1):E.SubElement(node.find('subTags'),'item',type='ShowFrameTag',forceWriteAsLong='false')
  node.set('frameCount',str(length))

for form,sid in [('junior','936'),('middle','1532')]:
 sp=nodes[sid];old=list(sp.find('subTags'));clips=[];start=1
 for action in ['down','right','left']:
  i=next(i for i,n in enumerate(old) if n.get('type')=='FrameLabelTag' and n.get('name')==action)
  place=next(n for n in old[i+1:] if n.get('type')=='PlaceObject2Tag');length=deep_frames(place.get('characterId'))
  clips.append((action,place,length));spec.setdefault(form,{'spriteId':int(sid),'clips':[]})['clips'].append({'action':action,'childSprite':int(place.get('characterId')),'start':start,'length':length});start+=length
 new=E.Element('subTags')
 for action,place,length in clips:
  E.SubElement(new,'item',type='RemoveObject2Tag',depth='1',forceWriteAsLong='false')
  new.append(copy.deepcopy(place))
  for _ in range(length):E.SubElement(new,'item',type='ShowFrameTag',forceWriteAsLong='false')
 sp.remove(sp.find('subTags'));sp.append(new);sp.set('frameCount',str(start-1))
r.write(base/'neutral.xml',encoding='utf-8',xml_declaration=True)
body=set()
for sid,n in nodes.items():
 if n.get('type','').startswith('DefineShape'):
  colors={tuple(int(c.get(k,0)) for k in ['red','green','blue']) for c in n.iter('color')}
  if colors=={(255,255,255),(204,204,204)}:body.add(sid)
roots={n.get('characterId') for n in root.iter() if n.get('name')=='petBody'}
for sid,n in nodes.items():
 if n.get('type')=='DefineSpriteTag' and any(v.get('characterId') in body for v in n.iter()):roots.add(sid)
seen=set()
def visit(sid):
 if sid in seen or sid not in nodes:return
 seen.add(sid)
 for n in nodes[sid].iter():
  if n.get('characterId'):visit(n.get('characterId'))
for sid in roots:visit(sid)
for sid in seen:
 n=nodes[sid]
 if not n.get('type','').startswith('DefineShape') or sid in {'10','413','422'}:continue
 for c in n.iter('color'):
  key=tuple(int(c.get(k,0)) for k in ['red','green','blue']);v={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}.get(key)
  if v:
   for k,value in zip(['red','green','blue'],v):c.set(k,str(value))
r.write(base/'probe.xml',encoding='utf-8',xml_declaration=True)
(base/'clips.json').write_text(json.dumps(spec,indent=2)+'\n')
def render(variant):
 with (base/(variant+'.log')).open('w') as log:
  subprocess.run(['java','-Djava.awt.headless=true','-jar',jar,'-xml2swf',str(base/(variant+'.xml')),str(base/(variant+'.swf'))],stdout=log,stderr=log,check=True)
  subprocess.run(['java','-Djava.awt.headless=true','-jar',jar,'-selectid','936,1532','-select','936:1-45,1532:1-48','-zoom','4','-ignorebackground','-export','sprite',str(base/variant),str(base/(variant+'.swf'))],stdout=log,stderr=log,check=True)
 print(variant,'done',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(render,['neutral','probe']))
print(json.dumps(spec),flush=True)

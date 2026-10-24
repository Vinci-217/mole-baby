"""Export complete ORIGINAL football/boring/happy timelines for inspection/packing.

No expression transplant. Body-colour probes change only the source body fills.
Requires JPEXS 26.3; see original/football/README.md for exact source hashes.
"""
from pathlib import Path
import argparse,copy,json,subprocess,concurrent.futures
import xml.etree.ElementTree as E
p=argparse.ArgumentParser();p.add_argument('--ordinary-xml',type=Path,required=True);p.add_argument('--sources',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--actions',default='football,boring,happy');a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
IDS={'ordinary': [('junior','936'),('middle','1532'),('senior','1777')],'super':[('super','940')],'water':[('water','538')],'wood':[('wood','1029')],'fire':[('fire','898')]}
def export(form):
 r=E.parse(a.ordinary_xml if form=='ordinary' else a.sources/f'{form}.xml');ns={n.get('spriteId') or n.get('shapeId'):n for n in r.getroot().find('tags') if n.get('spriteId') or n.get('shapeId')};cache={}
 def length(sid):
  if sid in cache:return cache[sid]
  n=ns.get(sid)
  if n is None:return 1
  count=int(n.get('frameCount','1'));cache[sid]=count
  if count==1:count=max([count]+[length(v.get('characterId')) for v in n.iter() if v.get('characterId')])
  cache[sid]=count;return count
 for sid,n in ns.items():
  if n.get('frameCount')=='1':
   count=length(sid)
   for _ in range(count-1):E.SubElement(n.find('subTags'),'item',type='ShowFrameTag',forceWriteAsLong='false')
   n.set('frameCount',str(count))
 specs={}
 for name,sid in IDS[form]:
  node=ns[sid];old=list(node.find('subTags'));node.remove(node.find('subTags'));tags=E.SubElement(node,'subTags');start=1;specs[name]={}
  for action in a.actions.split(','):
   i=next(i for i,v in enumerate(old) if v.get('type')=='FrameLabelTag' and v.get('name')==action);place=copy.deepcopy(next(v for v in old[i+1:] if v.get('characterId')));count=length(place.get('characterId'));specs[name][action]={'start':start,'count':count,'child':place.get('characterId')}
   E.SubElement(tags,'item',type='RemoveObject2Tag',depth='1',forceWriteAsLong='false');tags.append(place)
   for _ in range(count):E.SubElement(tags,'item',type='ShowFrameTag',forceWriteAsLong='false')
   start+=count
  node.set('frameCount',str(start-1))
 (a.work/('clips.json' if form=='ordinary' else f'{form}-clips.json')).write_text(json.dumps(specs if form=='ordinary' else specs[form],indent=2)+'\n')
 for probe in [False,True]:
  tree=copy.deepcopy(r)
  if probe:
   for n in tree.getroot().find('tags'):
    if not n.get('type','').startswith('DefineShape'):continue
    colors={tuple(int(c.get(k,'0')) for k in ['red','green','blue']) for c in n.iter('color')}
    if not ({(255,255,255),(204,204,204)}<=colors and colors<={(255,255,255),(204,204,204),(153,153,153)}):continue
    for c in n.iter('color'):
     key=tuple(int(c.get(k,'0')) for k in ['red','green','blue']);new={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}[key]
     for k,v in zip(['red','green','blue'],new):c.set(k,str(v))
  name=f'{form}-probe' if probe else 'reference' if form=='ordinary' else f'{form}-reference';xml=a.work/f'{name}.xml';swf=a.work/f'{name}.swf';dest=a.work/(f'{form}-probe-frames' if probe else 'frames' if form=='ordinary' else f'{form}-frames');tree.write(xml,encoding='utf-8',xml_declaration=True)
  with (a.work/f'{name}.log').open('w') as log:
   subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-xml2swf',str(xml),str(swf)],stdout=log,stderr=log,check=True)
   subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-selectid',','.join(sid for _,sid in IDS[form]),'-zoom','4','-ignorebackground','-export','sprite',str(dest),str(swf)],stdout=log,stderr=log,check=True)
  print(form,'probe' if probe else 'neutral','exported',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(export,IDS))

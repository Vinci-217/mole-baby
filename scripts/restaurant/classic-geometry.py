#!/usr/bin/env python3
"""Original child/layer transforms and live restaurant-name text rectangles."""
import json,xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def matrix(n):
 m=n.find('matrix');return {'x':int(m.get('translateX','0'))/20,'y':int(m.get('translateY','0'))/20,'sx':float(m.get('scaleX','1')),'sy':float(m.get('scaleY','1'))}
result={}
for f in (ROOT/'local-assets/research/restaurant-port/rendered/room').glob('*/source.xml'):
 tags=E.parse(f).getroot().find('tags');sprites={n.get('spriteId'):n for n in tags if n.get('spriteId')};edits={n.get('characterID'):n for n in tags if n.get('type')=='DefineEditTextTag'};items={}
 for layer in tags:
  if layer.get('name')not in ['control_mc','depth_mc','buttonLevel']:continue
  parent=matrix(layer)
  for n in sprites[layer.get('characterId')].find('subTags'):
   if not n.get('name')or n.find('matrix')is None:continue
   m=matrix(n);p={'x':parent['x']+m['x']*parent['sx'],'y':parent['y']+m['y']*parent['sy'],'sx':m['sx']*parent['sx'],'sy':m['sy']*parent['sy']};items[n.get('name')]=p
   if n.get('name')=='myNameMc':
    for t in sprites[n.get('characterId')].find('subTags'):
     if t.get('name')!='nameTxt':continue
     text=edits[t.get('characterId')];r=text.find('bounds');m=matrix(t)
     p['text']={'x':p['x']+(m['x']+int(r.get('Xmin'))/20)*p['sx'],'y':p['y']+(m['y']+int(r.get('Ymin'))/20)*p['sy'],'w':(int(r.get('Xmax'))-int(r.get('Xmin')))/20*p['sx'],'h':(int(r.get('Ymax'))-int(r.get('Ymin')))/20*p['sy'],'font':int(text.get('fontHeight'))/20}
 result[f.parent.name]=items
print(json.dumps(result))

#!/usr/bin/env python3
"""Export original stove states, stage hit areas, menu and HUD without editing raw SWFs."""
import json,subprocess,xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'local-assets/research/restaurant-port';OUT=BASE/'classic-ui';CP=f'{ROOT}/local-assets/tools:/opt/jpexs/26.4.0/lib/*';OUT.mkdir(exist_ok=True)
def java(*args):return subprocess.run(['java','-Xmx450m','-Djava.awt.headless=true','-cp',CP,'SourceExporter',*map(str,args)],check=True,stdout=subprocess.DEVNULL)
def adapt(tree,out):
 path=OUT/(out+'.xml');tree.write(path,encoding='utf-8',xml_declaration=True);swf=path.with_suffix('.swf');java('xml2swf',path,swf);return swf
def strip_text(tree):
 edits={n.get('characterID',n.get('characterId'))for n in tree.getroot().iter()if n.get('type')=='DefineEditTextTag'}-{None}
 for tags in tree.getroot().iter():
  for n in list(tags):
   if 'PlaceObject'in n.get('type','')and n.get('characterId')in edits:tags.remove(n)
def mat(node):
 m=node.find('matrix');return dict(x=int(m.get('translateX','0'))/20,y=int(m.get('translateY','0'))/20,sx=float(m.get('scaleX','1')),sy=float(m.get('scaleY','1')))
jobs=[];layouts={};
def job(key,source,sid,frames='0',zoom='1',render=True):jobs.append('\t'.join([key,str(source),str(OUT/key)if render else '-',str(sid),frames,zoom]))
module=E.parse(BASE/'restaurant.xml');strip_text(module)
for tags in module.getroot().iter():
 for n in list(tags):
  if 'PlaceObject'in n.get('type','')and n.get('name')in {'levelNumMcTips','houseFavorTips','moneyMcTips','empPhone','levelMc'}:tags.remove(n)
for n in module.getroot().find('tags'):
 if n.get('spriteId')=='675':
  for t in list(n.find('subTags')):
   if 'PlaceObject'in t.get('type','')and t.get('name')not in {'myMenu','houseLevel','houseFavor','moneyMc'}:n.find('subTags').remove(t)
adapted=adapt(module,'module-clean');job('hud',adapted,675)
for name,sid in [('employee-menu',520),('level-numbers',552)]:job(name,adapted,sid,'all' if sid==552 else '0')
for name,sid in [('cmdBtn',460),('menuBtn',468),('goBtn',482),('bookBtn',491),('activeBtn',496)]:job('hud-hit/'+name,adapted,sid,render=False)
for key,sid,frames in [('clock',432,'0,1'),('clock-steps',424,'all'),('prepare',440,'all'),('thought',448,'0')]:job(key,adapted,sid,frames)
menu=E.parse(OUT/'menu.xml');strip_text(menu)
for tags in menu.getroot().iter():
 for n in list(tags):
  if 'PlaceObject'in n.get('type','')and n.get('name','').startswith('num'):tags.remove(n)
menu_swf=adapt(menu,'menu-clean');job('menu-clean-frame',menu_swf,67);job('menu-tooltip',menu_swf,64,'0,1')
for a in json.load(open(BASE/'playable-assets.json')):
 if '/restaurant/swf/' in a['path']:job('states/'+Path(a['path']).stem,ROOT/a['local'],-1,'0,1,2,3,4,5','2')
 if '/oneBigStree/'not in a['path']:continue
 id=Path(a['path']).stem;tree=E.parse(BASE/'rendered/room'/id/'source.xml');strip_text(tree);tags=tree.getroot().find('tags');nodes={n.get('spriteId'):n for n in tags if n.get('spriteId')};layers={n.get('name'):n for n in tags if 'PlaceObject'in n.get('type','')}
 layout={};
 for layer in ['depth_mc','buttonLevel','control_mc']:
  for n in nodes[layers[layer].get('characterId')].find('subTags'):
   name=n.get('name','');sid=n.get('characterId');m=n.find('matrix')
   if not sid or m is None:continue
   if name.startswith(('zaoBtn','taiBtn','foodTable','shuo','tablePoint','point','movePoint'))or name in ['joinMc','myNameMc']:
    layout[name]={**mat(n),'sprite':int(sid),'layer':mat(layers[layer])};job(f'geometry/{id}-{name}',ROOT/a['local'],sid,render=False)
   if name=='joinMc':job(f'signs/{id}',ROOT/a['local'],sid,'0,1')
   if name.startswith('shuo')and id=='1330004':job('pointer',ROOT/a['local'],sid)
 # Hide source "click stove" pointers only; reinsert them for empty stoves at runtime.
 for parent in tree.getroot().iter():
  for n in list(parent):
   if 'PlaceObject'in n.get('type','')and n.get('name','').startswith('shuo'):parent.remove(n)
 control=nodes[layers['control_mc'].get('characterId')].find('subTags')
 for n in list(control):
  if 'PlaceObject'in n.get('type','')and n.get('name')!='myNameMc':control.remove(n)
 for n in list(tags):
  if 'PlaceObject'in n.get('type','')and n.get('name')not in {'bg_mc','depth_mc','top_mc','control_mc'}:tags.remove(n)
 room=adapt(tree,'room-'+id);job('rooms/'+id,room,0)
 layouts[id]=layout
(OUT/'layouts.json').write_text(json.dumps(layouts,ensure_ascii=False,indent=2)+'\n')
(OUT/'jobs.tsv').write_text('\n'.join(dict.fromkeys(jobs))+'\n')
print('Prepared',len(jobs),'original art and geometry exports',flush=True)

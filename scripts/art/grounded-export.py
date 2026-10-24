from pathlib import Path
import xml.etree.ElementTree as E,copy,subprocess,json,concurrent.futures
import argparse
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--ffdec',required=True);args=p.parse_args()
base=args.work;jar=args.ffdec
original=E.parse(base/'neutral.xml');root=original.getroot();nodes={n.get('spriteId') or n.get('shapeId'):n for n in root.find('tags') if n.get('spriteId') or n.get('shapeId')}
forms={'junior':{'parent':'64','body':'63','eyeDepths':(4,7),'pupilDepths':(5,8),'frame':3},'middle':{'parent':'958','body':'947','eyeDepths':(3,5),'pupilDepths':(4,6),'frame':1}}
def active_at(sprite,frame):
 out={};f=1
 for p in sprite.find('subTags'):
  kind=p.get('type')
  if kind=='ShowFrameTag':
   if f==frame:break
   f+=1
  elif kind.startswith('PlaceObject'):
   dep=int(p.get('depth'));old=out.get(dep)
   if old is None or p.get('placeFlagMove')!='true':out[dep]=copy.deepcopy(p)
   else:
    old.attrib.update(p.attrib)
    for child in p:
     prev=old.find(child.tag)
     if prev is not None:old.remove(prev)
     old.append(copy.deepcopy(child))
  elif kind=='RemoveObject2Tag':out.pop(int(p.get('depth')),None)
 for p in out.values():
  p.set('placeFlagMove','false');p.set('placeFlagHasCharacter','true')
  if p.find('matrix') is not None:p.set('placeFlagHasMatrix','true')
  if p.find('colorTransform') is not None:p.set('placeFlagHasColorTransform','true')
 return out
for form,info in forms.items():
 state=active_at(nodes[info['body']],info['frame']);info['eyes']=[]
 for depth in info['eyeDepths']:
  p=state[depth];shape=nodes[p.get('characterId')];bounds=shape.find('shapeBounds');m=p.find('matrix');sx=float(m.get('scaleX','1'));sy=float(m.get('scaleY','1'))
  x=float(m.get('translateX','0'))+sx*(int(bounds.get('Xmin'))+int(bounds.get('Xmax')))/2;y=float(m.get('translateY','0'))+sy*(int(bounds.get('Ymin'))+int(bounds.get('Ymax')))/2
  info['eyes'].append({'cx':x,'cy':y,'width':abs(sx)*(int(bounds.get('Xmax'))-int(bounds.get('Xmin')))})
# Use each canonical source pose directly, with all source placements retained.
for form,info in forms.items():
 sp=nodes[info['body']];sp.remove(sp.find('subTags'));tags=E.SubElement(sp,'subTags')
 for p in active_at(E.parse(base/'neutral.xml').getroot().find('tags').find(f"item[@spriteId='{info['body']}']"),info['frame']).values():tags.append(p)
 E.SubElement(tags,'item',type='ShowFrameTag',forceWriteAsLong='false');sp.set('frameCount','1')
# Root holds the original down placement, which is the first flattened frame.
for form,sid in [('junior','936'),('middle','1532')]:
 sp=nodes[sid];p=next(p for p in sp.find('subTags') if p.get('type')=='PlaceObject2Tag');sp.remove(sp.find('subTags'));tags=E.SubElement(sp,'subTags');tags.append(copy.deepcopy(p));E.SubElement(tags,'item',type='ShowFrameTag',forceWriteAsLong='false');sp.set('frameCount','1')
 original_parent=nodes[forms[form]['parent']]
 # Shadow is an independent original sprite, excluded without changing bounds.
 forms[form]['shadowDepth']=1

def hide(p):
 p.set('placeFlagHasColorTransform','true');old=p.find('colorTransform')
 if old is not None:p.remove(old)
 E.SubElement(p,'colorTransform',type='CXFORMWITHALPHA',hasAddTerms='false',hasMultTerms='true',nbits='10',redMultTerm='256',greenMultTerm='256',blueMultTerm='256',alphaMultTerm='0',redAddTerm='0',greenAddTerm='0',blueAddTerm='0',alphaAddTerm='0')
def variant(kind,probe):
 tree=copy.deepcopy(original);ns={n.get('spriteId') or n.get('shapeId'):n for n in tree.getroot().find('tags') if n.get('spriteId') or n.get('shapeId')}
 for form,info in forms.items():
  body=ns[info['body']];tags=body.find('subTags')
  for p in ns[info['parent']].find('subTags'):
   if not p.get('type','').startswith('Place'):continue
   if p.get('depth')=='1' or (form=='middle' and p.get('depth')=='10' and kind!='leaves') or (kind=='leaves' and p.get('characterId')==info['body']):hide(p)
  for p in tags:
   if not p.get('type','').startswith('Place'):continue
   depth=int(p.get('depth'))
   if kind=='leaves' or kind=='open' and depth in info['pupilDepths'] or kind=='closed' and depth in (*info['eyeDepths'],*info['pupilDepths']) or kind=='pupils' and depth not in info['pupilDepths']:hide(p)
   if kind=='half' and depth in (*info['eyeDepths'],*info['pupilDepths']):
    index=0 if depth in (info['eyeDepths'][0],info['pupilDepths'][0]) else 1;cy=info['eyes'][index]['cy'];m=p.find('matrix');m.set('hasScale','true');m.set('scaleY',str(float(m.get('scaleY','1'))*.55));m.set('translateY',str(round(cy+(float(m.get('translateY','0'))-cy)*.55)));m.set('nScaleBits','31');m.set('nTranslateBits','31')
  if kind=='leaves' and form=='junior':
   for p in tags:
    if p.get('type','').startswith('Place'):hide(p)
  if kind=='closed':
   # Original happy's closed eye shape 665, positioned at the current eyes.
   for i,eye in enumerate(info['eyes']):
    scale=eye['width']*.62/334;p=E.Element('item',type='PlaceObject2Tag',characterId='665',depth=str(20+i),forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasColorTransform='false',placeFlagHasMatrix='true',placeFlagHasName='false',placeFlagHasRatio='false',placeFlagMove='false')
    E.SubElement(p,'matrix',type='MATRIX',hasRotate='false',hasScale='true',nRotateBits='0',nScaleBits='31',nTranslateBits='31',scaleX=str(scale),scaleY=str(scale),translateX=str(round(eye['cx']+206*scale)),translateY=str(round(eye['cy']+15.5*scale)))
    tags.insert(len(tags)-1,p)
 if probe:
  # Same original body-colour probe/exclusions as the existing care exports.
  for sid,n in ns.items():
   if not n.get('type','').startswith('DefineShape') or sid in {'10','413','422','665'}:continue
   orig=nodes[sid];old=list(orig.iter('color'));new=list(n.iter('color'))
   # Determine body eligibility from the proven probe's matching source definition.
   probe_node=probe_nodes.get(sid)
   if probe_node is not None:
    for c,pc in zip(new,probe_node.iter('color')):c.attrib.update(pc.attrib)
 name=kind+('-probe' if probe else '-neutral');xml=base/(name+'.xml');tree.write(xml,encoding='utf-8',xml_declaration=True)
 with (base/(name+'.log')).open('w') as log:
  subprocess.run(['java','-Djava.awt.headless=true','-jar',jar,'-xml2swf',str(xml),str(base/(name+'.swf'))],stdout=log,stderr=log,check=True)
  subprocess.run(['java','-Djava.awt.headless=true','-jar',jar,'-selectid','936,1532','-select','936:1,1532:1','-zoom','8','-ignorebackground','-export','sprite',str(base/name),str(base/(name+'.swf'))],stdout=log,stderr=log,check=True)
 print(name,'done',flush=True)
probe_tree=E.parse(base/'probe.xml');probe_nodes={n.get('shapeId'):n for n in probe_tree.getroot().find('tags') if n.get('shapeId')}
(base/'grounded-source.json').write_text(json.dumps(forms,indent=2)+'\n')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda j:variant(*j),[(k,p) for k in ['open','half','closed','pupils','leaves'] for p in [False,True]]))

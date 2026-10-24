"""Extract the original pet-panel frame and button states, with live fields hidden.

No newly drawn artwork. Full-root exports keep the original placement; cropped
button bounds become the exact runtime hit rectangles. Requires JPEXS and Pillow.
"""
from pathlib import Path
import argparse,copy,json,hashlib,subprocess
import xml.etree.ElementTree as E
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--xml',type=Path,required=True);p.add_argument('--swf',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
tree=E.parse(a.xml);tags=tree.getroot().find('tags');nodes={n.get('spriteId') or n.get('buttonId') or n.get('shapeId') or n.get('characterID'):n for n in tags if n.get('spriteId') or n.get('buttonId') or n.get('shapeId') or n.get('characterID')}
root=nodes['182'];right=nodes['168']
blank_cache={};next_blank=10000
def blank_text(identifier):
 # JPEXS renders embedded edit text despite a parent alpha transform. Blank
 # cloned text definitions as well, retaining their original bounds/placement.
 global next_blank
 if identifier in blank_cache:return blank_cache[identifier]
 original=nodes.get(identifier)
 if original is None or original.get('type','').startswith('DefineShape'):return identifier
 attr=next((key for key in ('spriteId','buttonId','characterID') if original.get(key)),None)
 if attr is None:return identifier
 clone=copy.deepcopy(original);new=str(next_blank);next_blank+=1
 clone.set(attr,new);blank_cache[identifier]=new;tags.append(clone)
 if original.get('type')=='DefineEditTextTag':clone.set('initialText','')
 for child in clone.iter():
  if child.get('characterId'):child.set('characterId',blank_text(child.get('characterId')))
 return new
def hide(n):
 if n.get('characterId'):n.set('characterId',blank_text(n.get('characterId')))
 n.set('placeFlagHasColorTransform','true');old=n.find('colorTransform')
 if old is not None:n.remove(old)
 E.SubElement(n,'colorTransform',type='CXFORMWITHALPHA',hasAddTerms='false',hasMultTerms='true',nbits='10',redMultTerm='256',greenMultTerm='256',blueMultTerm='256',alphaMultTerm='0',redAddTerm='0',greenAddTerm='0',blueAddTerm='0',alphaAddTerm='0')
def placed(n):return [c for c in n.find('subTags') if c.get('type','').startswith('PlaceObject')]
def duplicate(n,identifier,attribute='spriteId'):
 c=copy.deepcopy(n);c.set(attribute,str(identifier));tags.append(c);return c
# Source hover captions belong to the original server's categories. Runtime
# supplies the meaningful labels for the desktop's extended categories instead.
for sid in ['144','150','154','158','166']:nodes[sid].set('initialText','')
specs=[];sid=3000
mutable={'pet_mc','pet_ye','cloth_mc','honor_mc','health_mc','name_txt','host_txt','birthday_txt','growth_txt','skillLvl_txt','hungry_percent','thirsty_percent','dirty_percent','spirit_percent','growth_percent','skillLvl_percent','attr_mc','follow_btn','look_btn','back_btn','feed_btn','revival_btn','healing_btn','close_btn'}
base=duplicate(root,sid)
for n in placed(base):
 if n.get('name') in mutable:hide(n)
base_right=duplicate(right,3100)
for n in placed(base):
 if n.get('name')=='petFoodMC':n.set('characterId','3100')
for n in placed(base_right):
 if n.get('name') in ['page_txt','P_btn','N_btn'] or (n.get('name','').startswith('type') and n.get('name','').endswith('_btn')):hide(n)
specs.append(('frame',sid));sid+=1
buttons=[('items','type1_btn','147'),('wardrobe','type2_btn','151'),('growth','type3_btn','155'),('games','type4_btn','160'),('memories','type5_btn','167'),('heal','healing_btn','181'),('close','close_btn','30')]
for name,instance,button in buttons:
 for state,flag in [('normal','buttonStateUp'),('hover','buttonStateOver'),('pressed','buttonStateDown')]:
  r=duplicate(root,sid);button_id=4000+sid-3000;b=duplicate(nodes[button],button_id,'buttonId')
  for record in list(b.find('characters')):
   if record.get(flag)!='true' or (instance.startswith('type') and record.get('placeDepth') in ['8','10']):
    b.find('characters').remove(record);continue
   for attr in ['buttonStateUp','buttonStateOver','buttonStateDown','buttonStateHitTest']:record.set(attr,str(attr=='buttonStateUp').lower())
  if instance.startswith('type'):
   rr=duplicate(right,5000+sid-3000)
   for n in placed(r):
    if n.get('name')=='petFoodMC':n.set('characterId',rr.get('spriteId'))
    else:hide(n)
   for n in placed(rr):
    if n.get('name')==instance:n.set('characterId',str(button_id))
    else:hide(n)
  else:
   for n in placed(r):
    if n.get('name')==instance:n.set('characterId',str(button_id))
    else:hide(n)
  specs.append((name+'-'+state,sid));sid+=1
xml=a.work/'classic-book.xml';swf=a.work/'classic-book.swf';tree.write(xml,encoding='utf-8',xml_declaration=True)
for args in [['-xml2swf',str(xml),str(swf)],['-selectid',','.join(str(v) for _,v in specs),'-zoom','4','-ignorebackground','-export','sprite',str(a.work/'render'),str(swf)]]:
 subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,*args],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
out=a.repo/'public/assets/original/classic-book';out.mkdir(parents=True,exist_ok=True);meta={'sourceSprite':182,'size':[1200,688],'rasterScale':2,'assets':{}}
for name,identifier in specs:
 image=Image.open(next((a.work/'render').glob(f'DefineSprite_{identifier}*/1.png'))).convert('RGBA')
 assert abs(image.width-2400)<=4 and abs(image.height-1376)<=4,(name,image.size)
 if image.size!=(2400,1376):
  padded=Image.new('RGBA',(2400,1376));padded.paste(image,(0,0));image=padded
 box=image.getbbox();assert box is not None,name
 if name=='frame':box=(0,0,2400,1376)
 elif name.split('-')[0] in ['items','wardrobe','growth','games','memories']:
  index=['items','wardrobe','growth','games','memories'].index(name.split('-')[0]);x=1021 if index==4 else 1022;y=49+index*100;box=(2*x,2*y,2*(x+61),2*(y+60))
 image.crop(box).save(out/(name+'.png'),optimize=True);meta['assets'][name]={'sourceSprite':identifier,'rect':[v/2 for v in box]};print(name,box,flush=True)
frame=Image.open(out/'frame.png');frame.crop((2010,856,2190,1056)).save(out/'tab-extension.png',optimize=True)
(out/'layout.json').write_text(json.dumps(meta,indent=2)+'\n')
(out/'source.json').write_text(json.dumps({'sourceUrl':'https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/module/petUI/petUI.swf','sha256':hashlib.sha256(a.swf.read_bytes()).hexdigest(),'sourceSprite':182,'sourceButtons':{'items':147,'wardrobe':151,'growth':155,'games':160,'memories':167,'heal':181,'close':30},'rasterScale':2,'adaptation':'Original frame, labels, portrait background, slots and button-state graphics; mutable pet, numbers and obsolete hover captions hidden for live HTML/PNG content. No newly drawn frame.'},indent=2)+'\n')
(out/'checksums.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('*.png')},indent=2)+'\n')

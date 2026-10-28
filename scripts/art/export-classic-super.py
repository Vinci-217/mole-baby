"""Export classic three-leaf super Ram from original lamubone sprite2525.
Uses original shape placements; sampled actions, no new character drawing.
Requires JPEXS and the source XML; records registration and source hash.
"""
import argparse,ast,copy,json,subprocess,hashlib,xml.etree.ElementTree as E
from pathlib import Path
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--xml',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--work',type=Path,required=True);a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[2]
source=ast.parse((root/'scripts/art/export-registered-outfits.py').read_text());exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in ['matrix','bounds','union','Timeline']],type_ignores=[]),'<timeline>','exec'))
tl=Timeline(a.xml);tree=E.parse(a.xml);tags=tree.getroot().find('tags');ns={n.get('spriteId') or n.get('shapeId'):n for n in tags if n.get('spriteId') or n.get('shapeId')}
rows=json.loads((root/'public/assets/classic/ram-level-animation-sources.json').read_text())['classic']['rows'];body=union(bounds(tl.ns[s],m) for s,m in tl.action('2525','down',1,'body')[0]);scale=88*20/(body[2]-body[0]);transform=np.array([[scale,0,96*20-scale*(body[0]+body[2])/2],[0,scale,169*20-scale*body[3]],[0,0,1.]])
master=ns['2525'];master.remove(master.find('subTags'));sub=E.SubElement(master,'subTags');parts_all=[]
for row in rows:
 samples=row['actionFrames']
 for index in range(8):
  f=samples[min(index,len(samples)-1)]
  pb=union(bounds(tl.ns[s],m) for s,m in tl.action('2525',row['gameAction'],f,'body')[0])
  if pb:transform=np.array([[scale,0,96*20-scale*(pb[0]+pb[2])/2],[0,scale,169*20-scale*pb[3]],[0,0,1.]])
  parts,_=tl.action('2525',row['gameAction'],f,'all');parts=[(sid,transform@m) for sid,m in parts if sid!='41'];parts_all+=parts
  for depth in range(1,100):E.SubElement(sub,'item',type='RemoveObject2Tag',depth=str(depth),forceWriteAsLong='false')
  for depth,(sid,m) in enumerate(parts,1):
   node=E.SubElement(sub,'item',type='PlaceObject2Tag',characterId=sid,depth=str(depth),forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasMatrix='true',placeFlagMove='false',placeFlagHasColorTransform='false',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasName='false',placeFlagHasRatio='false')
   E.SubElement(node,'matrix',type='MATRIX',hasRotate='true',hasScale='true',nRotateBits='31',nScaleBits='31',nTranslateBits='31',scaleX=str(m[0,0]),scaleY=str(m[1,1]),rotateSkew0=str(m[1,0]),rotateSkew1=str(m[0,1]),translateX=str(round(m[0,2])),translateY=str(round(m[1,2])))
  E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false')
master.set('frameCount','72');b=union(bounds(tl.ns[s],m) for s,m in parts_all);print('Export bounds',b,flush=True)
for probe in (False,True):
 r=copy.deepcopy(tree)
 if probe:
  for n in r.getroot().find('tags'):
   if not n.get('type','').startswith('DefineShape'):continue
   colors={tuple(int(c.get(k,0)) for k in ['red','green','blue']) for c in n.iter('color')}
   if not {(255,255,255),(204,204,204)}<=colors or not colors<={(255,255,255),(204,204,204),(153,153,153)}:continue
   for c in n.iter('color'):
    v={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}[tuple(int(c.get(k,0)) for k in ['red','green','blue'])]
    for k,x in zip(['red','green','blue'],v):c.set(k,str(x))
 name='probe' if probe else 'neutral';xml=a.work/(name+'.xml');swf=a.work/(name+'.swf');r.write(xml,encoding='utf-8',xml_declaration=True)
 with (a.work/(name+'.log')).open('w') as log:
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-xml2swf',str(xml),str(swf)],stdout=log,stderr=log,check=True)
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-selectid','2525','-zoom','1','-ignorebackground','-export','sprite',str(a.work/name),str(swf)],stdout=log,stderr=log,check=True)
 print(name,'exported',flush=True)
# All sprite frames share the source sprite's union rectangle. Restore world offset.
nd=next((a.work/'neutral').glob('DefineSprite_2525_*'));pd=next((a.work/'probe').glob('DefineSprite_2525_*'));atlases=[Image.new('RGBA',(192*8,208*9)) for _ in range(2)]
for i in range(72):
 neutral=Image.open(nd/f'{i+1}.png').convert('RGBA');probe=Image.open(pd/f'{i+1}.png').convert('RGBA');n=np.array(neutral);d=n[:,:,:3].astype(float)-np.array(probe)[:,:,:3].astype(float)
 g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);dark=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*dark)/255,0,1);mask=np.dstack([w*255,g*255,dark*255,n[:,:,3]]).round().astype('uint8')
 for part,img in enumerate([neutral,Image.fromarray(mask)]):
  frame=Image.new('RGBA',(192,208));frame.alpha_composite(img,(int(np.floor(b[0]/20)),int(np.floor(b[1]/20))));atlases[part].paste(frame,(i%8*192,i//8*208))
for name,img in zip(['neutral','mask'],atlases):img.save(root/f'public/assets/classic/classic-{name}.png',optimize=True)
for color,offset in {'red':(255,-199,-250),'yellow':(0,-21,-255),'blue':(-215,-57,31),'pink':(51,-148,0)}.items():
 base=np.array(atlases[0].crop((0,0,192,208))).astype(float);mask=np.array(atlases[1].crop((0,0,192,208))).astype(float)/255
 for channel in range(3):
  for layer,shade in enumerate([255,204,153]):base[:,:,channel]+=mask[:,:,layer]*(np.clip(shade+offset[channel],0,255)-shade)
 Image.fromarray(np.clip(base,0,255).round().astype('uint8')).save(root/f'public/assets/original/pets/classic-{color}-idle.png',optimize=True)
(root/'public/assets/classic/classic-source.json').write_text(json.dumps({'sourceSprite':2525,'source':'http://mole.61.com/resource/NPC/lamubone.swf','sourceSha256':'01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf','sampling':'existing classic row actionFrames; fixed body width88, baseline169; no redrawing','rows':rows},ensure_ascii=False,indent=2)+'\n')

#!/usr/bin/env python3
"""Export complete original flight loops and independent senior body/crown layers.
Only original SWF shapes/placements are used. The desktop-controlled rotor is
an interaction adaptation, not a claim that a source drag performance exists.
"""
import argparse,ast,copy,hashlib,json,math,re,subprocess
from pathlib import Path
import xml.etree.ElementTree as E
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--ordinary',type=Path,required=True);p.add_argument('--super',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--exporter',required=True);a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
# Reuse the project's reviewed Move/HasCharacter timeline handling.
source=ast.parse((ROOT/'scripts/art/export-registered-outfits.py').read_text())
exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name in ['Timeline','matrix','bounds','union']],type_ignores=[]),'<source-timeline>','exec'))
out=ROOT/'public/assets/original/flight';out.mkdir(exist_ok=True)
result={'fps':24,'cell':[192,208],'columns':8,'forms':{}}
for form,path,master in [('senior',a.ordinary,'1777'),('classic',a.ordinary,'2525'),('super',a.super,'940')]:
 tl=Timeline(path);tree=E.parse(path);tags=tree.getroot().find('tags');ns={n.get('spriteId')or n.get('shapeId'):n for n in tags if n.get('spriteId')or n.get('shapeId')}
 first,_=tl.action(master,'down',1,'body');b=union(bounds(tl.ns[s],m)for s,m in first)
 mask=np.array(Image.open(ROOT/f'public/assets/classic/{form}-mask.png').convert('RGBA'))[:208,:192];ys,xs=np.where((mask[:,:,:3].sum(2)>40)&(mask[:,:,3]>40))
 target=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)];scale=(target[2]-target[0])*20/(b[2]-b[0]);transform=np.array([[scale,0,(target[0]+target[2])*10-scale*(b[0]+b[2])/2],[0,scale,target[3]*20-scale*b[3]],[0,0,1.]])
 entries=[];clips={}
 def put(parts):
  index=len(entries);entries.append([(sid,transform@m)for sid,m in parts if sid!='41']);return index
 def duration(sid,seen=0):
  n=tl.ns.get(sid)
  if n is None or seen>10 or n.find('subTags')is None:return 1
  return max([int(n.get('frameCount',1))]+[duration(v.get('characterId'),seen+1)for v,_ in tl.active(sid,1)if v.get('characterId')])
 for action in ['down','right','left']:
  active=tl.active(master,tl.labels(master)[action]);count=max(duration(v.get('characterId'))for v,_ in active if v.get('characterId'));frames=[];skipped=[]
  for frame in range(1,count+1):
   parts,_=tl.action(master,action,frame,'all');parts=[(sid,m)for sid,m in parts if sid!='41']
   if not parts:skipped.append(frame);continue
   frames.append({'index':put(parts),'sourceFrame':frame})
  clips[action]={'sourceFrameCount':count,'frames':frames,'emptyControlFrames':skipped}
 data={'sourceSprite':int(master),'clips':clips,'rows':math.ceil(len(entries)/8),'registration':{'bodyTarget':target,'sourceBodyBounds':b,'scale':scale}}
 if form=='senior':
  parts,_=tl.action(master,'down',1,'all')
  def green(sid):return any(int(c.get('green',0))>int(c.get('red',0))*1.2 and int(c.get('green',0))>int(c.get('blue',0))*1.1 for c in tl.ns[sid].iter('color'))
  body=[(sid,m)for sid,m in parts if sid!='41'and (not green(sid)or sid=='1535')];crown=[(sid,m)for sid,m in parts if green(sid)and sid!='1535']
  data.update(bodyIndex=put(body),crownIndex=put(crown),crownParts=len(crown),bladeCount=8)
  # Original eight-blade crown rotates around its source leaf base, projected
  # into the same horizontal plane. No extra blade or character is painted.
  cb=union(bounds(tl.ns[sid],transform@m)for sid,m in crown);data['rotor']={'pivot':[(cb[0]+cb[2])/40,(cb[1]+cb[3])/40],'projectionY':.42}
 data['rows']=math.ceil(len(entries)/8)
 node=ns[master];node.remove(node.find('subTags'));sub=E.SubElement(node,'subTags');allparts=[]
 for parts in entries:
  allparts+=parts
  for depth in range(1,120):E.SubElement(sub,'item',type='RemoveObject2Tag',depth=str(depth),forceWriteAsLong='false')
  for depth,(sid,m)in enumerate(parts,1):
   v=E.SubElement(sub,'item',type='PlaceObject2Tag',characterId=sid,depth=str(depth),forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasMatrix='true',placeFlagMove='false',placeFlagHasColorTransform='false',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasName='false',placeFlagHasRatio='false')
   E.SubElement(v,'matrix',type='MATRIX',hasRotate='true',hasScale='true',nRotateBits='31',nScaleBits='31',nTranslateBits='31',scaleX=str(m[0,0]),scaleY=str(m[1,1]),rotateSkew0=str(m[1,0]),rotateSkew1=str(m[0,1]),translateX=str(round(m[0,2])),translateY=str(round(m[1,2])))
  E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false')
 node.set('frameCount',str(len(entries)));box=union(bounds(tl.ns[s],m)for s,m in allparts)
 for probe in [False,True]:
  r=copy.deepcopy(tree)
  if probe:
   for n in r.getroot().find('tags'):
    if not n.get('type','').startswith('DefineShape'):continue
    colors={tuple(int(c.get(k,0))for k in ['red','green','blue'])for c in n.iter('color')}
    if not {(255,255,255),(204,204,204)}<=colors or not colors<={(255,255,255),(204,204,204),(153,153,153)}:continue
    for c in n.iter('color'):
     color={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}[tuple(int(c.get(k,0))for k in ['red','green','blue'])]
     for k,x in zip(['red','green','blue'],color):c.set(k,str(x))
  name=form+('-probe'if probe else '-neutral');xml=a.work/(name+'.xml');swf=a.work/(name+'.swf');r.write(xml,encoding='utf-8',xml_declaration=True)
  subprocess.run([a.exporter,'xml2swf',str(xml),str(swf)],check=True,stdout=subprocess.DEVNULL)
  # -1 means the whole sprite timeline, unlike the selected single-frame mode.
  subprocess.run([a.exporter,'frames',str(swf),str(a.work/name),master,'-1','2'],check=True,stdout=subprocess.DEVNULL)
  print(form,name,'rendered',flush=True)
 neutrals=sorted((a.work/(form+'-neutral')).rglob('*.png'),key=lambda f:int(f.stem));probes=sorted((a.work/(form+'-probe')).rglob('*.png'),key=lambda f:int(f.stem));assert len(neutrals)==len(entries)==len(probes)
 atlases=[Image.new('RGBA',(192*8,208*data['rows']))for _ in range(2)]
 for index,(nf,pf)in enumerate(zip(neutrals,probes)):
  im=Image.open(nf).convert('RGBA');n=np.array(im).astype(float);d=n[:,:,:3]-np.array(Image.open(pf).convert('RGBA'))[:,:,:3].astype(float)
  g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);dark=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*dark)/255,0,1);mask=Image.fromarray(np.dstack([w*255,g*255,dark*255,n[:,:,3]]).round().astype('uint8'))
  for part,sourceim in enumerate([im,mask]):
   frame=Image.new('RGBA',(384,416));frame.alpha_composite(sourceim,(math.floor(box[0]/20*2),math.floor(box[1]/20*2)));frame=frame.resize((192,208),Image.Resampling.LANCZOS);atlases[part].paste(frame,(index%8*192,index//8*208))
 for name,im in zip(['neutral','mask'],atlases):im.save(out/f'{form}-{name}.png',optimize=True)
 data['sourceSwfSha256']=hashlib.sha256(path.with_suffix('.swf').read_bytes()).hexdigest();data['exportBounds']=box;result['forms'][form]=data
 print(form,'complete',len(entries),'poses',data['clips']['down']['sourceFrameCount'],'source timeline frames',flush=True)
(out/'runtime.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')

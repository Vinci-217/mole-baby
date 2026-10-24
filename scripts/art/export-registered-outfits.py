"""Original costume timelines registered against original body poses.

Raster playback only: no new character/art drawing, no white-pixel eye guesses.
Original ActionMC3 (petBone3) display lists are selected from SWF2. Source body
bounds and target body coverage supply a common affine registration. Sources
without an additive rig retain their coloured accessory shapes, excluding the
preview face/shadow/foliage. Every adaptation is recorded in runtime.json.
"""
from pathlib import Path
import argparse,copy,json,math,re,subprocess,hashlib
import xml.etree.ElementTree as E
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--sources',type=Path,required=True);p.add_argument('--ordinary',type=Path,required=True);p.add_argument('--evolutions',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--missing-only',action='store_true');p.add_argument('--preview',action='store_true');p.add_argument('--reuse-render',action='store_true');p.add_argument('--ids',default='gold-feather:1200018,wizard-cap:1200020,star-wand:1200021,magic-book:1200026,rabbit-hood:1200033,leaf-hood:1200036,sport-goggles:1200047,warm-scarf:1200052');p.add_argument('--forms');p.add_argument('--kinds');p.add_argument('--out',type=Path);p.add_argument('--registration',choices=['source','fitted'],default='source');a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True)
out=a.out or (a.work/'preview-out' if a.preview else a.repo/'public/assets/original/wardrobe-motion');out.mkdir(exist_ok=True)
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
  for v,_ in reversed(self.active(root,labels[label])):
   cid=v.get('characterId')
   if cid and 'down'in self.labels(cid):return cid,matrix(v.find('matrix'))
  if label!='level2':
   for v,_ in reversed(self.active(root,labels['level2'])):
    cid=v.get('characterId')
    if cid and 'down'in self.labels(cid):return cid,matrix(v.find('matrix'))
  return None,np.eye(3)

base={}
for f,(_,_,sid) in FORMS.items():base[f]=Timeline(a.ordinary if f in ['seed','junior','middle','senior'] else a.evolutions/(f+'.xml'))
classic=json.loads((a.repo/'public/assets/classic/ram-level-animation-sources.json').read_text());care=json.loads((a.repo/'public/assets/original/care/source.json').read_text());items=json.loads((a.repo/'public/assets/original/item-motion/sources.json').read_text());football=json.loads((a.repo/'public/assets/original/football/runtime.json').read_text());emotions=json.loads((a.repo/'public/assets/original/emotions/runtime.json').read_text())
MASK_CACHE={}
def targetmask(form,kind):
 if (form,kind) in MASK_CACHE:return MASK_CACHE[(form,kind)]
 path=a.repo/(f'public/assets/classic/{form}-mask.png' if kind=='classic' else f'public/assets/original/{kind}/{form}-mask.png')
 if kind=='seed':path=a.repo/'public/assets/original/seed/body-mask.png'
 m=np.asarray(Image.open(path).convert('RGBA'));MASK_CACHE[(form,kind)]=m;return m

def specs(form):
 f=FORMS[form][0];result=[]
 def add(kind,w,h,cols,entries,folder=None):
  m=targetmask(form if kind in ['seed','slumber'] else f,folder or kind);data=[]
  for key,action,sourceFrame,cell in entries:
   row=cell//cols;col=cell%cols;part=m[row*h:(row+1)*h,col*w:(col+1)*w];ys,xs=np.where((part[:,:,:3].astype(int).sum(2)>90)&(part[:,:,3]>120))
   if not len(xs):
    part=m[:h,:w];ys,xs=np.where((part[:,:,:3].astype(int).sum(2)>90)&(part[:,:,3]>120))
   if not len(xs):continue
   data.append((str(key),action,int(sourceFrame),[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]))
  result.append((kind,w,h,data))
 if form=='seed':
  add('seed',96,99,8,[(i,'down',3,i) for i in range(64)]);add('slumber',96,99,8,[(i,'down',3,i) for i in range(8)]);return result
 if f in ['junior','middle']:
  add('grounded',192,208,5,[(i,'down',3 if f=='junior' else 1,i) for i in range(5)])
 add('slumber',192,208,8,[(i,'down',3 if f=='junior' else 1,i) for i in range(8)])
 rowActions=['down','right','left','dance','woter','angry','food','drenk','happy'];rows=classic.get(f,{}).get('rows',[])
 add('classic',192,208,8,[(r*8+i,(rows[r].get('gameAction') if r<len(rows) else rowActions[r]),(rows[r]['actionFrames'][min(i,len(rows[r]['actionFrames'])-1)] if r<len(rows) else i*2+1),r*8+i) for r in range(9) for i in range(8)])
 if f in ['junior','middle','senior']:
  for kind,rs in [('care',care[f]['rows']),('item-motion',items['forms'][f])]:
   add(kind,192,208,16,[(r*16+i,s['action'],s['actionFrames'][min(i,len(s['actionFrames'])-1)],r*16+i) for r,s in enumerate(rs) for i in range(16)])
 sp=football['forms'][f];add('football',160,192,8,[(i+1,'football',i+1,cell) for i,cell in enumerate(sp['frameMap'])])
 for emotion,action in [('joy','happy'),('grumpy','angry')]:
  sp=emotions['forms'][f][emotion];keys={}
  for sf,cell in zip(sp['sourceFrames'],sp['frameMap']):keys.setdefault(sf,cell)
  add('emotion-'+emotion,192,208,8,[(sf,action,sf,cell) for sf,cell in keys.items()],folder='emotions/'+f+'-'+emotion) # overridden below
 return result
# emotion atlas file names differ from the directory name.
_original_targetmask=targetmask
def targetmask(form,kind):
 if kind.startswith('emotions/'):
  name=kind.split('/')[-1];key=(form,kind)
  if key not in MASK_CACHE:MASK_CACHE[key]=np.asarray(Image.open(a.repo/f'public/assets/original/emotions/{name}-mask.png').convert('RGBA'))
  return MASK_CACHE[key]
 return _original_targetmask(form,kind)

allSpecs={f:[spec for spec in specs(f) if not a.kinds or spec[0] in a.kinds.split(',')] for f in FORMS if not a.forms or f in a.forms.split(',')}
if a.preview:allSpecs={'junior':[(kind,w,h,entries[:1]) for kind,w,h,entries in allSpecs['junior'] if kind=='grounded']}
def export(pair):
 name,sid=pair.split(':');src=a.sources/(sid+'.xml');tl=Timeline(src);tree=copy.deepcopy(tl.tree);tags=tree.getroot().find('tags')
 # Only original graphics are needed by this raster export.
 for n in list(tags):
  if n.get('type') in ['DoABC2Tag','SymbolClassTag','ExportAssetsTag','PlaceObject2Tag','ShowFrameTag','DefineSceneAndFrameLabelDataTag']:tags.remove(n)
 runtime={'sourceId':sid,'sourceSha256':hashlib.sha256(src.with_suffix('.swf').read_bytes()).hexdigest(),'additiveRig':bool(tl.cloth),'registration':a.registration,'forms':{}};exports=[];identifier=30000
 for form in allSpecs:
  if a.missing_only and form in previous.get(name,{}).get('forms',{}):continue
  dirs,outer=tl.stage(form)
  if dirs is None:continue
  bform='junior' if dirs==tl.stage('junior')[0] else form;btl=base[bform];bsid=str(FORMS[bform][2]);runtime['forms'][form]={}
  # Fit once in the neutral rig. Never resize a garment to its changing outer
  # bounds: a moving ear, page or wand must not pump the entire accessory.
  canonical,canonicalAction=tl.action(dirs,'down',3,'cloth');canonical=[(s,outer@m) for s,m in canonical]
  cb=union(bounds(tl.ns[s],m) for s,m in canonical)
  cbody,_=tl.action(dirs,'down',3,'body');cbody=[(s,outer@m) for s,m in cbody];bb=union(bounds(tl.ns[s],m) for s,m in cbody)
  if bb is None:
   cbody,_=btl.action(bsid,'down',3,'body');bb=union(bounds(btl.ns[s],m) for s,m in cbody)
  adjustment=None
  if cb and bb:
   bw,bh=bb[2]-bb[0],bb[3]-bb[1];cx=(bb[0]+bb[2])/2;top=bb[1]
   ratio={'wizard-cap':1.22,'rabbit-hood':1.23,'warm-scarf':1.16,'sport-goggles':1.08,'gold-feather':.48,'leaf-hood':1.60,'magic-book':.55,'star-wand':.62}.get(name,1.10)
   if form=='seed':ratio=1.1 if name=='rabbit-hood' else ratio*.72
   factor=bw*ratio/max(1,cb[2]-cb[0])
   if name=='star-wand':
    factor=min(factor,bh*1.25/max(1,cb[3]-cb[1]));dx=bb[2]-bw*.05-cb[0]*factor;dy=bb[3]+bh*.08-cb[3]*factor
   elif name=='magic-book':
    dx=bb[2]-bw*.08-cb[0]*factor;dy=top+bh*.72-cb[1]*factor
   else:
    bottom=top+bh*({'rabbit-hood':1.00,'warm-scarf':.40,'sport-goggles':.32,'gold-feather':-.02,'leaf-hood':.34}.get(name,.13))
    if form=='seed':bottom=top+bh*.54 if name=='rabbit-hood' else top-bh*.04
    dx=cx-(cb[0]+cb[2])/2*factor;dy=bottom-cb[3]*factor
   adjustment=(factor,dx-(1-factor)*cx,dy-(1-factor)*top)
  runtime.setdefault('registrations',{})[form]={'method':'neutral-fit-shared-source-motion','canonicalBody':bb,'canonicalCloth':cb,'adjustment':adjustment}

  for kind,w,h,entries in allSpecs[form]:
   cw,ch=256,384;node=E.Element('item',type='DefineSpriteTag',forceWriteAsLong='true',spriteId=str(identifier),frameCount=str(len(entries)),hasEndTag='true');sub=E.SubElement(node,'subTags');lookup={};maxDepth=0
   for index,(key,action,sourceFrame,tbox) in enumerate(entries):
    shapes,actual=tl.action(dirs,action,sourceFrame,'cloth');shapes=[(s,outer@m) for s,m in shapes]
    body,_=tl.action(dirs,actual,sourceFrame if actual==action else 3,'body');body=[(s,outer@m) for s,m in body];bbox=union(bounds(tl.ns[s],m) for s,m in body)
    if bbox is None:
     body,_=btl.action(bsid,actual,sourceFrame if actual==action else 3,'body');bbox=union(bounds(btl.ns[s],m) for s,m in body)
    for depth in range(1,maxDepth+1):E.SubElement(sub,'item',type='RemoveObject2Tag',depth=str(depth),forceWriteAsLong='false')
    maxDepth=0
    if bbox and bbox[2]>bbox[0] and bbox[3]>bbox[1]:
     # Per-frame source and target coverage, no facial-feature heuristics.
     sx=(tbox[2]-tbox[0])/(bbox[2]-bbox[0]);sy=(tbox[3]-tbox[1])/(bbox[3]-bbox[1]);T=np.array([[sx,0,tbox[0]+(cw-w)/2-sx*bbox[0]],[0,sy,tbox[1]+(ch-h)/2-sy*bbox[1]],[0,0,1]])
     if a.registration=='source' and adjustment:
      factor,localX,localY=adjustment;currentX=(bbox[0]+bbox[2])/2;currentY=bbox[1];T=T@np.array([[factor,0,(1-factor)*currentX+localX],[0,factor,(1-factor)*currentY+localY],[0,0,1]])
     if a.preview and shapes:
      cb=union(bounds(tl.ns[s],m) for s,m in shapes);factor=min(230/(cb[2]-cb[0]),260/(cb[3]-cb[1]));T=np.array([[factor,0,128-(cb[0]+cb[2])/2*factor],[0,factor,144-(cb[1]+cb[3])/2*factor],[0,0,1]])
     elif shapes and a.registration=='fitted':
      cb=union(bounds(tl.ns[s],m) for s,m in shapes);bw=tbox[2]-tbox[0];bh=tbox[3]-tbox[1];cx=(tbox[0]+tbox[2])/2+(cw-w)/2;top=tbox[1]+(ch-h)/2;bottom=tbox[3]+(ch-h)/2
      if name=='star-wand':
       factor=min(bh*1.25/max(1,cb[3]-cb[1]),bw*.72/max(1,cb[2]-cb[0]));dx=tbox[2]+(cw-w)/2-bw*.05-cb[0]*factor;dy=bottom+bh*.1-cb[3]*factor
      elif name=='magic-book':
       start=tbox[2]+(cw-w)/2-bw*.15;factor=min(bw*.5/max(1,cb[2]-cb[0]),max(8,cw-8-start)/max(1,cb[2]-cb[0]));dx=start-cb[0]*factor;dy=bottom-bh*.25-cb[1]*factor
      elif name=='sport-goggles':
       factor=bw*1.08/max(1,cb[2]-cb[0]);dx=cx-(cb[0]+cb[2])/2*factor;dy=top+bh*.32-(cb[1]+cb[3])/2*factor
      elif name=='gold-feather':
       factor=min(bw*.65/max(1,cb[2]-cb[0]),max(12,top-8)/max(1,cb[3]-cb[1]));dx=cx-bw*.28-(cb[0]+cb[2])/2*factor;dy=top-bh*.035-cb[3]*factor
      else:
       hood=name in ['rabbit-hood','warm-scarf'];allowedBottom=top+bh*((.28 if form=='seed' else 1.02) if name=='rabbit-hood' else .48 if hood else 0 if form=='seed' else .18);factor=min(bw*(1.5 if name=='rabbit-hood' else 1.35 if hood else 1.05)/max(1,cb[2]-cb[0]),max(12,allowedBottom-6)/max(1,cb[3]-cb[1]));dx=cx-(cb[0]+cb[2])/2*factor;dy=allowedBottom-cb[3]*factor
      dx=max(4-cb[0]*factor,min(dx,cw-4-cb[2]*factor));dy=max(4-cb[1]*factor,min(dy,ch-4-cb[3]*factor));T=np.array([[factor,0,dx],[0,factor,dy],[0,0,1]])
     for depth,(shape,m) in enumerate(shapes,1):
      M=T@m;M[:2,:]*=20
      v=E.SubElement(sub,'item',type='PlaceObject2Tag',characterId=shape,depth=str(depth),forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasColorTransform='false',placeFlagHasMatrix='true',placeFlagHasName='false',placeFlagHasRatio='false',placeFlagMove='false')
      E.SubElement(v,'matrix',type='MATRIX',hasRotate='true',hasScale='true',nRotateBits='31',nScaleBits='31',nTranslateBits='31',scaleX=str(M[0,0]),scaleY=str(M[1,1]),rotateSkew0=str(M[1,0]),rotateSkew1=str(M[0,1]),translateX=str(round(M[0,2])),translateY=str(round(M[1,2])))
      maxDepth=depth
    E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false');lookup[key]=index
   tags.append(node);exports.append((identifier,form,kind,cw,ch,len(entries)));runtime['forms'][form][kind]={'cell':[cw,ch],'bodyCell':[w,h],'origin':[(cw-w)/2,(ch-h)/2],'columns':8,'lookup':lookup,'file':f'{name}-{form}-{kind}.png'};identifier+=1
 if not exports:return name,runtime
 # One original SWF frame per pose. A fixed export stage preserves registration
 # and clips only pixels outside the generous costume viewport.
 master=tree.getroot();rect=master.find('displayRect');rect.set('Xmin','0');rect.set('Ymin','0');rect.set('Xmax','5120');rect.set('Ymax','7680');rect.set('nbits','14')
 master.set('frameCount',str(sum(v[-1] for v in exports)))
 for identifier,form,kind,cw,ch,count in exports:
  E.SubElement(tags,'item',type='RemoveObject2Tag',depth='1',forceWriteAsLong='false')
  place=E.SubElement(tags,'item',type='PlaceObject2Tag',characterId=str(identifier),depth='1',forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasColorTransform='false',placeFlagHasMatrix='true',placeFlagHasName='false',placeFlagHasRatio='false',placeFlagMove='false')
  E.SubElement(place,'matrix',type='MATRIX',hasRotate='false',hasScale='false',nRotateBits='0',nScaleBits='0',nTranslateBits='0',translateX='0',translateY='0')
  for _ in range(count):E.SubElement(tags,'item',type='ShowFrameTag',forceWriteAsLong='false')
 dest=a.work/name;dest.mkdir(exist_ok=True);xml=dest/'registered.xml';swf=dest/'registered.swf';tree.write(xml)
 with (dest/'export.log').open('w') as log:
  if not a.reuse_render:subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-xml2swf',str(xml),str(swf)],stdout=log,stderr=log,check=True)
  if not a.reuse_render:subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-zoom','1','-ignorebackground','-export','frame',str(dest/'render'),str(swf)],stdout=log,stderr=log,check=True)
 offset=0
 for identifier,form,kind,cw,ch,count in exports:
  path=dest/'render';meta=runtime['forms'][form][kind]
  # Fixed-stage exports preserve the same transparent costume registration.
  ims=[Image.open(path/f'{offset+i+1}.png').convert('RGBA') for i in range(count)];unique=[];seen={};fm=[]
  for im in ims:
   assert im.size==(cw,ch),(name,form,kind,im.size,(cw,ch))
   key=hashlib.sha256(im.tobytes()).digest()
   if key not in seen:seen[key]=len(unique);unique.append(im)
   fm.append(seen[key])
  rects=[list(im.getbbox() or (0,0,1,1)) for im in unique];tw=max(b[2]-b[0] for b in rects);th=max(b[3]-b[1] for b in rects);atlas=Image.new('RGBA',(tw*8,th*math.ceil(len(unique)/8)))
  for i,(im,b) in enumerate(zip(unique,rects)):atlas.paste(im.crop(b),(i%8*tw,i//8*th))
  meta['tile']=[tw,th];meta['rects']=rects
  atlas.save(out/meta['file'],optimize=True);meta['frameMap']=fm;meta['rows']=math.ceil(len(unique)/8);offset+=count
 print(name,'done',flush=True);return name,runtime

previous=json.loads((out/'runtime.json').read_text())['outfits'] if (out/'runtime.json').exists() else {}
results=copy.deepcopy(previous)
for pair in a.ids.split(','):
 k,v=export(pair)
 if k in results:
  registrations={**results[k].get('registrations',{}),**v.get('registrations',{})};results[k].update({key:value for key,value in v.items() if key!='forms'});results[k]['registrations']=registrations;results[k]['forms'].update(v['forms'])
 else:results[k]=v
(out/'runtime.json').write_text(json.dumps({'fps':24,'registration':'Original SWF2 poses with one neutral fit per outfit/form, body-source registration and shared action frame. No per-frame garment-bounds fitting; source eye/mouth/body remain independent. Missing-action fallbacks are explicit adaptations.','outfits':results},separators=(',',':'))+'\n')
(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('*.png')},indent=2)+'\n')

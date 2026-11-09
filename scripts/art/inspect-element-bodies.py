import xml.etree.ElementTree as E,json,subprocess
from pathlib import Path
import argparse,hashlib,sys
args=argparse.ArgumentParser(description='Measure original vector face contours; never redraw or repack source frames.')
args.add_argument('--xml-cache',default='/tmp/mole-element-body-xml')
args=args.parse_args();cache=Path(args.xml_cache);cache.mkdir(parents=True,exist_ok=True)
base=Path(__file__).resolve().parents[2];manifest=json.loads((base/'public/assets/original/official/manifest.json').read_text());out=[]
def mul(a,b):return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]
def mat(x):
 if x is None:return [1,0,0,1,0,0]
 return [float(x.get('scaleX','1')),float(x.get('rotateSkew0','0')),float(x.get('rotateSkew1','0')),float(x.get('scaleY','1')),float(x.get('translateX','0'))/20,float(x.get('translateY','0'))/20]
def fill_edges(node):
 colors={}
 for i,item in enumerate(node.findall('./shapes/fillStyles/fillStyles/item')):
  cc=item.findall('.//color')
  if cc:colors[i+1]=tuple(round(sum(int(c.get(k,'0')) for c in cc)/len(cc)) for k in ['red','green','blue'])
 x=y=0;f0=f1=0;groups={}
 for r in node.findall('./shapes/shapeRecords/item'):
  typ=r.get('type')
  if typ=='StyleChangeRecord':
   if r.get('stateMoveTo')=='true':x=int(r.get('moveDeltaX','0'));y=int(r.get('moveDeltaY','0'))
   if r.get('stateFillStyle0')=='true':f0=int(r.get('fillStyle0','0'))
   if r.get('stateFillStyle1')=='true':f1=int(r.get('fillStyle1','0'))
   continue
  start=(x/20,y/20)
  if typ=='StraightEdgeRecord':x+=int(r.get('deltaX','0'));y+=int(r.get('deltaY','0'));end=(x/20,y/20);control=((start[0]+end[0])/2,(start[1]+end[1])/2)
  elif typ=='CurvedEdgeRecord':
   cx=x+int(r.get('controlDeltaX','0'));cy=y+int(r.get('controlDeltaY','0'));x=cx+int(r.get('anchorDeltaX','0'));y=cy+int(r.get('anchorDeltaY','0'));control=(cx/20,cy/20);end=(x/20,y/20)
  else:continue
  for fill in set([f0,f1]):
   if fill in colors:groups.setdefault(fill,[]).append((start,control,end))
 return colors,groups
def filled_bounds(node):
 colors,groups=fill_edges(node);result=[]
 for fill,edges in groups.items():
  points=[]
  for start,control,end in edges:
   points.extend([start,end])
   for axis in [0,1]:
    a,b,c=start[axis],control[axis],end[axis];den=a-2*b+c
    if den:
     t=(a-b)/den
     if 0<t<1:points.append(tuple((1-t)**2*start[k]+2*(1-t)*t*control[k]+t*t*end[k] for k in [0,1]))
  result.append((fill,colors[fill],[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)]))
 return result
def row_span(node,matrix,y,left,right,style=None):
 colors,groups=fill_edges(node);result=[]
 def point(p):return (matrix[0]*p[0]+matrix[2]*p[1]+matrix[4],matrix[1]*p[0]+matrix[3]*p[1]+matrix[5])
 for fill,edges in groups.items():
  if style is not None and fill!=style:continue
  color=colors[fill]
  if style is not None and (min(color)>=210 or max(color)<=100):continue
  xs=[]
  for edge in edges:
   a,b,c=map(point,edge);aa=a[1]-2*b[1]+c[1];bb=2*(b[1]-a[1]);cc=a[1]-y;ts=[]
   if abs(aa)<1e-8:
    if abs(bb)>1e-8:ts=[-cc/bb]
   elif bb*bb-4*aa*cc>=0:
    disc=(bb*bb-4*aa*cc)**.5;ts=[(-bb+disc)/(2*aa),(-bb-disc)/(2*aa)]
   for t in ts:
    if 0<=t<1 and abs(2*aa*t+bb)>1e-8:xs.append((1-t)**2*a[0]+2*(1-t)*t*b[0]+t*t*c[0])
  xs.sort()
  for i in range(0,len(xs)-1,2):
   result.append((xs[i+1]-xs[i],xs[i],xs[i+1],fill,color))
 if style is None:
  merged=[]
  for v in sorted(result,key=lambda v:v[1]):
   if merged and v[1]<=merged[-1][2]+1e-5:
    a=merged[-1];merged[-1]=(max(a[2],v[2])-a[1],a[1],max(a[2],v[2]),a[3],a[4])
   else:merged.append(v)
  result=merged
 result=[v for v in result if v[1]<=left+.2 and v[2]>=right-.2]
 return min(result) if result else None
def contains(a,b):return a[0]<=b[0]+.2 and a[1]<=b[1]+.2 and a[2]>=b[2]-.2 and a[3]>=b[3]-.2
def area(a):return (a[2]-a[0])*(a[3]-a[1])
for n in range(1208000,1208018):
 c=next(c for c in manifest['clips'] if c['path'].endswith('/'+str(n)+'.swf'));p=cache/('element-'+str(n)+'.xml')
 if not p.exists():subprocess.run(['java','-Xmx250m','-jar','/opt/jpexs/26.4.0/ffdec-cli.jar','-swf2xml',str(base/'local-assets/ram-official-sweep/2026-11-06/files'/c['path']),str(p)],stdout=subprocess.DEVNULL,check=True)
 root=E.parse(p).getroot();defs={t.get('spriteId') or t.get('shapeId'):t for t in root.find('tags') if t.get('spriteId') or t.get('shapeId')};syms={}
 for t in root.find('tags'):
  if t.get('type')=='SymbolClassTag':syms=dict(zip([x.text for x in t.find('names')],[x.text for x in t.find('tags')]))
 cid=syms[c['symbol']];forms={};f=1
 for t in defs[cid].find('subTags'):
  if t.get('type')=='FrameLabelTag' and t.get('name').startswith('level'):forms[t.get('name')]=f
  if t.get('type')=='ShowFrameTag':f+=1
 if n==1208012:
  forms.update({f'level4#{i}':forms['level4'] for i in range(2,9)})
 refs={};element=next(v for v in json.loads((base/'public/assets/original/element-skills/clips.json').read_text()).values() if v['sourceId']==n);cleared=set(map(str,element['clearedRuntimeItemSprites']));forms['getItem']=element['rootFrame']+1;forms.update({f'getItem#{i}':element['rootFrame']+1 for i in range(2,9)})
 for form,frame in forms.items():
  leaves=[];subFrame=int(form.split('#')[1]) if '#' in form else 1
  def visit(cid,matrix,frame=1,path=[]):
   node=defs.get(cid)
   if node is None or len(path)>15:return
   r=node.find('shapeBounds')
   if r is not None:
    x0,y0,x1,y1=[int(r.get(k))/20 for k in ['Xmin','Ymin','Xmax','Ymax']];pts=[(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]) for x,y in [(x0,y0),(x0,y1),(x1,y0),(x1,y1)]];bounds=[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)]
    colors=[tuple(int(t.get(k,'0')) for k in ['red','green','blue']) for t in node.findall('.//color')]
    leaves.append(dict(id=cid,path=path,bounds=bounds,colors=colors,matrix=matrix))
    for fill,color,box in filled_bounds(node):
     xx0,yy0,xx1,yy1=box;pp=[(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]) for x,y in [(xx0,yy0),(xx0,yy1),(xx1,yy0),(xx1,yy1)]];bb=[min(x for x,y in pp),min(y for x,y in pp),max(x for x,y in pp),max(y for x,y in pp)]
     leaves.append(dict(id=cid,path=path,bounds=bb,colors=[color],fillStyle=fill,matrix=matrix))
    return
   active={};f=1
   for t in node.findall('./subTags/item'):
    if t.get('type')=='ShowFrameTag':
     if f==frame:break
     f+=1
    typ=t.get('type','');depth=t.get('depth')
    if typ.startswith('RemoveObject'):active.pop(depth,None)
    if typ.startswith('PlaceObject'):
     old=active.get(depth,{}).copy()
     if t.get('characterId'):old['id']=t.get('characterId')
     if t.find('matrix') is not None:old['matrix']=mat(t.find('matrix'))
     if t.get('name'):old['name']=t.get('name')
     active[depth]=old
   for depth,v in sorted(active.items(),key=lambda t:int(t[0])):
    if v.get('id') and v.get('name')!='lamu_txt' and v['id'] not in cleared:visit(v['id'],mul(matrix,v.get('matrix',[1,0,0,1,0,0])),min(subFrame,int(defs.get(v['id'],node).get('frameCount','1'))),path+[int(depth)])
  visit(str(element['actionSprite']) if form.startswith('getItem') else cid,[1,0,0,1,0,0],frame)
  scene=[min(l['bounds'][0] for l in leaves),min(l['bounds'][1] for l in leaves),max(l['bounds'][2] for l in leaves),max(l['bounds'][3] for l in leaves)]
  whites=[l for l in leaves if l['colors'] and all(min(color)>=210 for color in l['colors']) and area(l['bounds'])>2]
  blacks=[l for l in leaves if l['colors'] and all(max(color)<=100 for color in l['colors'])]
  eyes=[w for w in whites if any(contains(w['bounds'],b['bounds']) and area(b['bounds'])<area(w['bounds'])*.8 for b in blacks)]
  candidates=[]
  for i,a in enumerate(eyes):
   for b in eyes[i+1:]:
    ar,br=a['bounds'],b['bounds'];w1,h1=ar[2]-ar[0],ar[3]-ar[1];w2,h2=br[2]-br[0],br[3]-br[1]
    if abs((ar[0]+ar[2]-br[0]-br[2])/2)<max(w1,w2)*.75:continue
    if max(w1,w2)/min(w1,w2)>1.6 or abs((ar[1]+ar[3]-br[1]-br[3])/2)>max(h1,h2)*.4:continue
    union=[min(ar[0],br[0]),min(ar[1],br[1]),max(ar[2],br[2]),max(ar[3],br[3])]
    for l in leaves:
     if not l['colors'] or l in whites or l in blacks or not contains(l['bounds'],[min((ar[0]+ar[2])/2,(br[0]+br[2])/2),(ar[1]+ar[3]+br[1]+br[3])/4,max((ar[0]+ar[2])/2,(br[0]+br[2])/2),(ar[1]+ar[3]+br[1]+br[3])/4]):continue
     ratio=area(l['bounds'])/(area(ar)+area(br))
     span=row_span(defs[l['id']],l['matrix'],(a['bounds'][1]+a['bounds'][3]+b['bounds'][1]+b['bounds'][3])/4,min((ar[0]+ar[2])/2,(br[0]+br[2])/2),max((ar[0]+ar[2])/2,(br[0]+br[2])/2),l.get('fillStyle'))
     if 1.4<ratio<45 and span:candidates.append(dict(shapeId=l['id'],fillStyle=l.get('fillStyle'),depthPath=l['path'],bounds=[span[1],l['bounds'][1],span[2],l['bounds'][3]],colors=[span[4]],sceneBounds=scene,skinBounds=l['bounds'],eyeX=(ar[0]+ar[2]+br[0]+br[2])/4,eyeY=(ar[1]+ar[3]+br[1]+br[3])/4,rowWidth=span[0],eyeShapes=[a['id'],b['id']],ratio=ratio))
  candidates.sort(key=lambda c:(c['rowWidth'],area(c['bounds'])))
  if not candidates and ((n==1208012 and not form.startswith('getItem')) or (n==1208013 and form.startswith('getItem'))):
   face_color=(241,218,93) if n==1208012 else (124,188,251)
   matches=[l for l in leaves if l.get('fillStyle') and l['colors']==[face_color] and l['bounds'][2]-l['bounds'][0]>10 and l['bounds'][3]-l['bounds'][1]>8]
   matches.sort(key=lambda l:area(l['bounds']))
   if matches:
    l=matches[0];ref=refs.get('level4',[None])[0] if form.startswith('getItem') else None;box=l['bounds'];span=None
    if ref:
     old=ref.get('skinBounds',ref['bounds']);xx=box[0]+(ref['eyeX']-old[0])/(old[2]-old[0])*(box[2]-box[0]);yy=box[1]+(ref['eyeY']-old[1])/(old[3]-old[1])*(box[3]-box[1]);span=row_span(defs[l['id']],l['matrix'],yy,xx,xx,l['fillStyle'])
    reference=[span[1],box[1],span[2],box[3]] if span else box
    candidates=[dict(shapeId=l['id'],fillStyle=l['fillStyle'],depthPath=l['path'],bounds=reference,colors=l['colors'],sceneBounds=scene,rowWidth=reference[2]-reference[0],evidence='Verified face fill from the matching original open-eye pose; eyes are closed in this reference pose.')]
  refs[form]=candidates[:3]
 out.append(dict(path=c['path'],sha256=c['sha256'],forms=refs));print(n,{f:[(x['shapeId']+'#'+str(x.get('fillStyle')),[round(v,3) for v in x['bounds']],x['colors']) for x in cs[:1]] for f,cs in refs.items()},flush=True)
destination=base/'artifacts/all-animation-sizes/element-body-candidates.json'
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(out,indent=2)+'\n')

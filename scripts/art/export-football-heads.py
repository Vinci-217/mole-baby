"""Read anatomical eye placements from original SWF display lists, never image-white pixels.
Map them with the existing body/ball compact camera; interpolate closed/occluded
frames in body space. Normal costume raster is attached to this original rig.
"""
from pathlib import Path
import argparse,ast,copy,math,re,json,xml.etree.ElementTree as E,numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--ordinary',type=Path,required=True);p.add_argument('--evolutions',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args()
# Share the tested SWF display-list interpreter without executing its CLI.
source=ast.parse((a.repo/'scripts/art/export-registered-outfits.py').read_text());keep=[n for n in source.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in ['matrix','bounds','union','Timeline']];exec(compile(ast.Module(body=keep,type_ignores=[]),'<swf-display-list>','exec'))
forms={'junior':936,'middle':1532,'senior':1777,'super':940,'water':538,'wood':1029,'fire':898}
manifest=json.loads((a.repo/'public/assets/original/football/manifest.json').read_text());result={'description':'Original eye-symbol placements and local Y axes; original body coverage supplies forehead contact and width. Body-space interpolation for occluded eyes. Direction never inferred from white pixels, balls or teeth.','forms':{}}
def source_head(tl,sid,action,frame):
 body=union(bounds(tl.ns[s],m) for s,m in tl.action(sid,action,frame,'body')[0])
 if body is None:return None,None
 bw,bh=body[2]-body[0],body[3]-body[1];candidates=[]
 for s,m in tl.action(sid,action,frame,'all')[0]:
  colors={tuple(int(c.get(k,0)) for k in ['red','green','blue']) for c in tl.ns[s].iter('color')}
  if colors!={(255,255,255)}:continue
  b=bounds(tl.ns[s],m);w,h=b[2]-b[0],b[3]-b[1];cx,cy=(b[0]+b[2])/2,(b[1]+b[3])/2
  if not(.35<w/max(1,h)<1.65 and bw*bh*.006<w*h<bw*bh*.30 and h<bh*.8 and body[0]-bw*.05<cx<body[2]+bw*.05 and body[1]-bh*.05<cy<body[3]+bh*.05):continue
  original=tl.ns[s].find('shapeBounds');height=float(original.get('Ymax'))-float(original.get('Ymin'));axis=m[:2,1];length=np.linalg.norm(axis)
  if length<.0001:continue
  candidates.append((w*h,cx,cy,axis/length,height*length,s))
 pairs=[]
 for i,c in enumerate(candidates):
  for d in candidates[i+1:]:
   distance=math.hypot(c[1]-d[1],c[2]-d[2])
   if .08*min(bw,bh)<distance<.9*max(bw,bh):pairs.append((abs(math.log(c[0]/d[0]))-.000001*(c[0]+d[0]),c,d))
 if not pairs:return body,None
 _,c,d=min(pairs,key=lambda q:q[0]);axis=c[3]+d[3]
 if np.linalg.norm(axis)<.001:return body,None
 axis/=np.linalg.norm(axis)
 return body,[(c[1]+d[1])/2,(c[2]+d[2])/2,(c[4]+d[4])/2,math.atan2(-axis[0],axis[1])*180/math.pi]
def target_body(form):
 im=np.array(Image.open(a.repo/f'public/assets/original/slumber/{form}-mask.png').convert('RGBA'))[:208,:192];y,x=np.where((im[:,:,:3].astype(int).sum(2)>90)&(im[:,:,3]>120));return [float(x.min()),float(y.min()),float(x.max()+1),float(y.max()+1)]
def project(body,head,target):
 sx=(target[2]-target[0])/(body[2]-body[0]);sy=(target[3]-target[1])/(body[3]-body[1]);return [target[0]+(head[0]-body[0])*sx,target[1]+(head[1]-body[1])*sy,head[2]*math.sqrt(sx*sy),head[3]]
def silhouette_mount(head,mask):
 # The original symbols supply orientation. Body coverage supplies the actual
 # forehead contact; a changing facial expression must not lift a hat away.
 y,x=np.where((mask[:,:,:3].astype(int).sum(2)>90)&(mask[:,:,3]>120));angle=head[3]*math.pi/180
 right=np.array([math.cos(angle),math.sin(angle)]);up=np.array([math.sin(angle),-math.cos(angle)])
 width=float((x*right[0]+y*right[1]).max()-(x*right[0]+y*right[1]).min()+1)
 mount=np.array(head[:2],dtype=float);best=mount.copy()
 for distance in np.arange(0,max(mask.shape[:2])*1.5,.25):
  center=mount+up*distance
  for offset in [-1.2,0,1.2]:
   point=center+right*offset;px,py=int(round(point[0])),int(round(point[1]))
   if 0<=py<mask.shape[0] and 0<=px<mask.shape[1] and mask[py,px,:3].astype(int).sum()>90 and mask[py,px,3]>120:best=center;break
 return [float(best[0]),float(best[1]),width,head[3]]
for form,sid in forms.items():
 tl=Timeline(a.ordinary if form in ['junior','middle','senior'] else a.evolutions/(form+'.xml'));body,head=source_head(tl,str(sid),'down',3 if form=='junior' else 1);assert head,(form,'neutral');neutral=project(body,head,target_body(form));normal_mask=np.array(Image.open(a.repo/f'public/assets/original/slumber/{form}-mask.png').convert('RGBA'))[:208,:192];neutral=silhouette_mount(neutral,normal_mask);frames=[];valid=[]
 for i,pose in enumerate(manifest['forms'][form]['poses']):
  b,h=source_head(tl,str(sid),'football',i+1);frames.append((b,h,pose['body']))
  if b and h:valid.append(i)
 assert valid,(form,'no anatomical heads');poses=[];atlas=np.array(Image.open(a.repo/f'public/assets/original/football/{form}-mask.png').convert('RGBA'))
 for i,(b,h,target) in enumerate(frames):
  if h is None:
   left=max((n for n in valid if n<=i),default=valid[0]);right=min((n for n in valid if n>=i),default=valid[-1]);mix=0 if right==left else (i-left)/(right-left)
   def normalized(n):
    bb,hh,_=frames[n];w,he=bb[2]-bb[0],bb[3]-bb[1];return [(hh[0]-bb[0])/w,(hh[1]-bb[1])/he,hh[2]/math.sqrt(w*he),hh[3]]
   l,r=normalized(left),normalized(right);angle=l[3]+((r[3]-l[3]+180)%360-180)*mix;w,he=b[2]-b[0],b[3]-b[1];h=[b[0]+(l[0]+(r[0]-l[0])*mix)*w,b[1]+(l[1]+(r[1]-l[1])*mix)*he,(l[2]+(r[2]-l[2])*mix)*math.sqrt(w*he),angle]
  cell=manifest['forms'][form]['frameMap'][i];mask=atlas[cell//8*192:(cell//8+1)*192,cell%8*160:(cell%8+1)*160];mounted=silhouette_mount(project(b,h,target),mask);poses.append([round(float(v),4) for v in mounted])
 result['forms'][form]={'neutral':[round(float(v),4) for v in neutral],'neutralBody':target_body(form),'poses':poses,'directFrames':len(valid),'frameCount':len(frames)};print(form,len(valid),'direct original eye placements /',len(frames),flush=True)
(a.repo/'public/assets/original/football/head-poses.json').write_text(json.dumps(result,separators=(',',':'))+'\n')

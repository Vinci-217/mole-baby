"""Bind the original middle crown sequence to the unchanged junior drag body.
All bindings are baked into new PNG frames. The runtime never glues a static leaf
on top, nor replaces the junior's original squash/stretch cycle.
"""
import argparse,json,math,io,zipfile
from pathlib import Path
import numpy as np,cv2
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--original',type=Path,required=True);p.add_argument('--leaves',type=Path,required=True);p.add_argument('--clips',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--review',type=Path,required=True);a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=True);a.review.mkdir(parents=True,exist_ok=True)
W,H=192,208;views=['left','leftdown','down','rightdown','right'];base=a.repo/'public/assets/original/drag';junior=json.loads((base/'runtime.json').read_text())['forms']['junior'];jn=np.array(Image.open(base/'junior-neutral.png').convert('RGBA'));jm=np.array(Image.open(base/'junior-mask.png').convert('RGBA'))
nd=next((a.original/'frames').glob('DefineSprite_1532_*'));pd=next((a.original/'probe').glob('DefineSprite_1532_*'));ld=next(a.leaves.glob('DefineSprite_1532_*'));specs=json.loads(a.clips.read_text())['middle']
def box(mask):
 y,x=np.where(mask);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def coverage(n,q):
 d=n[:,:,:3].astype(float)-q[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1);return np.dstack([w*255,g*255,b*255,n[:,:,3]]).round().astype('uint8')
def body_mask(m):return (m[:,:,:3].sum(2)>90)&(m[:,:,3]>100)
def shine(n,m):
 b=box(body_mask(m));yy,xx=np.indices(m.shape[:2]);white=(n[:,:,:3].min(2)>235)&(n[:,:,3]>200)&(m[:,:,0]<220)&(m[:,:,1]<20)&(m[:,:,2]<20)&(yy<b[1]+(b[3]-b[1])*.4)
 count,labels,stats,centres=cv2.connectedComponentsWithStats(white.astype('uint8'));candidates=[]
 for label in range(1,count):
  ys,xs=np.where(labels==label)
  if len(xs)<5:continue
  covariance=np.cov(np.column_stack([xs,ys]).T);e,v=np.linalg.eigh(covariance)
  if e[1]/max(e[0],.1)<5:continue
  direction=v[:,1];angle=(math.degrees(math.atan2(direction[1],direction[0]))+90)%180-90
  candidates.append((float(centres[label][1]),float(centres[label][0]),angle))
 return min(candidates) if candidates else None

def fill_cyclic(values):
 valid=[i for i,v in enumerate(values) if v is not None];assert valid,'Missing head landmarks'
 count=len(values);result=[]
 for i in range(count):
  result.append(np.array([np.interp(i,[j-count for j in valid]+valid+[j+count for j in valid],[values[j][k] for j in valid]*3) for k in range(3)]))
 return result

def stem_root(leaf,m):
 body=body_mask(m);b=box(body);ys,xs=np.where(body);hull=np.zeros(body.shape,'uint8');cv2.fillConvexPoly(hull,cv2.convexHull(np.column_stack([xs,ys]).astype('int32')),1)
 yy,xx=np.indices(body.shape);central=np.abs(xx-(b[0]+b[2])/2)<(b[2]-b[0])*.3
 contact=(leaf[:,:,3]>80)&(hull>0)&central&(yy<b[1]+(b[3]-b[1])*.45)
 if not contact.any():
  distance=cv2.distanceTransform((~body).astype('uint8'),cv2.DIST_L2,3);score=distance+np.abs(xx-(b[0]+b[2])/2)*.06;valid=(leaf[:,:,3]>80)&central;assert valid.any();minimum=score[valid].min();contact=valid&(score<=minimum+1)
 ys,xs=np.where(contact);bottom=np.percentile(ys,95);end=ys>=bottom-1;return np.array([float(np.mean(xs[end])),float(np.mean(ys[end]))])

midmask=np.array(Image.open(a.repo/'public/assets/classic/middle-mask.png').convert('RGBA'))[:H,:W];mid_width=box(body_mask(midmask))[2]-box(body_mask(midmask))[0]
def bend_leaf(image,root,amount):
 if amount==0:return image.copy()
 yy,xx=np.indices(image.shape[:2],dtype=np.float32);lb=box(image[:,:,3]>16);height=max(1,root[1]-lb[1]);width=lb[2]-lb[0];x,y=xx.copy(),yy.copy()
 # A single original texture is sampled once: no cross-faded leaf outlines.
 # Root displacement is zero; outer blades bend down and follow the strain.
 for _ in range(5):
  depth=np.clip((root[1]-y)/height,0,1);outer=np.clip(np.abs(x-root[0])/(width*.55),0,1)
  swell=1+.025*amount*depth;shift=.018*width*amount*depth
  x=root[0]+(xx-root[0]-shift)/swell;y=yy-.10*height*amount*outer*depth
 return cv2.remap(image,x.astype('float32'),y.astype('float32'),cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT)

records=[];bounds=[0.,0.,float(W),float(H)]
for view in views:
 clip=junior['clips'][view];count=clip['frameCount'];source=specs[view];jframes=[]
 for index in clip['frameMap']:
  jframes.append((jn[index//8*H:(index//8+1)*H,index%8*W:(index%8+1)*W],jm[index//8*H:(index//8+1)*H,index%8*W:(index%8+1)*W]))
 frame=source['start'];an=np.array(Image.open(nd/f'{frame}.png').convert('RGBA'));am=coverage(an,np.array(Image.open(pd/f'{frame}.png').convert('RGBA')));leaf_a=np.array(Image.open(ld/f'{frame}.png').convert('RGBA'));root=stem_root(leaf_a,am)
 # Anchor the original texture at its actual stem joint, then generate the
 # bend sequence. Nothing is fitted into the body's available headroom.
 leaf_frames=[bend_leaf(leaf_a,root,i/16) for i in range(17)]
 landmarks=fill_cyclic([shine(n,m) for n,m in jframes]);rest_body=box(body_mask(jframes[0][1]));rest_x=(rest_body[0]+rest_body[2])/2;offset=rest_x-landmarks[0][1];source_body=box(body_mask(am));scale=mid_width/(source_body[2]-source_body[0]);target_angles=[max(-35,min(35,float(l[2]-landmarks[0][2]))) for l in landmarks]
 for i,(n,m) in enumerate(jframes):
  b=box(body_mask(m));neck_x=float(np.clip(landmarks[i][1]+offset,b[0]+(b[2]-b[0])*.18,b[2]-(b[2]-b[0])*.18));yy,xx=np.where(body_mask(m)&(np.abs(np.indices((H,W))[1]-neck_x)<3));neck_y=float(yy.min()+1);target=np.array([neck_x,neck_y])
  deformation=max(abs((b[2]-b[0])/(rest_body[2]-rest_body[0])-1),abs((b[3]-b[1])/(rest_body[3]-rest_body[1])-1));amount=min(1,deformation/.32);leaf_phase=round(amount*16);leaf=leaf_frames[leaf_phase]
  # Motion comes from the junior head. A short cyclic angular delay lets the
  # blades follow through while their stem remains fixed to the same skin point.
  angle=target_angles[i]*.65+target_angles[(i-1)%count]*.25+target_angles[(i-2)%count]*.10;r=math.radians(angle);linear=scale*np.array([[math.cos(r),-math.sin(r)],[math.sin(r),math.cos(r)]]);translation=target-linear@root;matrix=np.column_stack([linear,translation])
  lb=box(leaf[:,:,3]>16);corners=np.array([[lb[0],lb[1]],[lb[2],lb[1]],[lb[2],lb[3]],[lb[0],lb[3]]])@linear.T+translation
  bounds=[min(bounds[0],corners[:,0].min()),min(bounds[1],corners[:,1].min()),max(bounds[2],corners[:,0].max()),max(bounds[3],corners[:,1].max())]
  records.append({'view':view,'phase':i,'bodyIndex':clip['frameMap'][i],'sourceLeafFrame':source['start'],'leafPhase':leaf_phase,'root':root.tolist(),'targetRoot':target.tolist(),'angle':angle,'scale':scale,'matrix':matrix.tolist(),'neutral':n,'mask':m,'leaf':leaf})
ox=int(math.floor(bounds[0]/8)*8-8);oy=int(math.floor(bounds[1]/8)*8-8);cw=int(math.ceil((bounds[2]-ox+8)/8)*8);ch=int(math.ceil((bounds[3]-oy+8)/8)*8)
info={'method':'Unchanged original junior body frames; original middle leaf texture authored into a root-pinned 17-pose bend sequence, retimed by junior deformation and bound to forehead landmarks and actual stem contacts. Fixed crown scale and cyclic follow-through; no body edits.','cell':[cw,ch],'origin':[ox,oy],'bodyCell':[W,H],'bodyFrom':'junior','sourceSHA256':'01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf','forms':{}}
finished=[];visibility=[]
for record in records:
 n,m=record['neutral'],record['mask'];matrix=np.array(record['matrix']);matrix[:,2]-=[ox,oy];crown=cv2.warpAffine(record['leaf'],matrix,(cw,ch),flags=cv2.INTER_CUBIC)
 body=np.zeros((ch,cw,4),'uint8');body[-oy:-oy+H,-ox:-ox+W]=n;mask=np.zeros_like(body);mask[-oy:-oy+H,-ox:-ox+W]=m;occupied=body[:,:,3]>0;before=int((crown[:,:,3]>64).sum());crown[occupied]=0
 combined=np.array(Image.alpha_composite(Image.fromarray(crown),Image.fromarray(body)));mask[~occupied,:3]=0;mask[:,:,3]=combined[:,:,3];assert np.array_equal(combined[occupied],body[occupied]);assert not (combined[:,[0,-1],3]>64).any() and not (combined[[0,-1],:,3]>64).any()
 visible=int((crown[:,:,3]>64).sum())/max(1,before);visibility.append(visible);view=record['view'];phase=record['phase'];Image.fromarray(combined).save(a.output/f'{view}-{phase:02d}-neutral.png',optimize=True);Image.fromarray(mask).save(a.output/f'{view}-{phase:02d}-mask.png',optimize=True);finished.append((combined,mask,body))
 meta={k:v for k,v in record.items() if k not in ['neutral','mask','leaf']};meta['visibleFraction']=visible;info['forms'].setdefault(view,[]).append(meta)
(a.output/'source.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
print('Canvas',cw,ch,'origin',ox,oy,'visible crown range',min(visibility),max(visibility),flush=True)
def red(n,m):
 d=np.clip(np.array([255,204,153])[:,None]+np.array([255,-199,-250])[None,:],0,255)-np.array([255,204,153])[:,None];out=n.copy();out[:,:,:3]=np.clip(n[:,:,:3].astype(float)+m[:,:,:3].astype(float)/255@d,0,255).round().astype('uint8');return Image.fromarray(out)
scale=.55;tw=int(cw*scale);th=int(ch*scale);contact=Image.new('RGB',(tw*8,5*(th+20)),'#f7f2e6');d=ImageDraw.Draw(contact)
for vi,view in enumerate(views):
 for i in range(8):
  phase=i*14//7;n,m,_=finished[vi*15+phase];im=red(n,m).resize((tw,th),Image.Resampling.LANCZOS);contact.paste(im,(i*tw,vi*(th+20)+20),im);d.text((i*tw+3,vi*(th+20)+3),f'{view} {phase+1}',fill='#795b39')
contact.save(a.review/'frames.png',optimize=True)
gif=[];render_scale=.65;ww=int(cw*render_scale);hh=int(ch*render_scale)
for i in range(120):
 view='left' if i<60 else 'right';vi=views.index(view);phase=i%15;n,m,body=finished[vi*15+phase]
 # Both preview columns use the very same per-frame body and palette mask.
 index=junior['clips'][view]['frameMap'][phase];bodymask=np.zeros_like(m);bodymask[-oy:-oy+H,-ox:-ox+W]=jm[index//8*H:(index//8+1)*H,index%8*W:(index%8+1)*W]
 im=Image.new('RGB',(ww*2+48,hh+60),'#f7f2e6');draw=ImageDraw.Draw(im);draw.text((12,8),'Original junior frames',fill='#795b39');draw.text((ww+36,8),'Same body + bound crown',fill='#795b39')
 for x,image in [(12,red(body,bodymask)),(ww+36,red(n,m))]:
  image=image.resize((ww,hh),Image.Resampling.LANCZOS);im.paste(image,(x,30),image)
 gif.append(im)
gif[0].save(a.review/'bound-sequence.gif',save_all=True,append_images=gif[1:],duration=[40,40,40,50]*30,loop=0,optimize=True)
with zipfile.ZipFile(a.review/'frames-red.zip','w') as archive:
 for record,(n,m,_) in zip(records,finished):
  buffer=io.BytesIO();red(n,m).save(buffer,format='PNG',optimize=True);entry=zipfile.ZipInfo(f"{record['view']}/{record['phase']:02d}.png",(1980,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(entry,buffer.getvalue())
 archive.writestr('layout.json',json.dumps({'cell':[cw,ch],'origin':[ox,oy],'bodyCell':[W,H]}))
print('75 body-preserving bound frames, review GIF and PNG archive generated',flush=True)

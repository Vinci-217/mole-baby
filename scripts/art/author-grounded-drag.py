"""Create whole-character inbetweens from original grounded middle poses.
Requires numpy, Pillow and opencv-python-headless (authoring only).
No cross-stage parts, newly drawn facial features, or airborne source poses.
"""
import argparse,json,math,io,zipfile
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
import cv2
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--layers',type=Path,required=True);p.add_argument('--clips',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--review',type=Path,required=True);a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=True);a.review.mkdir(parents=True,exist_ok=True)
original_nd=next((a.source/'frames').glob('DefineSprite_1532_*'));original_pd=next((a.source/'probe').glob('DefineSprite_1532_*'));nd=next((a.layers/'plate').glob('DefineSprite_1532_*'));pd=next((a.layers/'probe').glob('DefineSprite_1532_*'));faces=next((a.layers/'faces').glob('DefineSprite_7000*'));specs=json.loads(a.clips.read_text())['middle'];repo=Path(__file__).resolve().parents[2]
W,H=192,208;views=['left','leftdown','down','rightdown','right'];COUNT=17
classic=np.array(Image.open(repo/'public/assets/classic/middle-mask.png').convert('RGBA'))[:H,:W]
def box(m):
 y,x=np.where(m);return None if not len(x) else [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def bodybox(m):return box((m[:,:,:3].sum(2)>90)&(m[:,:,3]>100))
def source(frame,original=False):
 srcn,srcp=(original_nd,original_pd) if original else (nd,pd)
 n=np.array(Image.open(srcn/f'{frame}.png').convert('RGBA'));q=np.array(Image.open(srcp/f'{frame}.png').convert('RGBA'));d=n[:,:,:3].astype(float)-q[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);dark=np.clip((d[:,:,2]+51*g)/153,0,1);white=np.clip((d[:,:,1]+51*g+102*dark)/255,0,1);mask=np.dstack([white*255,g*255,dark*255,n[:,:,3]]).round().astype('uint8');mask[n[:,:,3]==0]=0;return n,mask
def translate(im,dy):return cv2.warpAffine(im,np.float32([[1,0,0],[0,1,dy]]),(im.shape[1],im.shape[0]),flags=cv2.INTER_LINEAR)
def tint(n,m):
 deltas=np.clip(np.array([255,204,153])[:,None]+np.array([255,-199,-250])[None,:],0,255)-np.array([255,204,153])[:,None];out=n.copy();out[:,:,:3]=np.clip(n[:,:,:3].astype(float)+m[:,:,:3].astype(float)/255@deltas,0,255).round().astype('uint8');return out
def gray(n,m):
 t=tint(n,m);alpha=t[:,:,3:4].astype(float)/255;rgb=(t[:,:,:3]*alpha+np.array([247,242,230])*(1-alpha)).round().astype('uint8');return cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
def premul(im):
 f=im.astype(np.float32)/255;f[:,:,:3]*=f[:,:,3:4];return f
def unpack(f):
 out=f.copy();out[:,:,:3]=np.divide(out[:,:,:3],np.maximum(out[:,:,3:4],1e-6));out=np.clip(out*255,0,255).round().astype('uint8');out[out[:,:,3]==0]=0;return out
def warp_map(flow,amount):
 yy,xx=np.indices(flow.shape[:2],dtype=np.float32);gx,gy=xx.copy(),yy.copy()
 for _ in range(4):
  v=cv2.remap(flow,gx,gy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE);gx=xx-amount*v[:,:,0];gy=yy-amount*v[:,:,1]
 return gx,gy
def tween_pair(na,ma,nb,mb,fwd,back,t):
 if t==0:return na.copy(),ma.copy()
 if t==1:return nb.copy(),mb.copy()
 ax,ay=warp_map(fwd,t);bx,by=warp_map(back,1-t);parts=[]
 for x,y in [(na,nb),(ma,mb)]:
  aa=cv2.remap(premul(x),ax,ay,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);bb=cv2.remap(premul(y),bx,by,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT);parts.append(unpack((1-t)*aa+t*bb))
 return parts
info={'method':'Original middle grounded poses 1 and 5: body and foliage plate inbetweening with original vector eyes, pupils and highlight interpolated using their authored placement matrices; airborne frames excluded. One uniform scale/translation registers each view.','framesPerView':COUNT,'cell':[W,H],'sourceSHA256':'01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf','forms':{}}
allframes={};allmasks={};raw_reference={};tb=bodybox(classic)
for vi,view in enumerate(views):
 spec=specs[view];na,ma=source(spec['start']);nb,mb=source(spec['start']+4);ba,bb=bodybox(ma),bodybox(mb);offset=ba[3]-bb[3];nb=translate(nb,offset);mb=translate(mb,offset)
 dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM);dis.setFinestScale(0)
 fwd=dis.calc(gray(na,ma),gray(nb,mb),None);back=dis.calc(gray(nb,mb),gray(na,ma),None)
 bounds=[box(im[:,:,3]>32) for im in [na,nb]];left=min(b[0] for b in bounds);right=max(b[2] for b in bounds)
 scale=min((tb[2]-tb[0])/(ba[2]-ba[0]),(W-8)/(right-left));dx=(tb[0]+tb[2])/2-(ba[0]+ba[2])/2*scale;dx=max(4-left*scale,min(W-4-right*scale,dx));dy=tb[3]-ba[3]*scale
 frames=[];masks=[];poses=[]
 for i in range(COUNT):
  t=i/(COUNT-1);n,m=tween_pair(na,ma,nb,mb,fwd,back,t)
  # Reuse the original vector eye/pupil/highlight symbols, interpolated by
  # their original matrices. Never crossfade two displaced faces.
  face=np.array(Image.open(faces/f'{vi*COUNT+i+1}.png').convert('RGBA'));assert face.shape==n.shape
  composed=np.array(Image.alpha_composite(Image.fromarray(n),Image.fromarray(face)))
  fraction=(1-face[:,:,3:4].astype(float)/255)*np.divide(n[:,:,3:4],np.maximum(composed[:,:,3:4],1))
  m[:,:,:3]=(m[:,:,:3]*fraction).round().astype('uint8');m[:,:,3]=composed[:,:,3];n=composed
  transform=(1/scale,0,-dx/scale,0,1/scale,-dy/scale);n,m=[np.array(Image.fromarray(im).transform((W,H),Image.Transform.AFFINE,transform,Image.Resampling.BICUBIC)) for im in [n,m]]
  baseline=bodybox(m)[3];shift=tb[3]-baseline
  if shift:n=translate(n,shift);m=translate(m,shift)
  b=bodybox(m);assert abs(b[3]-tb[3])<=1;assert b[1]>=tb[1]-2
  assert not (n[:,[0,-1],3]>64).any() and not (n[0,:,3]>64).any(),f'{view}/{i}: clipping'
  Image.fromarray(n).save(a.output/f'{view}-{i:02d}-neutral.png',optimize=True);Image.fromarray(m).save(a.output/f'{view}-{i:02d}-mask.png',optimize=True)
  frames.append(n);masks.append(m);poses.append({'body':b,'compression':t,'registrationShiftY':shift})
 allframes[view]=frames;allmasks[view]=masks;info['forms'][view]={'sourceKeyframes':[spec['start'],spec['start']+4],'sourceAirborneExcluded':list(range(spec['start']+6,spec['start']+16)),'scale':scale,'translation':[dx,dy],'poses':poses}
 raw_reference[view]=[];previous=None
 for i in range(spec['count']):
  rn,rm=source(spec['start']+i,original=True)
  if bodybox(rm) is None:rn,rm=previous
  else:previous=(rn,rm)
  # Full reference uses the same scale/translation in a taller comparison cell.
  image=Image.fromarray(tint(rn,rm)).transform((W,384),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-(dy+177)/scale),Image.Resampling.BICUBIC);raw_reference[view].append(image)
 print(view,'17 original-pose inbetweens',flush=True)
(a.output/'source.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
contact=Image.new('RGB',(1080,740),'#f7f2e6');draw=ImageDraw.Draw(contact)
for y,view in enumerate(views):
 for x in range(9):
  index=x*2;im=Image.fromarray(tint(allframes[view][index],allmasks[view][index])).resize((110,119),Image.Resampling.LANCZOS);contact.paste(im,(x*120+5,y*148+20),im);draw.text((x*120+4,y*148+3),f'{view} {index+1}/17',fill='#795b39')
contact.save(a.review/'frames.png',optimize=True)
# Compare intact original jumping motion with the generated grounded sequence.
gif=[]
for frame in range(96):
 im=Image.new('RGB',(432,420),'#f7f2e6');d=ImageDraw.Draw(im);d.text((24,12),'Original movement',fill='#795b39');d.text((240,12),'Grounded drag',fill='#795b39');d.line((12,348,420,348),fill='#cbb88b',width=1)
 v='left' if frame<48 else 'right';left=raw_reference[v][frame%16];im.paste(left,(12,0),left)
 mix=(1-math.cos(frame/24*math.pi*2))/2;index=round(mix*(COUNT-1));right=Image.fromarray(tint(allframes[v][index],allmasks[v][index]));im.paste(right,(228,177),right);gif.append(im)
gif[0].save(a.review/'original-vs-grounded.gif',save_all=True,append_images=gif[1:],duration=[40,40,40,50]*24,loop=0,optimize=True)
print('Review frames and original-vs-grounded.gif written',flush=True)

with zipfile.ZipFile(a.review/'frames-red.zip','w') as archive:
 for view in views:
  for i in range(COUNT):
   buffer=io.BytesIO();Image.fromarray(tint(allframes[view][i],allmasks[view][i])).save(buffer,format='PNG',optimize=True);entry=zipfile.ZipInfo(f'{view}/{i:02d}.png',(1980,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(entry,buffer.getvalue())
 archive.writestr(zipfile.ZipInfo('README.txt',(1980,1,1,0,0,0)),('17 frames per view, original middle neutral to grounded compression. Play forward/backward for a no-jump loop. See source.json for original keys and vector facial symbols.').encode())

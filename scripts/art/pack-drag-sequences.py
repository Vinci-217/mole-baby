"""Author direction-aware drag frames from the original Ram art.
Junior retains its original direction cycles. Middle uses five original views
and newly authored horizontal-only deformation; there is no per-frame Y warp.
"""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--contact',type=Path);a=p.parse_args()
out=a.repo/'public/assets/original/drag';out.mkdir(parents=True,exist_ok=True)
W,H,COLS=192,208,8;views=['left','leftdown','down','rightdown','right']
data={'cell':[W,H],'columns':COLS,'fps':24,'sourceSHA256':'01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf','adaptation':'Original junior direction cycles; authored middle horizontal-only flex with original front, diagonal and side faces. Not an official drag clip.','forms':{}}
def box(m):
 y,x=np.where(m);return None if not len(x) else [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def coverage(n,q):
 d=n[:,:,:3].astype(float)-q[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1)
 m=np.dstack([w*255,g*255,b*255,n[:,:,3]]).round().astype('uint8');m[n[:,:,3]==0]=0;return m
def bodybox(m):return box((m[:,:,:3].sum(2)>90)&(m[:,:,3]>100))
def xflex(im,phase,tb):
 pixels=np.array(im);ys,xs=np.indices((H,W),dtype=float);depth=np.clip((ys-tb[1])/max(1,tb[3]-tb[1]),0,1)
 # Sine-envelope pins the top/bottom body rows. Only source X is sampled.
 bend=np.sin(depth*np.pi)**2;leaf=np.clip((tb[1]-ys)/25,0,1);wave=np.sin(phase);shift=2.8*wave*bend+1.8*np.sin(phase-.6)*leaf
 scale=1+.018*np.sin(phase+.4)*bend;centre=(tb[0]+tb[2])/2;ix=(xs-centre-shift)/scale+centre
 result=np.empty_like(pixels)
 for k in range(4):result[:,:,k]=ndimage.map_coordinates(pixels[:,:,k],[ys,ix],order=1,mode='constant',cval=0).round().astype('uint8')
 return Image.fromarray(result)
specs=json.loads((a.work/'clips.json').read_text())
for form,sid in [('junior',936),('middle',1532)]:
 nd=next((a.work/'frames').glob(f'DefineSprite_{sid}_*'));pd=next((a.work/'ordinary-probe-frames').glob(f'DefineSprite_{sid}_*'))
 classic=np.array(Image.open(a.repo/f'public/assets/classic/{form}-mask.png').convert('RGBA'));tb=bodybox(classic[:H,:W]);cx=(tb[0]+tb[2])/2
 frames=[];poses=[];clips={}
 for view in views:
  spec=specs[form][view];count=spec['count'] if form=='junior' else 16;mapping=[]
  first=np.array(Image.open(nd/f"{spec['start']}.png").convert('RGBA'));firstmask=coverage(first,np.array(Image.open(pd/f"{spec['start']}.png").convert('RGBA')));initial=bodybox(firstmask)
  sx=(tb[2]-tb[0])/(initial[2]-initial[0]);sy=sx if form=='junior' else (tb[3]-tb[1])/(initial[3]-initial[1])
  for i in range(count):
   source=spec['start']+(i if form=='junior' else 0);n=np.array(Image.open(nd/f'{source}.png').convert('RGBA'));m=coverage(n,np.array(Image.open(pd/f'{source}.png').convert('RGBA')));b=bodybox(m)
   if b is None:
    poses.append({**poses[-1],'sourceFrame':i+1,'sourceClearHeld':True});mapping.append(len(frames));frames.append(frames[-1]);continue
   labels,_=ndimage.label(n[:,:,3]>10);rgb=n[:,:,:3].astype(int);ids=np.unique(labels[(m[:,:,:3].sum(2)>60)|((rgb.max(2)-rgb.min(2)>30)&(n[:,:,3]>60))]);keep=np.isin(labels,ids[ids>0]);n[:,:,3]=np.where(keep,n[:,:,3],0);m[:,:,3]=n[:,:,3]
   dx=cx-(b[0]+b[2])/2*sx;dy=tb[1]-b[1]*sy
   parts=[Image.fromarray(layer).transform((W,H),Image.Transform.AFFINE,(1/sx,0,-dx/sx,0,1/sy,-dy/sy),Image.Resampling.BICUBIC) for layer in [n,m]]
   if form=='middle':parts=[xflex(im,i/count*np.pi*2,tb) for im in parts]
   actual=bodybox(np.array(parts[1]));row=2 if view.startswith('left') else 1 if view.startswith('right') else 0;wearframe=min(7,int(i/count*8)) if form=='junior' and row else 0
   old=bodybox(classic[row*H:(row+1)*H,wearframe*W:(wearframe+1)*W])
   if old is None:wearframe=0;old=bodybox(classic[row*H:(row+1)*H,:W])
   poses.append({'view':view,'sourceFrame':i+1 if form=='junior' else 1,'body':actual,'wearBody':old,'wearFrame':wearframe,'wearRow':row});mapping.append(len(frames));frames.append(parts)
  clips[view]={'frameCount':count,'frameMap':mapping}
 rows=(len(frames)+COLS-1)//COLS
 for k,kind in enumerate(['neutral','mask']):
  atlas=Image.new('RGBA',(W*COLS,H*rows))
  for i,pair in enumerate(frames):atlas.paste(pair[k],(i%COLS*W,i//COLS*H))
  atlas.save(out/f'{form}-{kind}.png',optimize=True)
 data['forms'][form]={'rows':rows,'frameCount':len(frames),'clips':clips,'poses':poses}
 print(form,len(frames),'directional drag frames')
(out/'runtime.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('*.png')},indent=2)+'\n')
if a.contact:
 contact=Image.new('RGB',(864,1320),'#f7f2e6');draw=ImageDraw.Draw(contact)
 for fi,form in enumerate(['junior','middle']):
  neutral=np.array(Image.open(out/f'{form}-neutral.png').convert('RGBA'));mask=np.array(Image.open(out/f'{form}-mask.png').convert('RGBA'));tinted=neutral.copy()
  # Same palette arithmetic as the application; source eye/leaf pixels stay intact.
  deltas=np.clip(np.array([255,204,153])[:,None]+np.array([255,-199,-250])[None,:],0,255)-np.array([255,204,153])[:,None]
  tinted[:,:,:3]=np.clip(neutral[:,:,:3].astype(float)+mask[:,:,:3].astype(float)/255@deltas,0,255).round().astype('uint8');atlas=Image.fromarray(tinted)
  for vi,view in enumerate(views):
   clip=data['forms'][form]['clips'][view]
   for i in range(8):
    index=clip['frameMap'][i*clip['frameCount']//8];x=i*108;y=(fi*5+vi)*132;draw.text((x+3,y+3),f'{form} {view} {i+1}',fill='#795b39')
    frame=atlas.crop((index%8*W,index//8*H,index%8*W+W,index//8*H+H)).resize((96,104),Image.Resampling.LANCZOS);contact.paste(frame,(x+6,y+20),frame)
 a.contact.parent.mkdir(parents=True,exist_ok=True);contact.save(a.contact,optimize=True)

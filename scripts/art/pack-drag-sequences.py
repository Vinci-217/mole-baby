"""Shared original junior drag body; middle adds only its original leaf crown.
Body/face pixels and phase order are identical for the two stages.
"""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--contact',type=Path);a=p.parse_args()
out=a.repo/'public/assets/original/drag';out.mkdir(parents=True,exist_ok=True)
W,H,COLS=192,208,8;views=['left','leftdown','down','rightdown','right']
data={'cell':[W,H],'columns':COLS,'fps':24,'sourceSHA256':'01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf','adaptation':'Both forms share the complete original junior body cycle. Middle adds an original middle crown, attached behind the unchanged body. This is a desktop adaptation, not an official middle drag clip.','forms':{}}
def box(m):
 y,x=np.where(m);return None if not len(x) else [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def coverage(n,q):
 d=n[:,:,:3].astype(float)-q[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1)
 m=np.dstack([w*255,g*255,b*255,n[:,:,3]]).round().astype('uint8');m[n[:,:,3]==0]=0;return m
def bodybox(m):return box((m[:,:,:3].sum(2)>90)&(m[:,:,3]>100))
def wardrobe(classic,view,i,count):
 row=2 if view.startswith('left') else 1 if view.startswith('right') else 0;frame=min(7,int(i/count*8)) if row else 0
 old=bodybox(classic[row*H:(row+1)*H,frame*W:(frame+1)*W])
 if old is None:frame=0;old=bodybox(classic[row*H:(row+1)*H,:W])
 return {'wearBody':old,'wearFrame':frame,'wearRow':row}
def write_form(form,frames,poses,clips):
 rows=(len(frames)+COLS-1)//COLS
 for k,kind in enumerate(['neutral','mask']):
  atlas=Image.new('RGBA',(W*COLS,H*rows))
  for i,pair in enumerate(frames):atlas.paste(pair[k],(i%COLS*W,i//COLS*H))
  atlas.save(out/f'{form}-{kind}.png',optimize=True)
 data['forms'][form]={'rows':rows,'frameCount':len(frames),'bodyFrom':'junior','clips':clips,'poses':poses}
 print(form,len(frames),'shared-body directional frames',flush=True)
specs=json.loads((a.work/'clips.json').read_text());nd=next((a.work/'frames').glob('DefineSprite_936_*'));pd=next((a.work/'ordinary-probe-frames').glob('DefineSprite_936_*'))
classic=np.array(Image.open(a.repo/'public/assets/classic/junior-mask.png').convert('RGBA'));tb=bodybox(classic[:H,:W]);cx=(tb[0]+tb[2])/2
frames=[];poses=[];clips={}
for view in views:
 spec=specs['junior'][view];count=spec['count'];mapping=[]
 first=np.array(Image.open(nd/f"{spec['start']}.png").convert('RGBA'));firstmask=coverage(first,np.array(Image.open(pd/f"{spec['start']}.png").convert('RGBA')));initial=bodybox(firstmask);sx=(tb[2]-tb[0])/(initial[2]-initial[0])
 for i in range(count):
  source=spec['start']+i;n=np.array(Image.open(nd/f'{source}.png').convert('RGBA'));m=coverage(n,np.array(Image.open(pd/f'{source}.png').convert('RGBA')));b=bodybox(m)
  if b is None:
   poses.append({**poses[-1],'sourceFrame':i+1,'sourceClearHeld':True});mapping.append(len(frames));frames.append(frames[-1]);continue
  labels,_=ndimage.label(n[:,:,3]>10);rgb=n[:,:,:3].astype(int);ids=np.unique(labels[(m[:,:,:3].sum(2)>60)|((rgb.max(2)-rgb.min(2)>30)&(n[:,:,3]>60))]);keep=np.isin(labels,ids[ids>0]);n[:,:,3]=np.where(keep,n[:,:,3],0);m[:,:,3]=n[:,:,3]
  dx=cx-(b[0]+b[2])/2*sx;dy=tb[1]-b[1]*sx
  parts=[Image.fromarray(layer).transform((W,H),Image.Transform.AFFINE,(1/sx,0,-dx/sx,0,1/sx,-dy/sx),Image.Resampling.BICUBIC) for layer in [n,m]]
  poses.append({'view':view,'sourceFrame':i+1,'body':bodybox(np.array(parts[1])),**wardrobe(classic,view,i,count)});mapping.append(len(frames));frames.append(parts)
 clips[view]={'frameCount':count,'frameMap':mapping}
write_form('junior',frames,poses,clips)
# Use the original crown for each view; never use/repaint a middle face.
mid_neutral=next((a.work/'frames').glob('DefineSprite_1532_*'));mid_classic=np.array(Image.open(a.repo/'public/assets/classic/middle-mask.png').convert('RGBA'))
mid_frames=[];mid_poses=[]
for view in views:
 spec=specs['middle'][view];clip=clips[view]
 for i,index in enumerate(clip['frameMap']):
  source=spec['start'];n=np.array(Image.open(mid_neutral/f'{source}.png').convert('RGBA'));rgb=n[:,:,:3].astype(int)
  green=(rgb[:,:,1]>rgb[:,:,0]+8)&(rgb[:,:,1]>rgb[:,:,2]+8)&(n[:,:,3]>8)
  assert green.any(),f'Missing original crown: {view}'
  l,t,r,b=box(green);leaf=n.copy();leaf[~green]=0;leaf=Image.fromarray(leaf).crop((l,t,r,b))
  # The stem is the bottom of the narrow central band. Root it inside the
  # upper body and paint the body last, preserving every original face pixel.
  ys,xs=np.where(green);central=np.abs(xs-(l+r)/2)<(r-l)*.1;root_y=int(ys[central].max()) if central.any() else b-1;bottom=central&(ys>=root_y-2);root_x=float(xs[bottom].mean()) if bottom.any() else (l+r)/2
  jn=np.array(frames[index][0]);jm=np.array(frames[index][1]);body=(jm[:,:,:3].sum(2)>90)&(jm[:,:,3]>100);bb=poses[index]['body'];neck_x=(bb[0]+bb[2])/2;yy,xx=np.where(body&(np.abs(np.indices(body.shape)[1]-neck_x)<3));neck_y=int(yy.min())+10
  scale=min(120/(r-l),(neck_y-2)/max(1,root_y-t));dx=neck_x-(root_x-l)*scale;dy=neck_y-(root_y-t)*scale
  crown=np.array(leaf.transform((W,H),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),Image.Resampling.BICUBIC))
  assert not (crown[:,[0,-1],3]>32).any() and not (crown[0,:,3]>32).any(),f'{view}/{i}: crown clipped'
  occupied=jn[:,:,3]>0;crown[occupied]=0
  combined=np.array(Image.alpha_composite(Image.fromarray(crown),Image.fromarray(jn)));mask=jm.copy();mask[~occupied,:3]=0;mask[:,:,3]=combined[:,:,3]
  assert np.array_equal(combined[occupied],jn[occupied]),f'{view}/{i}: original body changed'
  assert np.array_equal(mask[occupied],jm[occupied]),f'{view}/{i}: body tint changed'
  assert bodybox(mask)==poses[index]['body']
  mid_frames.append((Image.fromarray(combined),Image.fromarray(mask)));mid_poses.append({**poses[index],**wardrobe(mid_classic,view,i,clip['frameCount']),'crownSourceFrame':source,'crownRoot':[neck_x,neck_y]})
write_form('middle',mid_frames,mid_poses,clips)
(out/'runtime.json').write_text(json.dumps(data,separators=(',',':'))+'\n');(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('*.png')},indent=2)+'\n')
if a.contact:
 contact=Image.new('RGB',(864,1320),'#f7f2e6');draw=ImageDraw.Draw(contact)
 for fi,form in enumerate(['junior','middle']):
  neutral=np.array(Image.open(out/f'{form}-neutral.png').convert('RGBA'));mask=np.array(Image.open(out/f'{form}-mask.png').convert('RGBA'));tinted=neutral.copy();deltas=np.clip(np.array([255,204,153])[:,None]+np.array([255,-199,-250])[None,:],0,255)-np.array([255,204,153])[:,None]
  tinted[:,:,:3]=np.clip(neutral[:,:,:3].astype(float)+mask[:,:,:3].astype(float)/255@deltas,0,255).round().astype('uint8');atlas=Image.fromarray(tinted)
  for vi,view in enumerate(views):
   clip=data['forms'][form]['clips'][view]
   for i in range(8):
    index=clip['frameMap'][i*clip['frameCount']//8];x=i*108;y=(vi*2+fi)*132;draw.text((x+3,y+3),f'{form} {view} {i+1}',fill='#795b39');frame=atlas.crop((index%8*W,index//8*H,index%8*W+W,index//8*H+H)).resize((96,104),Image.Resampling.LANCZOS);contact.paste(frame,(x+6,y+20),frame)
 a.contact.parent.mkdir(parents=True,exist_ok=True);contact.save(a.contact,optimize=True)

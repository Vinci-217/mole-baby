from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
import argparse
p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);args=p.parse_args()
b=args.work;repo=args.repo;out=repo/'public/assets/original/grounded';out.mkdir(exist_ok=True)
def get(kind,mode,sid):return Image.open(next((b/(kind+'-'+mode)).glob('DefineSprite_'+sid+'*/*.png'))).convert('RGBA')
def mask(a,b):
 a=np.asarray(a);b=np.asarray(b);d=a[:,:,:3].astype(float)-b[:,:,:3].astype(float)
 gray=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);dark=np.clip((d[:,:,2]+51*gray)/153,0,1);white=np.clip((d[:,:,1]+51*gray+102*dark)/255,0,1)
 m=np.dstack([np.rint(white*255),np.rint(gray*255),np.rint(dark*255),a[:,:,3]]).astype('uint8');m[a[:,:,3]==0]=0
 return Image.fromarray(m)
def bounds(m):
 a=np.asarray(m);y,x=np.where((a[:,:,:3].sum(axis=2)>90)&(a[:,:,3]>150));return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
info={}
for form,sid in [('junior','936'),('middle','1532')]:
 neutral=[get(k,'neutral',sid) for k in ['open','half','closed','pupils','leaves']];masks=[mask(n,get(k,'probe',sid)) for n,k in zip(neutral,['open','half','closed','pupils','leaves'])]
 old=Image.open(repo/f'public/assets/classic/{form}-mask.png').convert('RGBA').crop((0,0,192,208));target=bounds(old);source=bounds(masks[0]);scale=(target[2]-target[0])/(source[2]-source[0]);dx=(target[0]+target[2])/2-(source[0]+source[2])/2*scale;dy=target[3]-source[3]*scale
 for mode,ims in [('neutral',neutral),('mask',masks)]:
  atlas=Image.new('RGBA',(192*5,208))
  for i,im in enumerate(ims):
   placed=im.transform((192,208),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),Image.Resampling.BICUBIC)
   atlas.paste(placed,(i*192,0))
  atlas.save(out/f'{form}-{mode}.png',optimize=True)
 info[form]={'sourceBodyBounds':source,'targetBodyBounds':target,'scale':scale,'translation':[dx,dy]}
source={'description':'Original SWF layers recomposed for calm desktop motion; blink timing and gaze are adaptations, not official animation timelines.','source':'lamubone.swf','sha256':'01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf','cell':[192,208],'columns':['body-white-eyes','half-blink','original-happy-eyelids','pupils','leaves'],'canonicalFrames':{'junior':3,'middle':1},'closedEyeShape':665,'registration':info}
metadata=out/'source.json'
if metadata.exists():
 existing=json.loads(metadata.read_text());existing.update(source);source=existing
source['files']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('*.png')}
(out/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')

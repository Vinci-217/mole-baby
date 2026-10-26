"""Small ORIGINAL happy opening, registered to the normal body; no laugh/roll.
Source exports: v21 football/boring/happy; canonical body registration from classic masks.
"""
from pathlib import Path
import json,hashlib,argparse
import numpy as np
from PIL import Image
from scipy import ndimage
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args()
out=a.repo/'public/assets/original/affection';out.mkdir(parents=True,exist_ok=True)
runtime={'cell':[192,208],'columns':8,'forms':{},'adaptation':'The original happy opening, small closed smiling eyes; never the subsequent wide laugh or somersault.'}
def mask(n,q):
 d=n[:,:,:3].astype(float)-q[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1)
 r=np.dstack([w*255,g*255,b*255,n[:,:,3]]).round().astype('uint8');r[n[:,:,3]==0]=0;return r
def box(m):
 y,x=np.where(m);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
for form,sid in {'junior':936,'middle':1532,'senior':1777,'super':940,'water':538,'wood':1029,'fire':898}.items():
 ordinary=form in ['junior','middle','senior'];spec=json.loads((a.source/('clips.json' if ordinary else form+'-clips.json')).read_text());spec=spec[form] if ordinary else spec;clip=spec['happy']
 nd=next((a.source/('frames' if ordinary else form+'-frames')).glob(f'DefineSprite_{sid}_*'));pd=next((a.source/('ordinary-probe-frames' if ordinary else form+'-probe-frames')).glob(f'DefineSprite_{sid}_*'))
 target=np.array(Image.open(a.repo/f'public/assets/classic/{form}-mask.png').convert('RGBA'))[:208,:192];tb=box((target[:,:,:3].sum(2)>90)&(target[:,:,3]>100));tw=tb[2]-tb[0];cx=(tb[0]+tb[2])/2
 happy=[1]*8 if form in ['senior','water','wood','fire'] else [1,1,2,3,4,3,2,1];parts=[];poses=[]
 for f in happy:
  n=np.array(Image.open(nd/f"{clip['start']+f-1}.png").convert('RGBA'));m=mask(n,np.array(Image.open(pd/f"{clip['start']+f-1}.png").convert('RGBA')));b=box((m[:,:,:3].sum(2)>90)&(n[:,:,3]>100))
  labels,_=ndimage.label(n[:,:,3]>12);rgb=n[:,:,:3].astype(int);ids=np.unique(labels[(m[:,:,:3].sum(2)>80)|((rgb.max(2)-rgb.min(2)>30)&(n[:,:,3]>80))]);keep=np.isin(labels,ids[ids>0]);n[:,:,3]=np.where(keep,n[:,:,3],0);m[:,:,3]=n[:,:,3]
  if not parts:scale=tw/(b[2]-b[0])
  dx=cx-(b[0]+b[2])/2*scale;dy=tb[3]-b[3]*scale
  pair=[Image.fromarray(v).transform((192,208),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),Image.Resampling.BICUBIC) for v in [n,m]];parts.append(pair);poses.append([round(b[0]*scale+dx,3),round(b[1]*scale+dy,3),round(b[2]*scale+dx,3),round(b[3]*scale+dy,3)])
 for layer,name in enumerate(['neutral','mask']):
  atlas=Image.new('RGBA',(192*8,208))
  for i,pair in enumerate(parts):atlas.paste(pair[layer],(i*192,0))
  atlas.save(out/f'{form}-{name}.png',optimize=True)
 runtime['forms'][form]={'sourceSprite':sid,'sourceAction':'happy','sourceFrames':happy,'body':poses,'maximumSourceFrame':4}
(out/'source.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2)+'\n')
(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('*.png')},indent=2)+'\n')

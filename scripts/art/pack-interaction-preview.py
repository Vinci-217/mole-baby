"""Pack original complete timelines for REVIEW ONLY, never change shipping atlases.

Input: prepare-original-actions.py --actions down,left,right,happy,boring
       --forms ordinary,super --omit-middle-insect.
Source pose timing, eyes, mouth and foliage remain together. Only a uniform
registration and body-only four-colour mask are applied.
"""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--original',type=Path,required=True);p.add_argument('--source-swf',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2];CELL=256;COLS=8
forms={'junior':936,'middle':1532,'senior':1777,'super':940}
manifest={'fps':24,'cell':CELL,'columns':COLS,'sourceSHA256':hashlib.sha256(a.source_swf.read_bytes()).hexdigest(),'forms':{},'props':{}}

def coverage(n,pr):
 d=n[:,:,:3].astype(float)-pr[:,:,:3].astype(float)
 g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1)
 m=np.dstack([w*255,g*255,b*255,n[:,:,3]]).round().astype('uint8');m[n[:,:,3]==0]=0
 return m
def box(mask):
 y,x=np.where(mask);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)] if len(x) else None
def read(folder,frame):return np.array(Image.open(folder/f'{frame}.png').convert('RGBA'))
def keep_character(n,m):
 labels,_=ndimage.label(n[:,:,3]>10)
 rgb=n[:,:,:3].astype(int);identity=(m[:,:,:3].sum(2)>40)|((rgb.max(2)-rgb.min(2)>32)&(n[:,:,3]>30))
 valid=np.unique(labels[identity]);valid=valid[valid>0]
 return np.isin(labels,valid)
def tint(n,m):
 bases=np.array([255,204,153])[:,None];d=np.clip(bases+np.array([255,-199,-250])[None,:],0,255)-bases
 out=n.copy();out[:,:,:3]=np.clip(n[:,:,:3]+(m[:,:,:3]/255)@d,0,255).round().astype('uint8');return out
def transform(n,s,dx,dy):return Image.fromarray(n).transform((CELL,CELL),Image.Transform.AFFINE,(1/s,0,-dx/s,0,1/s,-dy/s),Image.Resampling.BICUBIC)
def pack(name,images):
 atlas=Image.new('RGBA',(CELL*COLS,CELL*((len(images)+COLS-1)//COLS)))
 for i,im in enumerate(images):atlas.paste(im,((i%COLS)*CELL,(i//COLS)*CELL))
 atlas.save(a.out/(name+'.png'),optimize=True)

for form,sid in forms.items():
 ordinary=form!='super';nd=next((a.work/('frames' if ordinary else 'super-frames')).glob(f'DefineSprite_{sid}_*'));pd=next((a.work/('ordinary-probe-frames' if ordinary else 'super-probe-frames')).glob(f'DefineSprite_{sid}_*'))
 specs=json.loads((a.work/('clips.json' if ordinary else 'super-clips.json')).read_text());specs=specs[form] if ordinary else specs
 first=read(nd,1);fm=coverage(first,read(pd,1));base=box((fm[:,:,:3].sum(2)>60)&(first[:,:,3]>100));target=np.array(Image.open(repo/f'public/assets/classic/{form}-mask.png'))[:208,:192];tb=box(target[:,:,:3].sum(2)>90)
 s=(tb[2]-tb[0])/(base[2]-base[0]);dx=(tb[0]+tb[2])/2+32-(base[0]+base[2])/2*s;dy=tb[3]+24-base[3]*s
 unique=[];hashes={};clips={}
 for action,spec in specs.items():
  if action=='boring' and form!='middle':continue
  frame_map=[];poses=[];fly=[]
  oldspec=json.loads((a.original/'clips.json').read_text())['middle']['boring'] if form=='middle' and action=='boring' else None
  if oldspec:
   oldn=next((a.original/'frames').glob('DefineSprite_1532_*'));oldp=next((a.original/'ordinary-probe-frames').glob('DefineSprite_1532_*'))
   oldfirst=read(oldn,oldspec['start']);oldbase=box(coverage(oldfirst,read(oldp,oldspec['start']))[:,:,:3].sum(2)>60)
   nowfirst=read(nd,spec['start']);nowbase=box(coverage(nowfirst,read(pd,spec['start']))[:,:,:3].sum(2)>60)
   shift=(nowbase[0]-oldbase[0],nowbase[1]-oldbase[1]);originals=[]
  for index in range(spec['count']):
   frame=spec['start']+index;n=read(nd,frame);m=coverage(n,read(pd,frame));body=box((m[:,:,:3].sum(2)>60)&(n[:,:,3]>100))
   if body is None:
    # Flash's clear/reset cell must not make the desktop pet flash invisible.
    # Hold it for exactly one SOURCE frame, preserving timing and order.
    if not frame_map:raise ValueError('Clip begins without a visible character')
    frame_map.append(frame_map[-1]);poses.append({**poses[-1],'sourceFrame':index+1,'sourceClearHeld':True})
    if oldspec:fly.append(None);originals.append(originals[-1])
    continue
   keep=keep_character(n,m);n[:,:,3]=np.where(keep,n[:,:,3],0);m[:,:,3]=n[:,:,3]
   art=box(n[:,:,3]>20)
   # Match the approved football camera: whole ORIGINAL poses, small uniform
   # camera motion. A somersault may not disappear outside a cropped cell.
   fs=min(s,232/max(1,art[2]-art[0]),232/max(1,art[3]-art[1]))
   cx=(body[0]+body[2])/2;restcx=(base[0]+base[2])/2
   tx=(tb[0]+tb[2])/2+32+18*np.tanh((cx-restcx)*s/18)
   floor=tb[3]+24+18*np.tanh((body[3]-base[3])*s/18)
   fx=tx-cx*fs;fy=floor-body[3]*fs
   fx=float(np.clip(fx,10-art[0]*fs,CELL-10-art[2]*fs));fy=float(np.clip(fy,10-art[1]*fs,CELL-10-art[3]*fs))
   neutral=transform(n,fs,fx,fy);mask=transform(m,fs,fx,fy);key=hashlib.sha256(neutral.tobytes()+mask.tobytes()).hexdigest()
   if key not in hashes:hashes[key]=len(unique);unique.append((neutral,mask))
   frame_map.append(hashes[key]);pixels=np.array(neutral);b=box(pixels[:,:,3]>30);project=lambda b:[round(b[0]*fs+fx,3),round(b[1]*fs+fy,3),round(b[2]*fs+fx,3),round(b[3]*fs+fy,3)]
   ys,xs=np.where((pixels[:,:,3]>100)&(np.indices(pixels.shape[:2])[0]<=b[1]+7));middle=(project(body)[0]+project(body)[2])/2;k=int(np.argmin(abs(xs-middle)+(ys-b[1])*.15))
   poses.append({'body':project(body),'art':b,'head':[int(xs[k]),int(ys[k])],'sourceFrame':index+1,'camera':[round(fs,6),round(fx,5),round(fy,5)]})
   if oldspec:
    old=read(oldn,oldspec['start']+index);om=coverage(old,read(oldp,oldspec['start']+index));rgb=old[:,:,:3];red=(rgb[:,:,0]>140)&(rgb[:,:,1]<100)&(rgb[:,:,2]<100)&(old[:,:,3]>150);fb=box(red)
    fly.append([round(((fb[0]+fb[2])/2+shift[0])*fs+fx,3),round(((fb[1]+fb[3])/2+shift[1])*fs+fy,3)] if fb else None)
    # Body/crown are identical in both panels. Add ONLY the original insect to
    # the reference panel; do not accidentally restore ground shadows.
    insect=old.copy();labels,_=ndimage.label(old[:,:,3]>5);ids=np.unique(labels[red]);ids=ids[ids>0];keepfly=np.isin(labels,ids);insect[:,:,3]=np.where(keepfly,old[:,:,3],0)
    reference=Image.fromarray(tint(np.array(neutral),np.array(mask)));reference.alpha_composite(transform(insect,fs,fx+shift[0]*fs,fy+shift[1]*fs));originals.append(reference)
  clips[action]={'sourceClip':spec['child'],'frameCount':len(frame_map),'frameMap':frame_map,'poses':poses}
  if oldspec:
   clips[action]['insect']=fly;pack('middle-boring-original',originals)
 for i,kind in enumerate(['neutral','mask']):pack(form+'-'+kind,[pair[i] for pair in unique])
 pack(form+'-red',[Image.fromarray(tint(np.array(n),np.array(m))) for n,m in unique])
 manifest['forms'][form]={'sourceSprite':sid,'count':len(unique),'canonical':{'junior':2,'middle':0,'senior':0,'super':0}[form],'clips':clips}
 print(form,len(unique),'unique original cells',flush=True)

# The small glove/net/butterfly sheet is newly generated flat accompaniment;
# it is not labelled as an official prop, and never changes source pet pixels.
sheet=Image.open(a.out/'interaction-props-sheet.png').convert('RGBA');w,h=sheet.size
names=['hand-ready','hand-stroke','hand-leave','net','butterfly-0','butterfly-1','butterfly-2','butterfly-3']
for i,name in enumerate(names):
 col,row=i%4,i//4;im=sheet.crop((round(col*w/4),round(row*h/2),round((col+1)*w/4),round((row+1)*h/2)))
 if name.startswith('butterfly'):im.save(a.out/(name+'.png'),optimize=True)
 else:
  alpha=np.array(im)[:,:,3];b=box(alpha>5);im=im.crop(b);im.save(a.out/(name+'.png'),optimize=True)
 manifest['props'][name]=list(im.size)
manifest['props']['provenance']='AI-generated flat glove, net and butterfly accompaniment; original character animation is unmodified.'
seed=np.array(Image.open(repo/'public/assets/original/seed/body.png').convert('RGBA'));sm=np.array(Image.open(repo/'public/assets/original/seed/body-mask.png').convert('RGBA'))
Image.fromarray(tint(seed,sm)).save(a.out/'seed-red.png',optimize=True)
manifest['files']={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in a.out.glob('*.png')}
(a.out/'manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print('PASS original frame timing, source registration, separate generated props; shipping atlases untouched',flush=True)

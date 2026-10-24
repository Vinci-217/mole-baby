"""Pack selected ORIGINAL happy/angry frames; never draw a new Ram face.

Input: prepare-original-actions.py --actions angry,happy,boring.
The grumpy gesture uses the opening frown and its reverse, excluding the
ordinary junior's later screaming mouth. This is an explicitly edited gesture.
"""
from pathlib import Path
import argparse,json,hashlib
import numpy as np
from PIL import Image

p=argparse.ArgumentParser();p.add_argument('--work',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args()
out=a.repo/'public/assets/original/emotions';out.mkdir(parents=True,exist_ok=True)
ids={'junior':936,'middle':1532,'senior':1777,'super':940,'water':538,'wood':1029,'fire':898}
runtime={'fps':24,'columns':8,'cell':[192,208],'forms':{}}
def coverage(n,probe):
 x=np.asarray(n);d=x[:,:,:3].astype(float)-np.asarray(probe)[:,:,:3].astype(float)
 g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1)
 mask=np.dstack([w*255,g*255,b*255,x[:,:,3]]).round().astype('uint8');mask[x[:,:,3]==0]=0
 return Image.fromarray(mask)
for form,sid in ids.items():
 ordinary=form in ['junior','middle','senior'];specs=json.loads((a.work/('clips.json' if ordinary else form+'-clips.json')).read_text());specs=specs[form] if ordinary else specs
 nd=next((a.work/('frames' if ordinary else form+'-frames')).glob(f'DefineSprite_{sid}_*'));pd=next((a.work/('ordinary-probe-frames' if ordinary else form+'-probe-frames')).glob(f'DefineSprite_{sid}_*'))
 target=np.array(Image.open(a.repo/f'public/assets/classic/{form}-mask.png').convert('RGBA'))[:208,:192];ty,tx=np.where((target[:,:,:3].sum(2)>90)&(target[:,:,3]>100));target_width=tx.max()-tx.min()+1;target_x=(tx.min()+tx.max()+1)/2;target_bottom=ty.max()+1
 runtime['forms'][form]={}
 for action,label in [('joy','happy'),('grumpy','angry')]:
  spec=specs[label];frames=list(range(spec['start'],spec['start']+spec['count']))
  if action=='grumpy':
   opening=frames[:min(8 if form=='junior' else 12,spec['count']-1)];frames=opening+[opening[-1]]*(10 if form=='junior' else 4)+opening[-2::-1]
  elif len(frames)<24:frames=frames*3
  images=[];first=None;source_frames=[]
  for f in frames:
   n=Image.open(nd/f'{f}.png').convert('RGBA');pr=Image.open(pd/f'{f}.png').convert('RGBA');mask=coverage(n,pr);m=np.asarray(mask);ys,xs=np.where((m[:,:,:3].sum(2)>90)&(m[:,:,3]>100))
   if not len(xs):continue
   box=[xs.min(),ys.min(),xs.max()+1,ys.max()+1]
   if first is None:first=box
   scale=target_width/(first[2]-first[0]);cx=(box[0]+box[2])/2;rest=(first[0]+first[2])/2
   dx=target_x+4*np.tanh((cx-rest)*scale/4)-cx*scale;dy=target_bottom+3*np.tanh((box[3]-first[3])*scale/3)-box[3]*scale
   parts=[im.transform((192,208),Image.Transform.AFFINE,(1/scale,0,-dx/scale,0,1/scale,-dy/scale),Image.Resampling.BICUBIC) for im in [n,mask]]
   images.append(parts);source_frames.append(f-spec['start']+1)
  unique=[];seen={};frame_map=[]
  for parts in images:
   key=hashlib.sha256(parts[0].tobytes()+parts[1].tobytes()).hexdigest()
   if key not in seen:seen[key]=len(unique);unique.append(parts)
   frame_map.append(seen[key])
  rows=(len(unique)+7)//8
  for layer,kind in enumerate(['neutral','mask']):
   atlas=Image.new('RGBA',(192*8,208*rows))
   for i,parts in enumerate(unique):atlas.paste(parts[layer],(i%8*192,i//8*208))
   atlas.save(out/f'{form}-{action}-{kind}.png',optimize=True)
  runtime['forms'][form][action]={'sourceSprite':sid,'sourceAction':label,'sourceClip':spec['child'],'sourceFrames':source_frames,'frameCount':len(frame_map),'frameMap':frame_map,'rows':rows,'reducedFrame':frame_map[min(len(frame_map)-1,12)]}
  print(form,action,len(frame_map),flush=True)
(out/'runtime.json').write_text(json.dumps(runtime,separators=(',',':'))+'\n')
(out/'checksums.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('*.png')},indent=2)+'\n')
(out/'source.json').write_text(json.dumps({'sourceFiles':json.loads((a.repo/'public/assets/original/football/source.json').read_text())['sourceFiles'],'adaptation':'Original happy source frames; short original angry opening followed in reverse for a finite mild frown, excluding the junior screaming section. Common compact body registration; no new face drawing.'},indent=2)+'\n')

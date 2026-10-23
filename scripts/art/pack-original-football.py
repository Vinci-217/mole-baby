"""Pack original football timelines with a compact camera, never redraw the pet.

Input: prepare-original-actions.py exports. Requires Pillow, NumPy and SciPy.
The same affine transform is applied to body, eyes, crown and ball per frame.
"""
from pathlib import Path
import argparse, hashlib, json
import numpy as np
from PIL import Image
from scipy import ndimage

parser=argparse.ArgumentParser()
parser.add_argument('--work',type=Path,required=True)
parser.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2])
a=parser.parse_args();p=a.work;out=a.repo/'public/assets/original/football';out.mkdir(parents=True,exist_ok=True)
IDS={'junior':936,'middle':1532,'senior':1777,'super':940,'water':538,'wood':1029,'fire':898}
CONTACTS={'junior':[49,111,170,196],'middle':[22,58,83,108],'senior':[15,39,56,88],'super':[43,76],'water':[15,39,56,88],'wood':[15,39,56,88],'fire':[15,39,56,88]}

def coverage(n,pr):
 x=np.asarray(n);d=x[:,:,:3].astype(float)-np.asarray(pr)[:,:,:3].astype(float)
 g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);b=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*b)/255,0,1)
 mask=np.dstack([w*255,g*255,b*255,x[:,:,3]]).round().astype('uint8');mask[x[:,:,3]==0]=0
 return Image.fromarray(mask)

manifest={'cell':[160,192],'columns':8,'fps':24,'viewport':[320,384],'origin':[64,128],'forms':{}}
for form,sid in IDS.items():
 ordinary=form in ['junior','middle','senior'];nd=next((p/('frames' if ordinary else f'{form}-frames')).glob(f'DefineSprite_{sid}_*'));pd=next((p/('ordinary-probe-frames' if ordinary else f'{form}-probe-frames')).glob(f'DefineSprite_{sid}_*'))
 specs=json.loads((p/('clips.json' if ordinary else f'{form}-clips.json')).read_text());spec=(specs[form] if ordinary else specs)['football']
 boxes=[]
 for f in range(1,spec['count']+1):
  n=np.array(Image.open(nd/f'{f}.png').convert('RGBA'));pr=np.array(Image.open(pd/f'{f}.png').convert('RGBA'));ys,xs=np.where((abs(n[:,:,:3].astype(int)-pr[:,:,:3].astype(int)).sum(2)>30)&(n[:,:,3]>180));boxes.append([int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)] if len(xs) else None)
 target=np.array(Image.open(a.repo/f'public/assets/classic/{form}-mask.png').convert('RGBA'))[:208,:192];ys,xs=np.where(target[:,:,:3].sum(2)>90);first=boxes[0];scale=(xs.max()-xs.min()+1)/(first[2]-first[0]);tcx=(xs.min()+xs.max()+1)/2+64;floor=323;restx=(first[0]+first[2])/2;restbottom=first[3]
 unique=[];hashes={};frame_map=[];records=[]
 for index,box in enumerate(boxes):
  if box is None:continue # Last source frame clears its display list; stop at the return pose.
  neutral=Image.open(nd/f'{index+1}.png').convert('RGBA');probe=Image.open(pd/f'{index+1}.png').convert('RGBA');pixels=np.array(neutral);pr=np.array(probe);rgb=pixels[:,:,:3].astype(int)
  body=(abs(rgb-pr[:,:,:3].astype(int)).sum(2)>30)&(pixels[:,:,3]>100);alpha=pixels[:,:,3]>80
  keep=alpha.copy()
  # A source shadow is a detached grey ellipse. Keep all character pixels;
  # its original registration is also used for the ball and the crown.
  mask=coverage(neutral,probe);pixels[:,:,3]=np.where(keep,pixels[:,:,3],0);neutral=Image.fromarray(pixels)
  cx=(box[0]+box[2])/2;cy=(box[1]+box[3])/2;gray=(rgb.max(2)-rgb.min(2)<12)&keep;gray[max(0,box[1]-3):box[3]+3,max(0,box[0]-3):box[2]+3]=False
  lab,_=ndimage.label(gray);balls=[]
  for label,sl in enumerate(ndimage.find_objects(lab),1):
   if sl is None:continue
   px=rgb[sl][lab[sl]==label];h=sl[0].stop-sl[0].start;w=sl[1].stop-sl[1].start
   if min(w,h)>10 and .3<w/h<3 and (px.max(1)<50).sum()>8 and (px.min(1)>220).sum()>20:balls.append((len(px),[sl[1].start,sl[0].start,sl[1].stop,sl[0].stop]))
  ball=max(balls,default=(0,None))[1];near=bool(ball and np.hypot((ball[0]+ball[2])/2-cx,(ball[1]+ball[3])/2-cy)<max(box[2]-box[0],ball[2]-ball[0])*2.1)
  core=body|((rgb.max(2)-rgb.min(2)>30)&keep);ys,xs=np.where(core);group=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
  if near:group=[min(group[0],ball[0]),min(group[1],ball[1]),max(group[2],ball[2]),max(group[3],ball[3])]
  # Follow the original long excursion in a small desktop camera. Fit the
  # character, not distant flying ornaments: body size remains recognizable.
  # The ball and body always share this transform, including standing on it.
  crown=(1.65 if form=='super' else 1.3)*(box[2]-box[0]) if form not in ['junior','middle'] else (box[2]-box[0])*.8 if form=='middle' else 0
  local_top=box[1]-crown
  if near:local_top=min(local_top,ball[1])
  local_bottom=max(box[3],ball[3]) if near else box[3]
  s=float(scale*min(1,366/max(1,(local_bottom-local_top)*scale),284/max(1,(box[2]-box[0])*scale)))
  # At contact, frame the body and nearby ball together; distant ornaments
  # never shrink the pet. A kick entering from outside may be clipped.
  contact=bool(ball and max(0,box[0]-ball[2],ball[0]-box[2])+max(0,box[1]-ball[3],ball[1]-box[3])<(box[2]-box[0])*.25)
  left=min(box[0],ball[0]) if contact else box[0]
  right=max(box[2],ball[2]) if contact else box[2]
  if contact:s=min(s,292/max(1,right-left))
  dx=float(tcx+24*np.tanh((cx-restx)*scale/24)-cx*s)
  raw=(box[3]-restbottom)*scale;limit=42 if raw<0 else 4
  dy=float(floor+limit*np.tanh(raw/limit)-box[3]*s)
  if near:dy=min(dy,floor-ball[3]*s)
  dy=max(dy,8-local_top*s)
  dx=min(max(dx,14-left*s),306-right*s)
  parts=[]
  for im in [neutral,mask]:parts.append(im.transform((320,384),Image.Transform.AFFINE,(1/s,0,-dx/s,0,1/s,-dy/s),Image.Resampling.BICUBIC).resize((160,192),Image.Resampling.LANCZOS))
  key=hashlib.sha256(parts[0].tobytes()+parts[1].tobytes()).hexdigest()
  if key not in hashes:hashes[key]=len(unique);unique.append(parts)
  frame_map.append(hashes[key]);project=lambda b:[round((b[0]*s+dx)/2,3),round((b[1]*s+dy)/2,3),round((b[2]*s+dx)/2,3),round((b[3]*s+dy)/2,3)]
  records.append({'sourceFrame':index+1,'body':project(box),'ball':project(ball) if ball else None,'nearBall':near,'scale':round(s,6),'translation':[round(dx,5),round(dy,5)]})
 rows=(len(unique)+7)//8
 for part,kind in enumerate(['neutral','mask']):
  atlas=Image.new('RGBA',(160*8,192*rows))
  for f,images in enumerate(unique):atlas.paste(images[part],(f%8*160,f//8*192))
  atlas.save(out/f'{form}-{kind}.png',optimize=True)
 manifest['forms'][form]={'sourceSprite':sid,'sourceAction':'football','sourceClip':spec['child'],'frameCount':len(frame_map),'uniqueFrames':len(unique),'rows':rows,'frameMap':frame_map,'contacts':CONTACTS[form],'poses':records}
 print(form,len(frame_map),'source frames /',len(unique),'packed frames',flush=True)
(out/'manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('*.png')},indent=2)+'\n')

# Small runtime table; full source poses remain in manifest.json for inspection.
runtime={k:v for k,v in manifest.items() if k!='forms'}
runtime['forms']={f:{**{k:v for k,v in spec.items() if k!='poses'},'nearBallFrames':[p['nearBall'] for p in spec['poses']],'reducedFrame':{'junior':141,'middle':83,'senior':56,'super':43,'water':56,'wood':56,'fire':56}[f]} for f,spec in manifest['forms'].items()}
(out/'runtime.json').write_text(json.dumps(runtime,separators=(',',':'))+'\n')

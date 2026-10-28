#!/usr/bin/env python3
"""Re-register original frames using bounded, overlapping desktop camera shots.
No character drawing, no per-frame auto-fit: each clip has at most six camera
keys. Every blend stays between two cameras that fully contain its source ink.
"""
import argparse,concurrent.futures,hashlib,json,math,subprocess
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/original/element-skills'
CELL=288;COLS=12;PER_PAGE=96

def union(boxes):
 return (min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
def camera(bounds,w,h):
 x0,y0,x1,y1=bounds;s=min(w/(x1-x0),h/(y1-y0))
 return (s,144-(x0+x1)/2*s,226-y1*s)
def fits(box,cam):
 if not box:return True
 s,x,y=cam;a,b,c,d=box
 return a*s+x>=20 and c*s+x<=268 and b*s+y>=20 and d*s+y<=264
def blend(a,b,t):
 t=t*t*(3-2*t)
 return tuple(x+(y-x)*t for x,y in zip(a,b))
def pose(keys,frame):
 for i in range(len(keys)-1):
  if frame<=keys[i+1][0]:
   a,b=keys[i],keys[i+1]
   return blend(a[1],b[1],(frame-a[0])/max(1,b[0]-a[0]))
 return keys[-1][1]

def export(meta,exporter,work):
 raw=ROOT/f"research/references/original-element-skills/raw/{meta['sourceId']}.swf"
 dest=work/meta['id'];frames=list(dest.rglob('*.png'))
 if len(frames)!=meta['frames']:
  subprocess.run([exporter,'nested',str(raw),str(dest),str(meta['actionSprite']),str(meta['rootFrame']),str(meta['frames']),'2',','.join(map(str,meta['clearedRuntimeItemSprites']))],check=True,stdout=subprocess.DEVNULL)
 frames=sorted(dest.rglob('*.png'),key=lambda p:int(p.stem))
 if len(frames)!=meta['frames']:raise ValueError('Incomplete original frames: '+meta['id'])
 boxes=[]
 for file in frames:
  with Image.open(file) as im:boxes.append(im.getbbox())
 visible=[(i,b) for i,b in enumerate(boxes) if b]
 all_bounds=union([b for _,b in visible]);first=visible[0][1]
 close=camera(first,130,150)
 if all(fits(b,close) for b in boxes):keys=[(0,close),(len(frames)-1,close)]
 else:
  centres=[round((len(frames)-1)*i/5) for i in range(6)];keys=[]
  for j,frame in enumerate(centres):
   # Each fixed shot contains BOTH neighboring intervals. Thus every source
   # point is contained by both ends of its blend, including moving projectiles.
   span=[b for b in boxes[centres[max(0,j-1)]:centres[min(5,j+1)]+1] if b]
   keys.append((frame,camera(union(span) if span else all_bounds,190,190)))
 unique=[];lookup={};frame_map=[]
 for i,file in enumerate(frames):
  cam=pose(keys,i)
  if not fits(boxes[i],cam):raise ValueError(f"Camera clips original ink: {meta['id']} frame {i+1}")
  s,x,y=cam
  with Image.open(file) as image:
   im=image.convert('RGBA').transform((CELL,CELL),Image.Transform.AFFINE,(1/s,0,-x/s,0,1/s,-y/s),resample=Image.Resampling.BICUBIC)
  digest=hashlib.sha256(im.tobytes()).hexdigest()
  if digest not in lookup:lookup[digest]=len(unique);unique.append(im)
  frame_map.append(lookup[digest])
 target=OUT/meta['id'];pages=[]
 for start in range(0,len(unique),PER_PAGE):
  group=unique[start:start+PER_PAGE];atlas=Image.new('RGBA',(COLS*CELL,math.ceil(len(group)/COLS)*CELL))
  for j,im in enumerate(group):atlas.alpha_composite(im,(j%COLS*CELL,j//COLS*CELL))
  name=f'atlas-{len(pages)}.png';atlas.save(target/name,optimize=True);pages.append(name)
 for old in target.glob('atlas-*.png'):
  if old.name not in pages:old.unlink()
 result={**meta,'frameMap':frame_map,'pages':pages,'sourceBounds':list(all_bounds),'registration':{'method':'Original source frames at zoom2; up to six fixed camera keys, smooth shot blends; no per-frame fit','sourceRasterZoom':2,'baseY':226,'centerX':144,'maxWidth':248,'maxHeight':244,'cameraKeys':[{'frame':i+1,'scale':c[0],'x':c[1],'y':c[2]} for i,c in keys]}}
 (target/'clip.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(meta['id'],len(frames),'original frames,',len(keys),'camera keys',flush=True)
 return result

if __name__=='__main__':
 args=argparse.ArgumentParser();args.add_argument('--exporter',required=True);args.add_argument('--work',default='/tmp/ramu-element-highres');args.add_argument('--workers',type=int,default=2);args=args.parse_args()
 metas=json.loads((OUT/'clips.json').read_text());work=Path(args.work);work.mkdir(parents=True,exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:results=list(pool.map(lambda m:export(m,args.exporter,work),metas.values()))
 (OUT/'clips.json').write_text(json.dumps({m['id']:m for m in results},ensure_ascii=False,indent=2)+'\n')

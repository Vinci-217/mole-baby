#!/usr/bin/env python3
"""Bake complete original-body + raster-prop compositions, not new drawings.

Three registered colour probes isolate body coverage from white eyes, books,
pots and props. Existing CSS choreography is sampled offline at 24fps; the app
then only draws the resulting frame images. Source SWFs remain separate.
"""
from pathlib import Path
import argparse,hashlib,json,math,subprocess
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
WORK=Path('/tmp/mole-v31-daily-capture')
OUT=ROOT/'public/assets/original/daily-frames'
PAGE=2048
META=json.loads((WORK/'capture.json').read_text())
FORMS=[c['form']for c in META['cells']if c['color']=='#ffffff']
VIS=json.loads((ROOT/'electron/edge-visibility.json').read_text())['forms']
OFFSETS=np.array([[255,-199,-250],[-215,-57,31]])
DELTA=np.array([[np.clip(base+offset,0,255)-base for base in [255,204,153]]for offset in OFFSETS])
MATRIX=-DELTA.transpose(0,2,1).reshape(6,3)
INVERSE=np.linalg.pinv(MATRIX)

def pack(form,action,frames,checks):
 key=form+'-'+action;dest=OUT/key;dest.mkdir(parents=True,exist_ok=True)
 unique=[];lookup={};frame_map=[];poses=[]
 for neutral,mask,dx,dy in frames:
  digest=hashlib.sha256(neutral.tobytes()+mask.tobytes()+str((neutral.size,dx,dy)).encode()).hexdigest()
  if digest not in lookup:lookup[digest]=len(unique);unique.append((neutral,mask,dx,dy))
  frame_map.append(lookup[digest])
 bins=[];rectangles=[None]*len(unique)
 for index in sorted(range(len(unique)),key=lambda i:unique[i][0].height,reverse=True):
  n,m,dx,dy=unique[index];w,h=n.size;slot=None
  for page,state in enumerate(bins):
   for shelf in state['shelves']:
    if h<=shelf['h']and shelf['x']+w+1<=PAGE:slot=(page,shelf['x'],shelf['y']);shelf['x']+=w+1;break
   if slot:break
   if state['bottom']+h+1<=PAGE:
    slot=(page,1,state['bottom']);state['shelves'].append({'x':w+2,'y':state['bottom'],'h':h});state['bottom']+=h+1;break
  if slot is None:bins.append({'shelves':[{'x':w+2,'y':1,'h':h}],'bottom':h+2});slot=(len(bins)-1,1,1)
  rectangles[index]=[*slot,w,h];poses.append(None)
 for index,(_,_,dx,dy)in enumerate(unique):poses[index]=[[index,dx,dy]]
 for suffix in ['*.png','*.webp']:
  for stale in dest.glob(suffix):stale.unlink()
 pages=[]
 for page in range(len(bins)):
  entries=[(pair,r)for pair,r in zip(unique,rectangles)if r[0]==page];width=max(r[1]+r[3]+1 for _,r in entries);height=max(r[2]+r[4]+1 for _,r in entries)
  for part,kind in enumerate(['neutral','mask']):
   atlas=Image.new('RGBA',(width,height))
   for pair,r in entries:atlas.paste(pair[part],(r[1],r[2]))
   atlas.save(dest/f'{kind}-{page}.png',optimize=True)
  pages.append({'neutral':f'neutral-{page}.webp','mask':f'mask-{page}.webp','width':width,'height':height})
 subprocess.run(['node',str(ROOT/'scripts/art/compress-uploaded-atlases.cjs'),str(dest)],check=True)
 meta={'assetRoot':'daily-frames','assetKey':key,'form':form,'id':action,'frames':len(frames),'fps':24,'durationMs':round(META['actions'][action]),'width':360,'height':440,'registration':{'scale':1,'cssPixelsPerAtlasPixel':.5,'centerX':180,'baseY':(VIS[form]['body'][3]+70)*2},'pages':pages,'frameMap':frame_map,'poses':poses,'rectangles':rectangles,'provenance':'Offline 24fps composite of existing source body atlases and existing raster props; not an official standalone full action','checks':checks}
 (dest/'clip.json').write_text(json.dumps(meta,separators=(',',':'))+'\n')
 print(key,len(frames),'time frames,',len(unique),'distinct composites',flush=True)
 return {k:v for k,v in meta.items()if k in ['assetRoot','assetKey','form','id','frames','durationMs','width','height','registration']}

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--actions');args=parser.parse_args()
 OUT.mkdir(parents=True,exist_ok=True)
 existing=json.loads((OUT/'index.json').read_text())if(OUT/'index.json').exists()else{}
 for action,duration in META['actions'].items():
  if args.actions and action not in args.actions.split(','):continue
  paths=sorted((WORK/action).glob('*.png'));expected=math.ceil(duration/1000*24)
  if len(paths)!=expected:raise ValueError(f'Incomplete capture {action}: {len(paths)}/{expected}')
  by_form={form:[]for form in FORMS};checks={form:{'maxAlphaProbeDifference':0,'tintedPixels':0,'eyeWhitePixelsPreserved':0}for form in FORMS}
  for path in paths:
   full=np.asarray(Image.open(path).convert('RGBA'))
   for column,form in enumerate(FORMS):
    probes=[full[row*440:(row+1)*440,column*360:(column+1)*360]for row in range(3)]
    neutral=Image.fromarray(probes[0]);box=neutral.getbbox()or(0,0,1,1);x,y,right,bottom=box
    n,r,b=[im[y:bottom,x:right]for im in probes];rgb=n[:,:,:3].astype(float)
    alpha_diff=max(int(np.abs(n[:,:,3].astype(int)-im[:,:,3].astype(int)).max())for im in [r,b])
    checks[form]['maxAlphaProbeDifference']=max(checks[form]['maxAlphaProbeDifference'],alpha_diff)
    difference=np.concatenate([rgb-r[:,:,:3],rgb-b[:,:,:3]],axis=2)
    weights=np.clip(difference@INVERSE.T,0,1)
    gray=rgb.max(2)-rgb.min(2)<10;responsive=np.max(np.abs(difference),2)>12
    weights[~(gray&responsive)]=0
    norm=np.maximum(1,weights.sum(2));weights/=norm[:,:,None]
    checks[form]['tintedPixels']+=int(np.sum(weights.sum(2)>.1))
    checks[form]['eyeWhitePixelsPreserved']+=int(np.sum((rgb.min(2)>245)&~responsive))
    mask=np.dstack([np.rint(weights*255).astype('uint8'),n[:,:,3]]);mask[n[:,:,3]==0]=0
    by_form[form].append((neutral.crop(box),Image.fromarray(mask),x,y))
  for form in FORMS:
   if not checks[form]['tintedPixels']or not checks[form]['eyeWhitePixelsPreserved']:raise ValueError('Unusable colour probes: '+form+' '+action)
   existing[form+'-'+action]=pack(form,action,by_form[form],checks[form])
  (OUT/'index.json').write_text(json.dumps(existing,separators=(',',':'))+'\n')
 print('PASS baked daily frame index:',len(existing),'form/action clips',flush=True)

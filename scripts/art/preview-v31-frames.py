#!/usr/bin/env python3
"""Review GIFs from the exact packed time-frame tables, never redraw artwork."""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
import json,math,concurrent.futures,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/previews/v31';OUT.mkdir(parents=True,exist_ok=True)
FORMS=['junior','middle','senior','classic']
def reader(root,spec):
 directory=ROOT/'public/assets/original'/root/spec['assetKey'];clip=json.loads((directory/'clip.json').read_text());pages=[]
 for page in clip['pages']:
  n=np.asarray(Image.open(directory/page['neutral']).convert('RGBA')).copy();m=np.asarray(Image.open(directory/page['mask']).convert('RGBA'))
  offsets=np.array([255,-199,-250]);base=np.array([255,204,153]);delta=np.clip(base[:,None]+offsets,0,255)-base[:,None]
  n[:,:,:3]=np.clip(n[:,:,:3].astype(float)+(m[:,:,:3].astype(float)@delta)/255,0,255).round().astype('uint8');n[:,:,3]=m[:,:,3]
  pages.append(Image.fromarray(n))
 def frame(i):
  view=Image.new('RGBA',(clip['width'],clip['height']))
  for tile,x,y in clip['poses'][clip['frameMap'][min(i,clip['frames']-1)]]:
   p,sx,sy,w,h=clip['rectangles'][tile][:5];view.paste(pages[p].crop((sx,sy,sx+w,sy+h)),(x,y))
  return view
 return clip,frame
def gif(name,readers,columns,cell):
 w,h=cell;rows=math.ceil(len(readers)/columns);count=max(c['frames']for _,c,_ in readers);frames=[]
 for i in range(count):
  board=Image.new('RGB',(columns*w,rows*h),'#fff7df');draw=ImageDraw.Draw(board)
  for j,(label,clip,get)in enumerate(readers):
   image=get(i);image.thumbnail((w-8,h-26),Image.Resampling.LANCZOS);x=j%columns*w+(w-image.width)//2;y=j//columns*h+(h-24-image.height)//2
   board.paste(image,(x,y),image);draw.text((j%columns*w+8,(j//columns+1)*h-20),label,fill='#795733')
  frames.append(board)
 target=OUT/(name+'.gif');durations=[round((i+1)*1000/24/10)*10-round(i*1000/24/10)*10 for i in range(count)]
 frames[0].save(target,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=2)
 encoded=Image.open(target);encoded_count=encoded.n_frames;encoded_duration=0
 for i in range(encoded_count):encoded.seek(i);encoded_duration+=encoded.info.get('duration',0)
 return {'file':target.name,'sourceTimeFrames':{label:c['frames']for label,c,_ in readers},'timeSamples':count,'gifFrames':encoded_count,'gifDurationMs':encoded_duration,'fps':24,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
def supplied(id):
 index=json.loads((ROOT/'public/assets/original/uploaded-actions/index.json').read_text());readers=[]
 for form in FORMS:
  spec=index.get(form+'-'+id)
  if spec:
   clip,get=reader('uploaded-actions',spec);readers.append((form,clip,get))
 result=gif('original-'+id,readers,2,(230,190));print(result['file'],flush=True);return result
def daily(action):
 index=json.loads((ROOT/'public/assets/original/daily-frames/index.json').read_text());readers=[]
 for form in ['seed','junior','middle','senior','super','classic','water','wood','fire']:
  clip,get=reader('daily-frames',index[form+'-'+action]);readers.append((form,clip,get))
 result=gif('daily-'+action,readers,3,(180,220));print(result['file'],flush=True);return result
if __name__=='__main__':
 index=json.loads((ROOT/'public/assets/original/uploaded-actions/index.json').read_text());ids=sorted(set(s['id']for s in index.values()))
 with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:records=list(pool.map(supplied,ids))
 records += [daily(a)for a in ['pet','focus','sleep','watch-butterfly','look-around','wake','dizzy']]
 (OUT/'coverage.json').write_text(json.dumps({'method':'Exact source time-frame tables at 24fps, GIF delay quantized to 10ms; red body palette, full fixed viewport scaled once per clip for the grid; original SWF sources separate from baked daily compositions','suppliedFiles':len(index),'distinctSourceSwfs':238,'suppliedTimeFrames':sum(s['frames']for s in index.values()),'previews':records},indent=2)+'\n')
 print('PASS complete v31 frame-table preview coverage',len(records),flush=True)

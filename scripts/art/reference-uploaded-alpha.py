#!/usr/bin/env python3
"""Reference hashes sampled from the source PNGs, not from packed atlases."""
from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
out=ROOT/'research/references/uploaded-lamu-actions/render-proofs.json'
library=ROOT/'public/assets/original/uploaded-actions'
index=json.loads((library/'index.json').read_text());records={}
for spec in index.values():
 key=spec['assetKey']
 if key in records:continue
 clip=json.loads((library/key/'clip.json').read_text());work=Path('/tmp/mole-v31-upload-export')/key/'frames';raw=json.loads((work/'frames.json').read_text());boxes=raw['frames'];scale=clip['registration']['scale'];x0=min(b[0]for b in boxes);y0=min(b[1]for b in boxes);proofs={}
 for frame in sorted(set([0,clip['frames']//3,clip['frames']*2//3,clip['frames']-1])):
  dx,dy,w,h=boxes[frame];left=round((dx-x0)*scale)+2;top=round((dy-y0)*scale)+2;right=round((dx+w-x0)*scale)+2;bottom=round((dy+h-y0)*scale)+2
  with Image.open(work/f'{frame}-n.png')as image:alpha=image.convert('RGBA').resize((max(1,right-left),max(1,bottom-top)),Image.Resampling.LANCZOS).getchannel('A')
  expected=Image.new('L',(clip['width'],clip['height']));expected.paste(alpha,(left,top));proofs[str(frame)]=hashlib.sha256(expected.tobytes()).hexdigest()
 records[key]={'sourceSha256':clip['sourceSha256'],'frames':clip['frames'],'sourceAlphaSha256':proofs}
out.write_text(json.dumps({'method':'Source PNGs resized with the fixed registration before packing/compression; four full-frame alpha samples per distinct SWF','clips':records},indent=2)+'\n')
print('Reference alpha proofs for',len(records),'distinct supplied SWFs',flush=True)

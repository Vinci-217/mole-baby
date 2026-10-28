#!/usr/bin/env python3
"""Offline samples of the original eight-blade crown's existing projection.
These are composited source-layer poses, not newly drawn official keyframes.
"""
from pathlib import Path
from PIL import Image
import json,math,hashlib
ROOT=Path(__file__).resolve().parents[2];directory=ROOT/'public/assets/original/flight';runtime=json.loads((directory/'runtime.json').read_text());spec=runtime['forms']['senior'];count=40
first=spec['rotor'].get('bakedIndices',[spec['rows']*8])[0];rows=math.ceil((first+count)/8);px,py=spec['rotor']['pivot'];projection=spec['rotor']['projectionY'];index=spec['crownIndex']
for kind in ['neutral','mask']:
 path=directory/f'senior-{kind}.png';original=Image.open(path).convert('RGBA');crown=original.crop((index%8*192,index//8*208,index%8*192+192,index//8*208+208));atlas=Image.new('RGBA',(192*8,208*rows));atlas.paste(original.crop((0,0,192*8,208*math.ceil(first/8))),(0,0))
 for i in range(count):
  angle=i*math.tau/count;c=math.cos(angle);s=math.sin(angle);matrix=(c,s/projection,px-c*px-s/projection*py,-projection*s,c,py+projection*s*px-c*py)
  frame=crown.transform((192,208),Image.Transform.AFFINE,matrix,Image.Resampling.BICUBIC);tile=first+i;atlas.paste(frame,(tile%8*192,tile//8*208))
 atlas.save(path,optimize=True)
spec['rows']=rows;spec['rotor']['bakedIndices']=list(range(first,first+count));spec['rotor']['bakedSource']='40 offline affine samples of the original eight-blade layer, with the existing 0.42 projection; no runtime crown drawing'
(directory/'runtime.json').write_text(json.dumps(runtime,separators=(',',':'))+'\n')
(directory/'rotor-source.json').write_text(json.dumps({'sourceSprite':spec['sourceSprite'],'sourceSwfSha256':spec['sourceSwfSha256'],'originalCrownIndex':index,'blades':8,'compositedPoses':count,'officialNewDrawings':0,'pngSha256':{kind:hashlib.sha256((directory/f'senior-{kind}.png').read_bytes()).hexdigest()for kind in ['neutral','mask']}},indent=2)+'\n')
print('Baked 40 original-crown poses, preserved all prior source indices')

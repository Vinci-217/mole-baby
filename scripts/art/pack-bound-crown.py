"""Bake the reviewed bound-crown frames into the existing drag renderer format."""
import argparse,json,copy,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--authored',type=Path,required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args();out=a.repo/'public/assets/original/drag';data=json.loads((out/'runtime.json').read_text());junior=data['forms']['junior'];source=json.loads((a.authored/'source.json').read_text());w,h=source['cell'];columns=8;count=junior['frameCount'];rows=(count+7)//8
junior.update(cell=[192,208],origin=[0,0],sampling='phase');poses=[];classic=np.array(Image.open(a.repo/'public/assets/classic/middle-mask.png').convert('RGBA'))
def box(m):
 y,x=np.where((m[:,:,:3].sum(2)>90)&(m[:,:,3]>100));return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)] if len(x) else None
for kind in ['neutral','mask']:
 image=Image.new('RGBA',(w*columns,h*rows));index=0
 for view,clip in junior['clips'].items():
  for phase in range(clip['frameCount']):
   frame=Image.open(a.authored/f'{view}-{phase:02d}-{kind}.png').convert('RGBA');assert frame.size==(w,h);image.paste(frame,(index%columns*w,index//columns*h));index+=1
 image.save(out/f'middle-{kind}.png',optimize=True)
for view,clip in junior['clips'].items():
 for phase,index in enumerate(clip['frameMap']):
  pose=copy.deepcopy(junior['poses'][index]);row=pose['wearRow'];frame=pose['wearFrame'];old=box(classic[row*208:(row+1)*208,frame*192:(frame+1)*192])
  if old is None:frame=0;old=box(classic[row*208:(row+1)*208,:192])
  binding=source['forms'][view][phase];pose.update(wearBody=old,wearFrame=frame,crownRoot=binding['targetRoot'],crownAngle=binding['angle'],crownPhase=binding['leafPhase']);poses.append(pose)
data['forms']['middle']={'rows':rows,'frameCount':count,'bodyFrom':'junior','sampling':'phase','cell':[w,h],'origin':source['origin'],'clips':copy.deepcopy(junior['clips']),'poses':poses}
data['adaptation']='Original junior viscous body frames reused unchanged; original middle leaf texture animated with a root-pinned bend sequence and bound per-frame to the junior head. Expanded source cells preserve full foliage size. Desktop adaptation.'
(out/'runtime.json').write_text(json.dumps(data,separators=(',',':'))+'\n');(out/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n');(out/'checksums.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in out.glob('*.png')},indent=2)+'\n');print('Packed 75 bound-crown frames, unchanged junior source; cell',w,h,'origin',source['origin'])

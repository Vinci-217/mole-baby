"""Extract complete original accessory sprites, not clipped stage thumbnails."""
from pathlib import Path
import argparse,subprocess,json,hashlib
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--sources',type=Path,required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[2]);a=p.parse_args()
out=a.repo/'public/assets/original/wardrobe';out.mkdir(parents=True,exist_ok=True);sources=[]
for sid,name in [('1200008','party-cap'),('1200018','gold-feather'),('1200020','wizard-cap')]:
 source=a.sources/(sid+'.swf');dest=a.work/sid
 subprocess.run(['java','-Djava.awt.headless=true','-jar',a.ffdec,'-selectid','2','-zoom','8','-ignorebackground','-export','sprite',str(dest),str(source)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 image=Image.open(next(dest.rglob('1.png'))).convert('RGBA');image=image.crop(image.getbbox());image.thumbnail((192,192),Image.Resampling.LANCZOS);image.save(out/(name+'.png'))
 sources.append({'id':name,'sourceId':sid,'url':'https://raw.githubusercontent.com/Miigon/RecMoleRes/master/root/resource/petcloth/swf/cloth/'+sid+'.swf','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'extraction':'Complete original sprite 2, zoom 8, transparent PNG, trimmed to sprite bounds; no stage cropping.'})
(out/'source.json').write_text(json.dumps({'retrieved':'2026-10-24','adaptation':'Names and prices are local choices, not verified official item names or server prices. Source accessories retain their original colours.','items':sources},indent=2)+'\n')
(out/'checksums.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('*.png')},indent=2)+'\n')

#!/usr/bin/env python3
from pathlib import Path
import xml.etree.ElementTree as E,json,urllib.request,hashlib,subprocess,concurrent.futures
from PIL import Image
root=Path(__file__).resolve().parents[2];items=root/'public/assets/original/items';source=root/'research/references/uploaded-lamu-actions/icons';source.mkdir(parents=True,exist_ok=True)
ids={p.stem for p in(root/'research/references/uploaded-lamu-actions/raw').rglob('*.swf')};records=[n for n in E.parse(items/'petfood.xml').getroot()if n.get('ID')in ids and not(items/(n.get('ID')+'.png')).exists()]
cp='/tmp/mole-v31-tools:/workspace/.ramu-assets/tools/ffdec/lib/*'
def get(n):
 ident=n.get('ID');u=f'https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/pet/icon/{ident}.swf'
 try:
  with urllib.request.urlopen(u,timeout=25)as r:b=r.read(1024*1024)
  assert b[:3]in[b'CWS',b'FWS'];f=source/(ident+'.swf');f.write_bytes(b);dest=Path('/tmp/mole-v31-icons')/ident
  subprocess.run(['java','-Djava.awt.headless=true','-Xmx500m','-cp',cp,'SourceExporter','sprite',str(f),str(dest),'0','0','3'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  p=next(dest.rglob('*.png'));im=Image.open(p).convert('RGBA');im=im.crop(im.getbbox());im.thumbnail((128,128),Image.Resampling.LANCZOS);im.save(items/(ident+'.png'),optimize=True)
  print('icon',ident,n.get('Name'),flush=True);return {'id':ident,'name':n.get('Name'),'url':u,'sha256':hashlib.sha256(b).hexdigest(),'pngSha256':hashlib.sha256((items/(ident+'.png')).read_bytes()).hexdigest()}
 except Exception as e:print('FAILED',ident,str(e),flush=True);return {'id':ident,'name':n.get('Name'),'url':u,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as ex:result=list(ex.map(get,records))
receipt=source/'sources.json'
existing=json.loads(receipt.read_text())if receipt.exists()else[]
merged={r['id']:r for r in existing}
for r in result:merged[r['id']]=r
receipt.write_text(json.dumps(list(merged.values()),ensure_ascii=False,indent=2)+'\n')

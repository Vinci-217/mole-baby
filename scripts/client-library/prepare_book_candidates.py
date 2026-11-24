#!/usr/bin/env python3
"""Inspect existing book-like SWFs, retaining original sample pixels and provenance."""
import hashlib
import json
import re
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
VAULT=ROOT/'local-assets'
OUT=VAULT/'book-candidates'
EVIDENCE=ROOT/'artifacts/book-candidates-20261117'
EXISTING={item['source']for item in json.loads((ROOT/'public/assets/original/reading-books/catalog.json').read_text())}
RECOMMENDED={
 'resource/besmearBook/other/'+str(number)+'.swf'for number in [2,8,31,107,224]
}|{'resource/besmearBook/naturalnessBook.swf','module/external/BooksUI/guideBook.swf',
 'module/external/BooksUI/playerBook.swf','module/external/BooksUI/angelGuideBook.swf',
 'resource/pressman/pressmanBook.swf'}
FORCED={
 'module/external/ClothBookShopPanel.swf':394,
 'module/external/HomeBookShopPanel.swf':367,
 'module/external/HousePastureShopBookPanel.swf':235,
 'module/external/NewAngelHandbookPanel.swf':133,
 'module/external/XihaBook.swf':489,
 'module/external/ZhuangYuanGoodPlayBookPanel.swf':289,
 'resource/siren/compoment/handBook.swf':28,
}
OUT.mkdir(exist_ok=True,parents=True);EVIDENCE.mkdir(exist_ok=True,parents=True)
work=EVIDENCE/'render-work';work.mkdir(exist_ok=True)
rows=[];requests=[]
cached={r['path']:r for r in json.loads((OUT/'catalog.json').read_text()).get('items',[])}if(OUT/'catalog.json').exists()else{}
with sqlite3.connect(f'file:{VAULT}/catalog.sqlite?mode=ro',uri=True)as db:
 for path,size,blob in db.execute("SELECT path,bytes,sha FROM assets WHERE lower(path) LIKE '%book%' OR path='root/module/external/tenYearsAgo.swf' ORDER BY path"):
  relative=path.removeprefix('root/')
  if relative in EXISTING:continue
  timeline=json.loads((VAULT/'timelines'/(path+'.json')).read_text());byid={t['sprite']:t for t in timeline['timelines']};main=byid[0]
  sprite=FORCED.get(relative,0)
  if not sprite and main['frames']==1:
   placed=[byid[p['character']]for p in main['placements']if p['frame']==0 and p['character']in byid]
   if len(placed)==1:sprite=placed[0]['sprite']
  track=byid[sprite];count=track['frames'];selected=sorted({0,min(1,count-1),count//2,count-1})
  if '--full-recommended'in sys.argv and relative in RECOMMENDED:selected=list(range(count))
  ident=hashlib.sha256(path.encode()).hexdigest()[:12];source=VAULT/'raw'/path
  row=dict(id=ident,path=relative,bytes=size,gitBlob=blob,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),sprite=sprite,frames=count,sampleFrames=selected,symbol=track.get('symbol',''),samples=[])
  previous=cached.get(relative,{})
  if previous.get('sha256')==row['sha256']:
   for key in ['texts','renderNote','renderError']:
    if key in previous:row[key]=previous[key]
  rows.append(row)
  request=(work/ident)
  if all((OUT/'samples'/ident/f'{index+1}.png').exists()for index in selected):
   row['samples']=[f'samples/{ident}/{index+1}.png'for index in selected];continue
  requests.append('\t'.join([str(source),str(sprite),str(request),','.join(map(str,selected))]))
(OUT/'catalog.json').write_text(json.dumps(dict(scope='Existing local archive paths containing book; plus the old-client monthly bookshelf tenYearsAgo reference. Samples only, no ActionScript execution.',items=rows),ensure_ascii=False,indent=2)+'\n')
(EVIDENCE/'requests.tsv').write_text('\n'.join(requests)+'\n')
if requests:
 subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-cp','/opt/jpexs/26.4.0/lib/ffdec_lib.jar','-d',str(VAULT/'tools'),str(ROOT/'scripts/client-library/BookCandidateExporter.java')],check=True)
 with (EVIDENCE/'export.jsonl').open('w')as log:
  subprocess.run(['java','-Xmx350m','-Djava.awt.headless=true','-cp',str(VAULT/'tools')+':/opt/jpexs/26.4.0/lib/*','BookCandidateExporter',str(EVIDENCE/'requests.tsv')],check=True,stdout=log,timeout=600)
 for row in rows:
  folder=work/row['id'];images=sorted(folder.rglob('*.png'),key=lambda p:int(p.stem))
  if not images:continue
  jobs=[dict(source=str(image),destination=str(OUT/'samples'/row['id']/image.name))for image in images]
  # A blank script-created UI is recorded as such rather than called a book.
  result=subprocess.run(['node',str(ROOT/'scripts/client-library/trim_ram_pages.cjs')],input=json.dumps(dict(files=jobs)),text=True,capture_output=True)
  if result.returncode:
   row['renderNote']=result.stderr.strip()[:400]
  row['samples']=[f'samples/{row["id"]}/{image.name}'for image in images if(OUT/'samples'/row['id']/image.name).exists()]
  shutil.rmtree(folder)
 for line in (EVIDENCE/'export.jsonl').read_text().splitlines():
  record=json.loads(line);relative=str(Path(record['source']).relative_to(VAULT/'raw')).removeprefix('root/')
  row=next(r for r in rows if r['path']==relative);row['texts']=record.get('texts',[])
  if 'error'in record:row['renderError']=record['error']
(OUT/'catalog.json').write_text(json.dumps(dict(scope='Existing local archive paths containing book; plus the old-client monthly bookshelf tenYearsAgo reference. Samples only, no ActionScript execution.',items=rows),ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(candidates=len(rows),samples=sum(len(row['samples'])for row in rows),bytes=sum(p.stat().st_size for p in OUT.rglob('*.png')))))

#!/usr/bin/env python3
"""Add verified, distinct readable books; originals remain untouched."""
import hashlib,json,os,re,shutil,subprocess,sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
VAULT=ROOT/'local-assets';OUT=ROOT/'public/assets/original/reading-books'
EVIDENCE=ROOT/'artifacts/bookshelf-pagination-20261117';CACHE=VAULT/'reading-library'
EVIDENCE.mkdir(exist_ok=True,parents=True);CACHE.mkdir(exist_ok=True)
CP=str(VAULT/'tools')+':/opt/jpexs/26.4.0/lib/*'
BASE=['supplies','life','study','food','classroom','secret']
selections=json.loads((ROOT/'scripts/client-library/reading-book-selections.json').read_text())
subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-cp',str(VAULT/'tools')+':/opt/jpexs/26.4.0/lib/ffdec_lib.jar','-d',str(VAULT/'tools'),str(ROOT/'scripts/client-library/BookLayoutProbe.java'),str(ROOT/'scripts/client-library/ReadingBookExporter.java')],check=True)
def adaptation(key):
 text='In-memory Flash HTML soft breaks and word wrapping restored for body text; no SWF writes. Only detached marks outside paper are excluded from the view. Original illustrations are preserved.'
 if key=='ram-world':
  text+=' Body text font size is fitted to 86% (minimum 11 px), with its paragraph width set to 85%, so the original text stays inside the paper.'
 return text
def stops(row):
 count=row['sourceFrames']
 if count<=40:return list(range(count))
 directory=VAULT/'extracted/root'/row['source']/'scripts'
 symbol=json.loads((VAULT/'timelines/root'/(row['source']+'.json')).read_text())['symbols'].get(str(row['sprite']),'')
 name=symbol.rsplit('.',1)[-1]if symbol else 'MainTimeline'
 for file in directory.rglob(name+'.as'):
  text=file.read_text();match=re.search(r'addFrameScript\((.*?)\)',text,re.S)
  if not match:continue
  found=[]
  for number,method in re.findall(r'(\d+)\s*,\s*(\w+)',match[1]):
   function=re.search(r'function\s+'+re.escape(method)+r'\([^)]*\)[^{]*\{(.*?)(?=\n\s*(?:internal|public|private|protected)\s+function|\Z)',text,re.S)
   if function and re.search(r'\bstop\s*\(',function[1]):found.append(int(number))
  if len(found)>2:return sorted(set([0]+found))
 raise ValueError('Long timeline needs a verified reading sequence: '+row['source'])
def prepare_book(row):
 key=row['id'];source=VAULT/'raw/root'/row['source'];digest=hashlib.sha256(source.read_bytes()).hexdigest();folder=CACHE/key;folder.mkdir(exist_ok=True)
 page_format=row.get('pageFormat','png')
 selected=stops(row);receipt=folder/'source.json';profile='original-soft-breaks-fit-v3'if key=='ram-world'else'original-soft-breaks-v1'
 if page_format=='webp':profile+='-webp-94'
 prior=json.loads(receipt.read_text())if receipt.exists()else{}
 if prior.get('sourceSha256')==digest and prior.get('selectedFrames')==selected and prior.get('profile')==profile:
  if all((folder/f'{i+1}.{page_format}').exists()for i in range(len(selected))):
   if prior.get('adaptation')!=adaptation(key):
    prior['adaptation']=adaptation(key);receipt.write_text(json.dumps(prior,ensure_ascii=False,indent=2)+'\n')
   print(json.dumps(dict(id=key,cached=True,pages=len(selected))),flush=True);return
 work=EVIDENCE/'render-work'/key;work.mkdir(exist_ok=True,parents=True)
 command=['java','-Xmx300m','-Djava.awt.headless=true','-cp',CP,'ReadingBookExporter',str(source),str(row['sprite']),'fit'if key=='ram-world'else'wrap',','.join(map(str,selected)),str(work)]
 probe=json.loads(subprocess.check_output(command,text=True,timeout=180))
 (folder/'probe.json').write_text(json.dumps(probe,ensure_ascii=False,indent=2)+'\n')
 files=sorted(work.rglob('*.png'),key=lambda p:int(p.stem))
 request=dict(files=[str(p)for p in files],selected=selected,probe=probe,output=str(folder),layout=str(folder/'layout.json'),pageFormat=page_format)
 subprocess.run(['node',str(ROOT/'scripts/client-library/measure_library_pages.cjs')],input=json.dumps(request),text=True,check=True,timeout=150,stdout=subprocess.DEVNULL)
 receipt.write_text(json.dumps(dict(source=row['source'],sourceSha256=digest,sprite=row['sprite'],sourceFrames=row['sourceFrames'],selectedFrames=selected,wrappedTextIds=probe['wrappedTextIds'],profile=profile,adaptation=adaptation(key)),ensure_ascii=False,indent=2)+'\n')
 shutil.rmtree(work)
 print(json.dumps(dict(id=key,pages=len(selected),wrappedTextFields=len(probe['wrappedTextIds']))),flush=True)

with ThreadPoolExecutor(max_workers=2) as workers:
 for _ in workers.map(prepare_book,selections):
  pass

# Assemble atomically after every required source has been prepared.
current=json.loads((OUT/'catalog.json').read_text());catalog=[next(b for b in current if b['id']==key)for key in BASE]
source_doc=json.loads((OUT/'source.json').read_text());sources=[s for s in source_doc['sources']if s['id']in BASE]
layouts={key:value for key,value in json.loads((OUT/'layout.json').read_text()).items()if key in BASE}
latest=json.loads((ROOT/'scripts/client-library/reading-book-selections.json').read_text())
cover_jobs=[]
for row in latest:
 if row.get('pageFormat')=='webp':continue
 folder=CACHE/row['id'];frame=json.loads((folder/'layout.json').read_text())['frames'][0];rect=frame['rect'];view=frame.get('viewRect',rect)
 cover_jobs.append(dict(source=str(folder/'1.png'),destination=str(folder/'cover.png'),rect=dict(left=round(view[0]-rect[0]),top=round(view[1]-rect[1]),width=round(view[2]),height=round(view[3]))))
subprocess.run(['node',str(ROOT/'scripts/client-library/crop_reading_covers.cjs')],input=json.dumps(cover_jobs),text=True,check=True)
for row in latest:
 key=row['id'];folder=CACHE/key;receipt=json.loads((folder/'source.json').read_text());pages=[];checksums=[];target=OUT/key;target.mkdir(exist_ok=True)
 page_format=row.get('pageFormat','png')
 for index,original in enumerate(receipt['selectedFrames'],1):
  saved=folder/f'{index}.{page_format}';destination=target/saved.name
  if destination.exists()and destination.stat().st_ino!=saved.stat().st_ino:destination.unlink()
  if not destination.exists():os.link(saved,destination)
  pages.append(f'./assets/original/reading-books/{key}/{destination.name}');checksums.append(dict(file=f'{key}/{destination.name}',sourceFrame=original+1,sha256=hashlib.sha256(saved.read_bytes()).hexdigest()))
 cover_url=pages[0]
 if page_format=='png':
  cover=target/'cover.png'
  if cover.exists()and cover.stat().st_ino!=(folder/'cover.png').stat().st_ino:cover.unlink()
  if not cover.exists():os.link(folder/'cover.png',cover)
  cover_url=f'./assets/original/reading-books/{key}/cover.png'
 catalog.append(dict(id=key,title=row['title'],description=row['description'],source=row['source'],pages=pages,cover=cover_url))
 sources.append(dict(id=key,path=row['source'],**{k:v for k,v in receipt.items()if k not in ['source']},frames=len(pages),pages=checksums))
 layouts[key]=json.loads((folder/'layout.json').read_text())
source_doc.update(sources=sources,artwork='原客户端 SWF 的派生静态书页与原插图；原 SWF 不改写，新增书页的文字排版适配见各来源回执。',adaptation='家具书脊、书架分页、书页角点击区与进度为本地适配；书页在内存中恢复原 Flash 正文软换行及自动换行，征文集另适配正文字号和段落宽度。原购买与账号按钮仅为历史画面。')
for filename,value in [('catalog.json',catalog),('source.json',source_doc),('layout.json',layouts)]:
 temporary=OUT/(filename+'.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temporary.replace(OUT/filename)
(ROOT/'src/reading-book-page-counts.json').write_text(json.dumps({book['id']:len(book['pages']) for book in catalog},indent=2)+'\n')
subprocess.run([sys.executable,str(Path(__file__).with_name('restore_reading_dialogs.py'))],check=True)
print(json.dumps(dict(books=len(catalog),pages=sum(len(b['pages'])for b in catalog))),flush=True)

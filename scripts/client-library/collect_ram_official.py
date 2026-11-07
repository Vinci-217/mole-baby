#!/usr/bin/env python3
"""Collect data-only, publicly addressed Ram SWFs with per-path provenance.
Never executes ActionScript or changes the pinned original archive.
"""
import xml.etree.ElementTree as ET
import argparse,collections,concurrent.futures,csv,hashlib,json,re,shutil,sqlite3,struct,sys,time,urllib.request,urllib.error,urllib.parse,zlib
from pathlib import Path
from library import decode_swf,swf_body,save_json
from amf3 import AMF3Reader
ROOT=Path(__file__).resolve().parents[2];VAULT=ROOT/'local-assets';OUT=VAULT/'ram-official-sweep/2026-11-06';BASE='https://mole.61.com/'
RAM=re.compile(r'lamu|lahm|lamoon|ramu|拉姆',re.I)
DIRECT=re.compile(r'(?:^|/)(?:pet(?:cloth|ui|book|honor|skill)?|lamu[^/]*|lahm[^/]*)(?:/|[._])|/crazyLamu/',re.I)
PATH=re.compile(r'(?:resource|module|dll)/[\w./-]+\.swf',re.I)
STAMP=lambda:time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())

def version_hash(path):
 # TaomeeVersionManager.hashFileName: uint32 SDBM, then positive 31 bits.
 value=0
 for char in path.replace('\\','/'):
  value=(ord(char)+(value<<6)+(value<<16)-value)&0xffffffff
 return value&0x7fffffff

def version_index():
 source=OUT/'bootstrap/version/version1452075536.swf'
 if not source.exists():return {},None
 data=source.read_bytes()
 if len(data)<8 or struct.unpack_from('>I',data)[0]!=20140805:
  raise ValueError('Unknown official version index format')
 body=zlib.decompress(data[8:]);count=struct.unpack_from('>I',body)[0]
 if len(body)!=4+count*8:raise ValueError('Truncated official version index')
 return dict(struct.iter_unpack('>II',body[4:])),source

def base36(value):
 result=''
 while value:
  value,digit=divmod(value,36);result='0123456789abcdefghijklmnopqrstuvwxyz'[digit]+result
 return result or '0'

def expand_indexed_families(add,existing):
 versions,source=version_index()
 if not source:return
 # Probe the local index only; never send requests for unindexed guesses.
 # A hash hit is merely a candidate because collisions are possible.
 families=[(folder,1200000,1210000) for folder in [
  'resource/petcloth/swf2/','resource/petcloth/swf/cloth/','resource/petcloth/icon/']]
 families.extend((f'resource/pet/swf/pet{level}/',180000,190000) for level in [1,2,3,4,5,101,102])
 families.append(('resource/pet/icon/',180000,190000))
 families.extend((f'resource/lahmClassRoom/lahmMovie/pet{level}Movie/',0,100) for level in [1,2,3,4,5,101,102])
 families.extend((f'resource/lahmClassRoom/{group}/',0,100) for group in ['classMovie','happyMovie','honerMovie'])
 families.extend((f'resource/petcloth/swf2/pet{level}/skill_',0,32) for level in [1,2,3,4,5,101,102])
 audit=[]
 for prefix,start,stop in families:
  hits=[];new=[]
  for ident in range(start,stop):
   path=f'{prefix}{ident}.swf';key=version_hash(path)
   if key not in versions:continue
   hits.append(path)
   if path not in existing:new.append(path)
   add(path,{'type':'official-version-index-hash','source':str(source.relative_to(ROOT)),
    'pathHash':key,'modifiedUnix':versions[key],'family':prefix,'range':[start,stop-1]})
  audit.append(dict(prefix=prefix,range=[start,stop-1],indexMatches=len(hits),newCandidates=new))
 save_json(OUT/'version-index-audit.json',dict(source=str(source.relative_to(ROOT)),
  sha256=hashlib.sha256(source.read_bytes()).hexdigest(),indexedHashes=len(versions),
  note='Hash matches are discovery candidates, not proof of an existing SWF. Every candidate requires an official HTTP request and SWF validation.',families=audit))

def tags(data):
 body,start,_,_=swf_body(data);pos=start
 while pos+2<=len(body):
  head=struct.unpack_from('<H',body,pos)[0];pos+=2;code,size=head>>6,head&63
  if size==63:size=struct.unpack_from('<I',body,pos)[0];pos+=4
  if pos+size>len(body):raise ValueError('Truncated SWF tag')
  yield code,body[pos:pos+size];pos+=size
  if code==0:break

def abc_strings(data):
 result=[]
 for code,payload in tags(data):
  if code not in (72,82):continue
  abc=payload[payload.index(b'\0',4)+1:] if code==82 else payload;pos=4
  def u30():
   nonlocal pos
   n=0
   for shift in range(0,35,7):
    b=abc[pos];pos+=1;n|=(b&127)<<shift
    if not b&128:return n
   return n
  for _ in range(2):
   count=u30()
   for j in range(1,count):u30()
  count=u30();pos+=max(0,count-1)*8
  count=u30()
  for j in range(1,count):
   size=u30();s=abc[pos:pos+size].decode('utf-8','replace');pos+=size;result.append(s)
 return result

def item_config(data):
 info=decode_swf(data);symbols=info['symbols']
 for code,payload in tags(data):
  if code!=87:continue
  cid=struct.unpack_from('<H',payload)[0]
  if 'itemXmlData' not in symbols.get(str(cid),''):continue
  return AMF3Reader(zlib.decompress(payload[6:])).read()
 raise ValueError('No itemXmlData in ClientConfigDLL')

def category(path):
 p=path.lower()
 if '/petcloth/swf2/'in p:return '装扮／变身动作'
 if '/petcloth/swf/cloth/'in p:return '旧版装扮图层'
 if '/petcloth/body/'in p:return '技能身体／变身'
 if '/pet/swf/'in p:return '道具互动动作'
 if '/icon/'in p:return '图标（不等同角色动作）'
 if '/lahmclassroom/'in p:return '课堂／学习动作'
 if '/lamuworldconvert/'in p:return '拉姆世界变身'
 if 'lamubone' in p or '/npc/'in p and RAM.search(p):return '角色骨骼／基础动作'
 if '/lamupksys/'in p:return '拉姆战斗／技能素材'
 if p.startswith('module/') or '/module/'in p:return '界面／小游戏模块'
 if '/map/'in p or '/movie/'in p:return '场景／剧情（需定位拉姆片段）'
 if p.startswith('dll/'):return '客户端配置／调用代码'
 return '拉姆相关资源'

def discover():
 candidates={}
 def add(path,reason,name=None):
  path=path.removeprefix('root/').split('?',1)[0].strip()
  if not re.fullmatch(r'[\w./-]+\.swf',path) or '..'in path.split('/') or path.startswith('/'):return
  e=candidates.setdefault(path,dict(path=path,category=category(path),evidence=[],names=[]))
  if reason not in e['evidence']:e['evidence'].append(reason)
  if name and name not in e['names']:e['names'].append(name)
 c=sqlite3.connect(VAULT/'catalog.sqlite');c.row_factory=sqlite3.Row
 for row in c.execute("select * from assets where kind='swf'"):
  p=row['path'];search=row['search'] or ''
  if DIRECT.search(p) or RAM.search(Path(p).name) or RAM.search(search):
   add(p,{'type':'pinned-archive-path' if DIRECT.search(p) or RAM.search(Path(p).name) else 'pinned-archive-symbol','source':p})
 c.close()
 # Both old and current item tables preserve names, ids and client path families.
 tables=[('current-config',item_config((OUT/'bootstrap/dll/ClientConfigDLL.swf').read_bytes())),('archive-config',item_config((VAULT/'raw/root/dll/ClientConfigDLL.swf').read_bytes()))]
 relevant_items={}
 for version,table in tables:
  for key,row in table.items():
   typ=row.get('typeObject',{});ident=str(row.get('ItemID',row.get('id',key)));name=row.get('name',row.get('Name',''))
   prefix=typ.get('resourePath','');icon=typ.get('path','');reason={'type':version,'source':'dll/ClientConfigDLL.swf#itemXmlData','itemId':ident}
   if 'petcloth' in prefix or 'petcloth' in icon:
    relevant_items[ident]=row
    for folder in ['resource/petcloth/swf2/','resource/petcloth/swf/cloth/',icon]:add(folder+ident+'.swf',reason,name)
   elif '/pet/' in prefix or '/pet/' in icon:
    relevant_items[ident]=row
    add(icon+ident+'.swf',reason,name)
    # Actual usage is resource/pet/swf/pet{level}/{id}.swf (petView).
    for level in [1,2,3,4,5,101]:add(f'resource/pet/swf/pet{level}/{ident}.swf',reason,name)
   # Restore other real Ram-specific resource roots from configuration.
   elif RAM.search(name) and prefix:
    for folder in [icon]:
     if folder:add(folder+ident+'.swf',reason,name)
 save_json(OUT/'items.json',relevant_items)
 source_files=[]
 # Referenced AS files carry literal paths and nearby bounds used later for
 # expanding parameterized paths; only source bodies, not file names, are read.
 ref=OUT/'client-refs.txt'
 if ref.exists():
  for line in ref.read_text().splitlines():
   parts=line.split(':',2)
   if len(parts)==3:source_files.append(ROOT/parts[0])
 for folder in [OUT/'current-app-scripts',OUT/'current-config-scripts',VAULT/'extracted/root/dll/ClientConfigDLL.swf/scripts']:
  if folder.exists():source_files.extend(folder.rglob('*.as'))
 unique_files=sorted(set(source_files));literal_strings={}
 for file in unique_files:
  if not file.is_file():continue
  text=file.read_text(errors='replace');where=str(file.relative_to(ROOT))
  for line_no,line in enumerate(text.splitlines(),1):
   if not any(w in line for w in ['.swf','resource/','module/']):continue
   for token in re.findall(r'"([^"\r\n]*)"',line):
    if token.endswith('.swf') and PATH.fullmatch(token) and (DIRECT.search(token) or RAM.search(token) or re.search(r'/(?:pet|lahmClassRoom|lamuSkill|superPetModule)/',where,re.I)):add(token,{'type':'client-literal','source':where,'line':line_no})
   if any(w in line.lower() for w in ['resource/pet','resource/lam','resource/lahm']):literal_strings.setdefault(line.strip(),[]).append({'source':where,'line':line_no})
 # Direct paths from ABC pools/config XML: avoids executing any client code.
 for source in [OUT/'bootstrap/dll/ClientConfigDLL.swf',OUT/'bootstrap/dll/ClientAppDLL.swf',OUT/'bootstrap/dll/ClientCommonDLL.swf',VAULT/'raw/root/dll/ClientConfigDLL.swf']:
  for string in abc_strings(source.read_bytes()):
   for path in PATH.findall(string):
    if DIRECT.search(path) or RAM.search(path):add(path,{'type':'client-abc-string','source':str(source.relative_to(ROOT))})
 # All already-downloaded supplementary original action packs remain indexed.
 for folder in [ROOT/'research/references/uploaded-lamu-actions/raw',ROOT/'research/references/original-element-skills/raw',VAULT/'supplemental']:
  if folder.exists():
   for f in folder.rglob('*.source.json'):
    try:
     receipt=json.loads(f.read_text());url=receipt.get('url',receipt.get('sourceUrl',''))
     if url.startswith(BASE):add(url[len(BASE):],{'type':'prior-official-receipt','source':str(f.relative_to(ROOT))})
    except Exception:pass
 # Expand only finite families explicitly described by client configuration.
 for version,table in tables:
  source=OUT/'bootstrap/dll/ClientConfigDLL.swf' if version=='current-config' else VAULT/'raw/root/dll/ClientConfigDLL.swf'
  for string in abc_strings(source.read_bytes()):
   for template in re.findall(r'resource/lahmClassRoom/lahmMovie/pet\*Movie/\d+\.swf',string):
    for level in [1,2,3,4,5,101]:add(template.replace('*',str(level)),{'type':'client-wildcard-expansion','source':str(source.relative_to(ROOT)),'template':template,'level':level})
 for ident in range(1208000,1208018):add(f'resource/petcloth/swf2/{ident}.swf',{'type':'client-skill-formula','source':'LamuNPC.useLamuSkill','formula':'1208000 + type - 1 + (level - 1) * 3'})
 for level,skill in [(5,1),(5,2),(5,4),(101,7)]:add(f'resource/petcloth/swf2/pet{level}/skill_{skill}.swf',{'type':'client-parameter-expansion','source':'LamuNPC.refurbish'})
 for level in [1,2,3,4,5,101]:
  for variant in range(1,5):add(f'resource/pet/swf/pet{level}/tuya{variant}.swf',{'type':'client-parameter-expansion','source':'com.module.ninePicGame.tuya.tuyaArr'})
 for group,values in [('classMovie',range(1,4)),('happyMovie',range(1,11)),('honerMovie',range(1,12))]:
  for value in values:add(f'resource/lahmClassRoom/{group}/{value}.swf',{'type':'client-parameter-expansion','source':'InfolahmClassRoom / lahmClassRoomUI','group':group})
 # Manifest receipts from previously recovered packs carry explicit official URLs.
 for source in [ROOT/'research/references/original-flight/sources.json',ROOT/'research/references/original-element-skills/source-receipt.json']:
  text=source.read_text() if source.exists() else ''
  for path in re.findall(r'https://mole\.61\.com/([\w./-]+\.swf)',text):add(path,{'type':'prior-official-receipt','source':str(source.relative_to(ROOT))})
 # The old spell costume names are a finite eight-entry client array.
 mantra=VAULT/'extracted/root/dll/ClientConfigDLL.swf/scripts/com/global/staticData/database/magic/InfoMantraArray.as'
 if mantra.exists():
  match=re.search(r'MantraArray1:Array\s*=\s*\[([^]]+)\]',mantra.read_text())
  if match:
   for name in re.findall(r'"(\w+)"',match.group(1)):
    for level in [1,2,3,4,101]:add(f'resource/petcloth/body/pet{level}/{name}.swf',{'type':'client-mantra-array','source':str(mantra.relative_to(ROOT))},name)
 with sqlite3.connect(VAULT/'catalog.sqlite') as connection:
  for path, in connection.execute("select path from assets where kind='swf' and (search like '%level101%' or search like '%bibo%' or search like '%拉姆%')"):
   add(path,{'type':'pinned-archive-rig-label','source':path})
 # The animal-skill module is under the Ram PK system; retain it as a
 # related subsystem rather than labelling it as a full Ram character action.
 data=(OUT/'bootstrap/dll/ClientConfigDLL.swf').read_bytes();symbols=decode_swf(data)['symbols']
 for code,payload in tags(data):
  if code!=87:continue
  name=symbols.get(str(struct.unpack_from('<H',payload)[0]),'')
  if 'animalSkill' not in name:continue
  try:xml=ET.fromstring(payload[6:].decode('utf-8-sig'))
  except (UnicodeDecodeError,ET.ParseError):continue
  if xml.get('path'):
   for node in xml.iter('class'):
    if node.get('file'):add(xml.get('path')+node.get('file'),{'type':'client-binary-xml','source':'ClientConfigDLL:'+name})
  for node in xml.iter('skill'):
   ident=node.get('skill_id')
   if ident and ident.isdigit():
    for folder in ['resource/lamuPKSys/animalSkill/skillsource/','resource/lamuPKSys/animalSkill/skillsource/icon/']:add(folder+ident+'.swf',{'type':'client-binary-xml','source':'ClientConfigDLL:'+name},node.get('name'))
 expand_indexed_families(add,candidates)
 save_json(OUT/'parameterized-refs.json',literal_strings)
 save_json(OUT/'candidates.json',dict(createdAt=STAMP(),scope='Official item tables, known archive paths/symbols, client literal/ABC references and finite resource families cross-checked against the official hashed version index.',items=sorted(candidates.values(),key=lambda e:e['path'])))
 print('Discovered',len(candidates),'candidate paths;',len(relevant_items),'named item records;',len(unique_files),'referencing source files',flush=True)

def fetch(entry):
 p=entry['path'];url=BASE+p
 if entry.get('versionQuery'):url+='?'+entry['versionQuery']
 record={**entry,'url':url,'checkedAt':STAMP()};old=VAULT/'raw/root'/p;dest=OUT/'files'/p
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'mole-baby-source-archive/1.0','Accept':'application/x-shockwave-flash,*/*;q=0.5'})
  with urllib.request.urlopen(req,timeout=18) as response:
   if urllib.parse.urlsplit(response.url).hostname!='mole.61.com':raise ValueError('Redirect outside official host')
   data=response.read(24*1024*1024+1);record.update(httpStatus=response.status,finalUrl=response.url,contentType=response.headers.get('Content-Type'),lastModified=response.headers.get('Last-Modified'),etag=response.headers.get('ETag'))
  if len(data)>24*1024*1024:raise ValueError('Resource exceeds per-file cap')
  info=decode_swf(data)
  dest.parent.mkdir(parents=True,exist_ok=True);part=dest.with_suffix('.swf.part');part.write_bytes(data);part.replace(dest)
  record.update(status='official-ok',bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),localPath=str(dest.relative_to(ROOT)),sameAsPinnedArchive=old.exists() and hashlib.sha256(old.read_bytes()).hexdigest()==hashlib.sha256(data).hexdigest(),fps=info['fps'],rootFrames=info['frames'],multiFrameTimelines=sum(t['frames']>1 for t in info['timelines']),hasScripts=info['hasScripts'],hasImages=info['hasImages'],hasSound=info['hasSound'],labels=sorted(set(l['name'] for t in info['timelines'] for l in t['labels'])),symbols=list(info['symbols'].values()))
  save_json(OUT/'timelines'/(p+'.json'),info)
 except urllib.error.HTTPError as e:record.update(status='http-error',httpStatus=e.code,error=str(e))
 except Exception as e:record.update(status='fetch-or-format-error',error=f'{type(e).__name__}: {e}')
 return record

def download(workers=4):
 candidates=json.loads((OUT/'candidates.json').read_text())['items'];receipts=OUT/'receipts.jsonl';done={}
 if receipts.exists():
  for line in receipts.read_text().splitlines():
   r=json.loads(line);done[r['path']]=r
 pending=[e for e in candidates if e['path'] not in done]
 print(f'Checking {len(pending)} pending / {len(candidates)} paths',flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool,receipts.open('a') as log:
  for i,result in enumerate(pool.map(fetch,pending)):
   done[result['path']]=result;log.write(json.dumps(result,ensure_ascii=False)+'\n');log.flush()
   if (i+1)%25==0:print(f'Checked {i+1}/{len(pending)}; official {sum(r["status"]=="official-ok" for r in done.values())}',flush=True)
 save_json(OUT/'catalog.json',dict(createdAt=STAMP(),base=BASE,items=[done[e['path']] for e in candidates if e['path'] in done],unattempted=[e['path'] for e in candidates if e['path'] not in done]))
 print('Completed',len(done),'path receipts',flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('command',choices=['discover','download','retry']);parser.add_argument('--workers',type=int,default=4);parser.add_argument('--versioned',action='store_true',help='Retry transient errors with the normal client version suffix, when indexed');a=parser.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 if a.command=='discover':discover()
 elif a.command=='download':download(min(4,max(1,a.workers)))
 else:
  rows={}
  for line in (OUT/'receipts.jsonl').read_text().splitlines():
   value=json.loads(line);rows[value['path']]=value
  candidates={e['path']:e for e in json.loads((OUT/'candidates.json').read_text())['items']}
  pending=[candidates[path] for path,r in rows.items() if r['status']=='fetch-or-format-error' or r.get('httpStatus') in [408,429,500,502,503,504]]
  if a.versioned:
   versions,_=version_index()
   # getModifiedValue returns milliseconds before getVerURLByNameSpace
   # encodes the value in base 36 (normal production mode has devRand=0).
   pending=[{**e,'versionQuery':base36(versions[version_hash(e['path'])]*1000)} if version_hash(e['path']) in versions else e for e in pending]
  print('Retrying transient failures:',len(pending),flush=True)
  with concurrent.futures.ThreadPoolExecutor(max_workers=min(4,max(1,a.workers))) as pool,(OUT/'receipts.jsonl').open('a') as log:
   for result in pool.map(fetch,pending):
    result['retry']=True;log.write(json.dumps(result,ensure_ascii=False)+'\n');log.flush();print(result['path'],result['status'],flush=True)

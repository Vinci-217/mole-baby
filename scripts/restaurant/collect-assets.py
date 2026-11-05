#!/usr/bin/env python3
"""Fill missing original restaurant assets, without altering the pinned mirror."""
import concurrent.futures,hashlib,json,sys,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/client-library'))
from library import swf_body
j=json.loads((ROOT/'research/references/restaurant/port-feasibility.json').read_text())
cache=ROOT/'local-assets/research/restaurant-port/official'
paths=[f'resource/restaurant/{kind}/{x["ID"]}.swf' for x in j['recipes'] for kind in ['swf','meunicon']]+[x['asset']['path'] for x in j['interiors']]
def get(p):
 for local in [ROOT/'local-assets/raw/root'/p,cache/p]:
  if local.exists():
   data=local.read_bytes();swf_body(data)
   return dict(path=p,local=str(local.relative_to(ROOT)),bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
 for attempt in range(3):
  try:
   req=urllib.request.Request('https://mole.61.com/'+p,headers={'User-Agent':'Mozilla/5.0'})
   with urllib.request.urlopen(req,timeout=18) as response:data=response.read()
   swf_body(data);out=cache/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(data)
   return dict(path=p,local=str(out.relative_to(ROOT)),bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),url='https://mole.61.com/'+p)
  except Exception as e:
   if attempt==2:return dict(path=p,error=str(e))
   time.sleep(1+attempt)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=[]
 for entry in pool.map(get,paths):
  results.append(entry)
  print(entry['path'],entry.get('bytes',entry.get('error')),flush=True)
(cache.parent/'playable-assets.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print('VERIFIED',sum('local'in x for x in results),'/',len(results))

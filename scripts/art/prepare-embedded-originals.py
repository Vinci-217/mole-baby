#!/usr/bin/env python3
"""Ship the playable Ram families, not the research archive or game modules."""
import hashlib,json,re,shutil,struct,subprocess,zlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/client-library'))
from collect_ram_official import abc_strings
from outfit_forms import playable_outfit_forms
VAULT=ROOT/'local-assets/ram-official-sweep/2026-11-06'
OUT=ROOT/'public/assets/original/official'
KINDS={'装扮／变身动作':'outfit','道具互动动作':'care','课堂／学习动作':'school',
 '技能身体／变身':'magic','拉姆世界变身':'transform','角色骨骼／基础动作':'body','拉姆战斗／技能素材':'skill'}
CONTROLLERS={'module/lamuPKSys/AnimalSkillControler.swf','resource/lamuPKSys/animalSkill/skillLib/celebrationSkill.swf','resource/lamuPKSys/animalSkill/skillLib/eggRainSkill.swf'}
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 items=json.loads((VAULT/'items.json').read_text());clips=[];outfits=[]
 bodyRegistrations=json.loads((ROOT/'scripts/art/embedded-original/body-registration.json').read_text())
 old={'1200008','1200018','1200020','1200021','1200026','1200033','1200036','1200047','1200052','1200006','1200024','1200040'}
 for row in json.loads((VAULT/'catalog.json').read_text())['items']:
  if row.get('status')!='official-ok' or row['category'] not in KINDS:continue
  if row['path'] in CONTROLLERS:continue
  source=VAULT/'files'/row['path'];data=source.read_bytes()
  assert hashlib.sha256(data).hexdigest()==row['sha256']
  target=OUT/'files'/row['path'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
  timeline=json.loads((VAULT/row['timelineUrl']).read_text())
  main=next((t for t in timeline['timelines'] if 'lamu_mc' in t.get('symbol','')),None)
  if main is None:main=next((t for t in timeline['timelines'] if t.get('symbol') and any(label['name'].startswith('level') for label in t['labels'])),None)
  # These byte-identical wrappers launch a one-shot celebration emitter. The
  # exported timeline contains the complete visible effect and can be replayed.
  if row['path'] in ['resource/lamuPKSys/animalSkill/skillsource/2.swf','resource/lamuPKSys/animalSkill/skillsource/4.swf']:
   main=next(t for t in timeline['timelines'] if t.get('symbol')=='2_fla.ctp11_1')
  if row['path'].endswith('/shikongganying.swf'):
   main=next(t for t in timeline['timelines'] if t.get('symbol')=='shikongganying_fla.Timeline_1')
  ident=hashlib.sha256(row['path'].encode()).hexdigest()[:16];stem=source.stem
  kind=KINDS[row['category']]
  if kind=='outfit' and (stem not in items or stem.isdigit() and int(stem)>=1208000):kind='skill'
  name={'1200026':'魔法书','1200042':'端盘服务员','1200043':'空手服务员'}.get(stem,(row.get('names')or[stem])[0])
  if not row.get('names') and kind=='school':name='课堂片段 '+stem
  level=re.search(r'/(?:pet|pet)(\d+)(?:Movie)?/',row['path'])
  strings=abc_strings(data);needsBase='petBone3' in strings and 'petBone1' not in strings
  forms=[l['name'] for l in main['labels'] if l['name'].startswith('level')] if main else []
  if needsBase:forms=[form for form in forms if form in ['level1','level2','level3','level4','level101']]
  if kind=='outfit':
   available=playable_outfit_forms(source,main['symbol'] if main else '')
   forms=[form for form in forms if form in available]
  clips.append(dict(id=ident,name=name,kind=kind,path=row['path'],sha256=row['sha256'],base=needsBase,
   bytes=len(data),symbol=main['symbol'] if main else '',forms=forms,
   level=int(level[1]) if level else 0,fps=row.get('fps',24),animated=bool(row.get('multiFrameTimelines')),
   **({'clothingLayer':int(items[stem].get('Layer',0))} if kind=='outfit' else {})))
  if row['path'] in bodyRegistrations:
   anatomy=bodyRegistrations[row['path']]
   assert anatomy['sha256']==row['sha256'], 'Recheck body paths against changed source artwork'
   for field in ['namedBodyPaths','effectBounds','effectFrames','referenceBodyBounds','viewportScale']:
    if field in anatomy:clips[-1][field]=anatomy[field]
  if kind=='outfit' and stem not in old:
   icon=VAULT/'files/resource/petcloth/icon'/(stem+'.swf')
   outfits.append(dict(id='original-'+stem,name=name,sourceId=stem,clipId=ident,price=80,width=.6,x=0,y=0,iconPath='./assets/original/official/icons/'+stem+'.png' if icon.exists() else './assets/original/ui/icon-happy.png'))
 bodyBounds={form:row['body'] for form,row in json.loads((ROOT/'electron/edge-visibility.json').read_text())['forms'].items()}
 (OUT/'manifest.json').write_text(json.dumps(dict(version=1,clips=clips,outfits=outfits,bodyBounds=bodyBounds),ensure_ascii=False,indent=2)+'\n')
 keep={clip['path'] for clip in clips}
 for copied in (OUT/'files').rglob('*.swf'):
  if str(copied.relative_to(OUT/'files')) not in keep:copied.unlink()
 for name in ['runtime.html','runtime.js']:
  shutil.copyfile(ROOT/'scripts/art/embedded-original'/name,OUT/name)
 ruffle=OUT/'ruffle';ruffle.mkdir(exist_ok=True)
 for p in (VAULT/'ruffle').iterdir():
  if p.is_file():shutil.copyfile(p,ruffle/p.name)
 source=VAULT/'files/resource/petcloth/swf2/1200026.swf';destination=OUT/'controller.swf'
 subprocess.run(['java','-Xmx450m','-jar','/opt/jpexs/26.4.0/ffdec-cli.jar','-replace',str(source),str(destination),'§1200026_fla§.lamu_mc_1',str(ROOT/'scripts/art/EmbeddedRamHarness.as')],check=True)
 data=destination.read_bytes();body=zlib.decompress(data[8:]) if data[:3]==b'CWS' else data[8:]
 body=body.replace(b'1200026_fla',b'preview_fla');oldRect=(5+4*(body[0]>>3)+7)//8
 bits=16;encoded=f'{bits:05b}'+''.join(f'{v:0{bits}b}' for v in [0,25600,0,27648]);encoded+='0'*((-len(encoded))%8)
 body=int(encoded,2).to_bytes(len(encoded)//8,'big')+body[oldRect:]
 destination.write_bytes(b'CWS'+data[3:4]+struct.pack('<I',len(body)+8)+zlib.compress(body))
 receipt=dict(files=len(clips),newOutfits=len(outfits),bytes=sum(c['bytes'] for c in clips),categories={k:sum(c['kind']==k for c in clips) for k in sorted(set(c['kind'] for c in clips))},
  adaptation='Original SWF vectors and timelines; a separate offline controller selects the source forms, directions and bone events. No artwork interpolation. Source archive and player saves unchanged.')
 (OUT/'source.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(receipt,ensure_ascii=False))
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Build a browsable manifest for the official Ram SWF sweep."""
import collections,csv,datetime,hashlib,json,shutil,zipfile
from pathlib import Path
from library import decode_swf
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'local-assets/ram-official-sweep/2026-11-06'

def main():
 candidates={e['path']:e for e in json.loads((OUT/'candidates.json').read_text())['items']}
 receipts={}
 receipt=OUT/'receipts.jsonl'
 if receipt.exists():
  for line in receipt.read_text().splitlines():
   if line.strip():
    row=json.loads(line);receipts[row['path']]=row
 items=[]
 for path,candidate in candidates.items():
  row={**candidate,**receipts.get(path,{})};row['names']=candidate.get('names',[])
  row['category']=candidate['category'];row['evidence']=candidate['evidence']
  row['previouslyInPinnedArchive']=(ROOT/'local-assets/raw/root'/path).exists()
  row['aliases']=({'1200026':['魔法书','读书','紫色书'],'1200042':['餐厅','端盘','服务员'],'1200043':['餐厅','空手','服务员']}.get(Path(path).stem,[]))
  if row.get('status')=='official-ok':
   row['fileUrl']='files/'+path
   row['timelineUrl']='timelines/'+path+'.json'
   row['localPath']='files/'+path
  items.append(row)
 items.sort(key=lambda r:r['path'])
 ok=[r for r in items if r.get('status')=='official-ok']
 summary={'candidates':len(items),'checked':sum(bool(r.get('checkedAt')) for r in items),'official':len(ok),'newOfficial':sum(not r.get('previouslyInPinnedArchive') for r in ok),'changedOfficial':sum(r.get('previouslyInPinnedArchive') and not r.get('sameAsPinnedArchive') for r in ok),'bytes':sum(r.get('bytes',0)for r in ok),'multiFrame':sum(bool(r.get('multiFrameTimelines')) for r in ok),'uniqueContents':len({r['sha256'] for r in ok}),'statuses':dict(collections.Counter(r.get('status','unattempted') for r in items)),'categories':{}}
 for row in ok:summary['categories'][row.get('category','其他')]=summary['categories'].get(row.get('category','其他'),0)+1
 catalog={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':'https://mole.61.com/','scope':'通过固定社区存档、当前客户端配置、客户端 SWF/AS 路径及官方版本索引核对后的有限资源族收集；官方没有公开完整历史资源目录，因此不宣称覆盖所有年代的全部文件。','summary':summary,'items':items}
 (OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
 with (OUT/'catalog.csv').open('w',newline='') as f:
  fields=['path','category','status','name','names','url','bytes','sha256','fps','rootFrames','multiFrameTimelines','hasScripts','hasImages','hasSound','previouslyInPinnedArchive','sameAsPinnedArchive','httpStatus','checkedAt','fileUrl','timelineUrl','error']
  w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader()
  for r in items:w.writerow({**r,'name':(r.get('names')or[''])[0],'names':' / '.join(r.get('names')or[])})
 shutil.copyfile(ROOT/'scripts/client-library/ram-catalog.html',OUT/'index.html')
 if (OUT/'preview-harness.swf').exists():
  shutil.copyfile(ROOT/'scripts/client-library/ram-preview.html',OUT/'preview.html')
 # Re-read every confirmed original. Never package a missing, altered or
 # unparsable file, and verify cached timeline metadata against the SWF.
 checksums=[]
 for row in ok:
  data=(OUT/'files'/row['path']).read_bytes()
  if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256']:
   raise ValueError('Original checksum mismatch: '+row['path'])
  decoded=json.loads(json.dumps(decode_swf(data)))
  cached=json.loads((OUT/'timelines'/(row['path']+'.json')).read_text())
  if decoded!=cached:raise ValueError('Timeline mismatch: '+row['path'])
  checksums.append(row['sha256']+'  files/'+row['path'])
 (OUT/'SHA256SUMS').write_text('\n'.join(checksums)+'\n')
 (OUT/'verification.json').write_text(json.dumps(dict(checkedAt=catalog['createdAt'],
  confirmedOriginals=len(ok),checksumMatches=len(ok),swfParseMatches=len(ok),
  timelineMatches=len(ok),errors=[]),ensure_ascii=False,indent=2)+'\n')
 (OUT/'README.md').write_text(f'''# 拉姆官方 SWF 收集结果

2026-11-06 从 https://mole.61.com/ 收集，按官方相对路径保存。

- 检查 {summary['checked']} 个候选路径，保存 {summary['official']} 个可验证的官方 SWF。
- 原件共 {summary['bytes']:,} 字节（{summary['bytes']/1_000_000:.1f} MB），包含 {summary['uniqueContents']} 种不同内容。
- {summary['multiFrame']} 个文件含多帧时间轴；这不等于同样数量的完整角色动作。
- 相对固定本地库：新增路径 {summary['newOfficial']} 个，原路径官方字节不同 {summary['changedOfficial']} 个。
- 未取得的路径、HTTP 状态或超时原因保留在 catalog.json / catalog.csv 中。

## 浏览与复用

在本目录运行 `python3 -m http.server 5187`，打开 http://localhost:5187/。
网页支持名称、编号、路径和动作标签搜索。SWF 原件位于 files/，对应时间轴位于 timelines/。
catalog.json 记录官方地址、来源依据、时间、分类和 SHA-256；SHA256SUMS 可用 `sha256sum -c SHA256SUMS` 复核。
verification.json 记录本次对所有已保存文件的字节、解析和时间轴复核结果。
ram-official-swfs.zip 保留相同目录结构，含原件、时间轴和索引，解压后可按上述方式浏览。

## 范围

来源为固定存档路径／符号、当前和旧版官方配置、客户端代码引用以及官方版本索引中可核对的有限资源族。
不是官方所有历史版本的全集。图标、服装图层、技能片段和场景已分别分类，不冒称完整动画。
服装和身体可能需要按原客户端骨骼、成长阶段、方向、配色和事件规则组合。
采集阶段只解析数据；网页预览通过本地 Ruffle 播放原件动作，使用独立的方向和骨骼同步适配器，不生成替代动作。
点击列表的“预览”可查看画面、切换原件实际支持的形态／方向、走动／站立、暂停与缩放。
图层和依赖游戏环境的模块不一定能独立还原完整角色。来源与适配见 preview-source.json。
此目录独立保存，不改旧原件库或玩家存档，不进入安装包。

原素材归淘米等原权利方所有；本地归档不改变素材权属。
''')
 # Package only confirmed official files; preserve relative resource paths.
 zipPath=OUT/'ram-official-swfs.zip';
 with zipfile.ZipFile(zipPath,'w',zipfile.ZIP_DEFLATED) as z:
  for r in ok:
   p=OUT/'files'/r['path']
   z.write(p,'files/'+r['path'])
   z.write(OUT/'timelines'/(r['path']+'.json'),'timelines/'+r['path']+'.json')
  for name in ['catalog.json','catalog.csv','index.html','README.md','SHA256SUMS','verification.json','version-index-audit.json']:
   z.write(OUT/name,name)
  if (OUT/'preview-harness.swf').exists():
   for name in ['preview.html','preview-harness.swf','preview-harness.as','preview-source.json']:
    z.write(OUT/name,name)
   if (OUT/'animation-preview-verification.json').exists():
    z.write(OUT/'animation-preview-verification.json','animation-preview-verification.json')
   for p in sorted((OUT/'ruffle').iterdir()):
    if p.is_file():z.write(p,str(p.relative_to(OUT)))
 with zipfile.ZipFile(zipPath) as z:
  damaged=z.testzip()
  if damaged:raise ValueError('Archive integrity failed: '+damaged)
 print(json.dumps({'summary':summary,'catalog':str(OUT/'catalog.json'),'zipBytes':zipPath.stat().st_size},ensure_ascii=False))
if __name__=='__main__':main()

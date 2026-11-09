#!/usr/bin/env python3
"""Apply reviewed source-vector measurements; keep all atlas images and frames.
Run after inspect-element-bodies.py, or use --record to reuse checked source SHA.
"""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
args=argparse.ArgumentParser();args.add_argument('--record',action='store_true');args=args.parse_args()
record_file=ROOT/'research/element-body-registration-2026-11-09.json'
if args.record:
 records=json.loads(record_file.read_text())
else:
 candidates=json.loads((ROOT/'artifacts/all-animation-sizes/element-body-candidates.json').read_text());records=[]
 for c in candidates:
  native=next(((k,v[0]) for k,v in c['forms'].items() if k.startswith('level4') and v),None)
  raster=next(((k,v[0]) for k,v in c['forms'].items() if k.startswith('getItem') and v),None)
  assert native and raster,c['path']
  records.append({'path':c['path'],'sha256':c['sha256'],'nativePose':native[0],'native':native[1],'rasterPose':raster[0],'raster':raster[1]})
 record_file.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
body_file=ROOT/'scripts/art/embedded-original/body-registration.json';bodies=json.loads(body_file.read_text())
index_file=ROOT/'public/assets/original/element-skills/clips.json';index=json.loads(index_file.read_text());notes=[]
for record in records:
 source=ROOT/'local-assets/ram-official-sweep/2026-11-06/files'/record['path']
 assert hashlib.sha256(source.read_bytes()).hexdigest()==record['sha256'], 'Changed source: remeasure body contours'
 native=record['native'];row=bodies.setdefault(record['path'],{'sha256':record['sha256']})
 row['referenceBodyBounds']=[round(v,8) for v in native['bounds']]
 row['evidence']=f"Original face contour, shape {native['shapeId']}, fill {native.get('fillStyle')}, pose {record['nativePose']}; horizontal contour through the original eyes excludes flames, branches, water columns and shadows. One fixed uniform registration for the entire timeline."
 clip=next(c for c in index.values() if str(c['sourceId'])+'.swf'==record['path'].split('/')[-1]);assert clip['sourceSha256']==record['sha256']
 skin=record['raster'];r=clip['registration'];r['referenceBodyWidth']=skin['rowWidth']*r['sourceRasterZoom']*r['scale']
 r['bodyReferenceSource']={'shape':skin['shapeId'],'fill':skin.get('fillStyle'),'pose':record['rasterPose'],'width':skin['rowWidth'],'sha256':record['sha256']}
 # Matching vector/pixel extents identify the source raster's origin without
 # guessing an offset. Otherwise retain the existing verified source origin.
 frame=int(record['rasterPose'].split('#')[1])-1 if '#' in record['rasterPose'] else 0
 rect=clip['rectangles'][clip['frameMap'][frame]];scene=skin['sceneBounds'];zoom=r['sourceRasterZoom']*r['scale']
 exact=abs(rect[3]-(scene[2]-scene[0])*zoom)<4 and abs(rect[4]-(scene[3]-scene[1])*zoom)<4
 if exact:
  r['centerX']=rect[5]+((skin['bounds'][0]+skin['bounds'][2])/2-scene[0])*zoom
  r['baseY']=rect[6]+(skin['bounds'][3]-scene[1])*zoom
 (ROOT/'public/assets/original/element-skills'/clip['id']/'clip.json').write_text(json.dumps(clip,ensure_ascii=False,indent=2)+'\n')
 notes.append({'id':clip['id'],'native':row['referenceBodyBounds'],'rasterWidth':r['referenceBodyWidth'],'originMatched':exact})
body_file.write_text(json.dumps(bodies,ensure_ascii=False,indent=2)+'\n');index_file.write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
p=ROOT/'public/assets/original/official/manifest.json';manifest=json.loads(p.read_text())
for clip in manifest['clips']:
 if clip['path'] in bodies:
  b=bodies[clip['path']];assert b['sha256']==clip['sha256']
  for key in ['namedBodyPaths','effectBounds','effectFrames','referenceBodyBounds','viewportScale']:
   if key in b:clip[key]=b[key]
p.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(notes,ensure_ascii=False,indent=2))

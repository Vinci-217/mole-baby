#!/usr/bin/env python3
"""Decode the original getItem nested timelines; register and pack without repainting.
Usage: python scripts/art/export-original-elements.py --exporter /path/to/export-swf
JPEXS SourceExporter.java is supplied alongside this script (Java + ffdec_lib required).
"""
import argparse, concurrent.futures, hashlib, json, math, subprocess, tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
RAW=ROOT/'research/references/original-element-skills/raw'
OUT=ROOT/'public/assets/original/element-skills'
CELL=288;COLS=12;PAGE_FRAMES=96
PLACEHOLDERS=json.loads((ROOT/'research/references/original-element-skills/item-placeholders.json').read_text())
NAMES=[['小火苗','旺盛火焰','爆烈燃烧','火焰漩涡','流星火','星火涅槃'],['小水滴','水花碎片','水上蔓延','似水奔腾','水龙','水上狂舞'],['小树苗','树根缠绕','通天藤蔓','飞花炫舞','野蛮生长','上天入地']]

def export_one(source_id,exporter,work):
 raw=RAW/f'{source_id}.swf';xml=work/f'{source_id}.xml'
 if not xml.exists():subprocess.run([exporter,'xml',str(raw),str(xml)],check=True,stdout=subprocess.DEVNULL)
 root=ET.parse(xml).getroot()
 sprites={x.get('spriteId'):x for x in root.iter() if x.get('type')=='DefineSpriteTag'}
 candidates=[(sid,s) for sid,s in sprites.items() if any(x.get('type')=='FrameLabelTag' and x.get('name')=='getItem' for x in s.find('subTags'))]
 if len(candidates)!=1:raise ValueError(f'{source_id}: expected one action timeline')
 sprite,s=candidates[0];frame=0;selected=False;child=None
 for tag in s.find('subTags'):
  if tag.get('type')=='FrameLabelTag' and tag.get('name')=='getItem':selected=True
  if selected and 'PlaceObject' in tag.get('type','') and tag.get('placeFlagHasCharacter')=='true':child=tag.get('characterId');break
  if tag.get('type')=='ShowFrameTag':frame+=1
 if not child:raise ValueError('Missing getItem child')
 count=int(sprites[child].get('frameCount'));frames_dir=work/str(source_id)
 frames=list(frames_dir.rglob('*.png'))
 if len(frames)!=count:
  subprocess.run([exporter,'nested',str(raw),str(frames_dir),sprite,str(frame),str(count),'4',','.join(map(str,PLACEHOLDERS[str(source_id)]))],check=True,stdout=subprocess.DEVNULL)
 frames=sorted(frames_dir.rglob('*.png'),key=lambda f:int(f.stem))
 if len(frames)!=count:raise ValueError('Truncated timeline')
 images=[Image.open(f).convert('RGBA') for f in frames]
 boxes=[im.getbbox() for im in images if im.getbbox()]
 bounds=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
 width=bounds[2]-bounds[0];height=bounds[3]-bounds[1]
 scale=min(144/width,166/height)
 unique=[];lookup={};frame_map=[]
 for im in images:
  crop=im.crop(bounds).resize((round(width*scale),round(height*scale)),Image.Resampling.LANCZOS)
  target=Image.new('RGBA',(CELL,CELL));target.alpha_composite(crop,(round((CELL-crop.width)/2),226-crop.height))
  # Fully transparent pixels have canonical RGB for deterministic deduplication.
  target.paste((0,0,0,0),(0,0,CELL,CELL),target.getchannel('A').point(lambda a:255 if a==0 else 0))
  digest=hashlib.sha256(target.tobytes()).hexdigest()
  if digest not in lookup:lookup[digest]=len(unique);unique.append(target)
  frame_map.append(lookup[digest])
 typ=['fire','water','wood'][(source_id-1208000)%3];level=(source_id-1208000)//3+1;skill_id=f'{typ}-{level}';dest=OUT/skill_id;dest.mkdir(parents=True,exist_ok=True)
 pages=[]
 for start in range(0,len(unique),PAGE_FRAMES):
  part=unique[start:start+PAGE_FRAMES];atlas=Image.new('RGBA',(COLS*CELL,math.ceil(len(part)/COLS)*CELL))
  for index,im in enumerate(part):atlas.alpha_composite(im,((index%COLS)*CELL,(index//COLS)*CELL))
  name=f'atlas-{len(pages)}.png';atlas.save(dest/name,optimize=True);pages.append(name)
 meta={'id':skill_id,'name':NAMES[(source_id-1208000)%3][level-1],'sourceId':source_id,'sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'sourceUrl':f'https://mole.61.com/resource/petcloth/swf2/{source_id}.swf','fps':float(root.get('frameRate')),'frames':count,'frameMap':frame_map,'cell':CELL,'columns':COLS,'pageFrames':PAGE_FRAMES,'pages':pages,'actionSprite':int(sprite),'rootFrame':frame,'nestedSprite':int(child),'clearedRuntimeItemSprites':PLACEHOLDERS[str(source_id)],'sourceBounds':bounds,'registration':{'scale':scale,'centerX':144,'baseY':226,'maxWidth':144,'maxHeight':166},'durationMs':math.ceil(count/float(root.get('frameRate'))*1000)}
 (dest/'clip.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
 contact=Image.new('RGB',(600,300),'#e8e0ce');draw=ImageDraw.Draw(contact)
 for j in range(8):
  ix=round((count-1)*j/7);im=unique[frame_map[ix]].resize((144,144));contact.paste(im,((j%4)*150,(j//4)*150),im);draw.text(((j%4)*150+3,(j//4)*150+130),str(ix+1),fill='black')
 review=ROOT/'artifacts/element-review';review.mkdir(parents=True,exist_ok=True);contact.save(review/f'{skill_id}.png')
 print(skill_id,count,'source frames',len(unique),'unique',flush=True)
 return meta

def main():
 args=argparse.ArgumentParser();args.add_argument('--exporter',required=True);args.add_argument('--work',default='/tmp/mole-original-element-export');args=args.parse_args();work=Path(args.work);work.mkdir(parents=True,exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:clips=list(pool.map(lambda n:export_one(n,args.exporter,work),range(1208000,1208018)))
 (OUT/'clips.json').write_text(json.dumps({c['id']:c for c in clips},ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()

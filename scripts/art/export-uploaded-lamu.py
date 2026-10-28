#!/usr/bin/env python3
"""Convert the supplied SWFs to complete, registered, colourable raster sequences.

No Flash runtime or ActionScript execution. Every source time frame is retained
in frameMap; identical frames and identical source files share raster storage.
"""
import argparse, concurrent.futures, copy, hashlib, json, math, shutil, subprocess
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[2]
SOURCES=ROOT/'research/references/uploaded-lamu-actions'
OUT=ROOT/'public/assets/original/uploaded-actions'
WORK=Path('/tmp/mole-v31-upload-export')
CP='/tmp/mole-v31-tools:/workspace/.ramu-assets/tools/ffdec/lib/*'
PAGE=2048
RASTER=1.5

def java(tool,*args):
    return ['java','-Djava.awt.headless=true','-Xmx900m','-cp',CP,tool,*map(str,args)]

def run(entry):
    key=f"{entry['form']}-{entry['id']}"
    dest=OUT/key;receipt=dest/'clip.json'
    fingerprint=hashlib.sha256((Path(__file__).read_bytes()+(ROOT/'scripts/art/UploadedSwfExporter.java').read_bytes()+(ROOT/'scripts/art/compress-uploaded-atlases.cjs').read_bytes()+(ROOT/'electron/edge-visibility.json').read_bytes()+entry['sha256'].encode())).hexdigest()
    if receipt.exists():
        meta=json.loads(receipt.read_text())
        if meta.get('exportFingerprint')==fingerprint:return key,meta
    xml=Path('/tmp/mole-v31-xml')/entry['form']/f"{entry['id']}.xml"
    tree=ET.parse(xml);tags=list(tree.getroot().find('tags'))
    objects={n.get('spriteId')or n.get('shapeId'):n for n in tags if n.get('spriteId')or n.get('shapeId')}
    root_id=[n.get('characterId')for n in tags if n.get('type','').startswith('Place')and n.get('characterId')][-1]
    body=[n.get('characterId')for n in objects[root_id].iter()if n.get('name')=='petBody']
    # This one supplied file has no instance names; its first root layer is
    # the original moving body, followed by eyes/foliage and the wash product.
    body_id=body[0]if body else {'middle-180060':'100'}[key]
    reachable=set()
    def walk(sid):
        if sid in reachable or sid not in objects:return
        reachable.add(sid)
        for child in objects[sid].iter():
            if child.get('characterId'):walk(child.get('characterId'))
    walk(body_id)
    source_frames=max(int(n.get('frameCount','1'))for n in objects.values())
    changed=[]
    probes={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}
    for sid in reachable:
        n=objects[sid]
        if not n.get('type','').startswith(('DefineShape','DefineMorphShape')):continue
        colour_nodes=[c for c in n.iter()if all(k in c.attrib for k in ['red','green','blue'])]
        colours={tuple(int(c.get(k,'0'))for k in ['red','green','blue'])for c in colour_nodes}
        if (255,255,255)not in colours or (0,0,0)in colours:continue
        if colours!={(255,255,255)} and not colours.intersection({(204,204,204),(153,153,153)}):continue
        for c in colour_nodes:
            rgb=tuple(int(c.get(k,'0'))for k in ['red','green','blue'])
            if rgb in probes:
                for channel,value in zip(['red','green','blue'],probes[rgb]):c.set(channel,str(value))
        changed.append(sid)
    if not changed:raise ValueError('No isolated body fills: '+key)
    work=WORK/key;work.mkdir(parents=True,exist_ok=True)
    probe_xml=work/'probe.xml';probe_swf=work/'probe.swf';tree.write(probe_xml,encoding='utf-8',xml_declaration=True)
    neutral=SOURCES/entry['file'];frames=work/'frames'
    raw_fingerprint=hashlib.sha256(entry['sha256'].encode()+(ROOT/'scripts/art/UploadedSwfExporter.java').read_bytes()+ET.tostring(tree.getroot())).hexdigest()
    cache=work/'raw-fingerprint'
    if not cache.exists()or cache.read_text()!=raw_fingerprint or not (frames/'frames.json').exists():
        if frames.exists():shutil.rmtree(frames)
        with (work/'export.log').open('w')as log:
            subprocess.run(java('SourceExporter','xml2swf',probe_xml,probe_swf),stdout=log,stderr=log,check=True)
            subprocess.run(java('UploadedSwfExporter','frames',neutral,probe_swf,frames,root_id,source_frames,4),stdout=log,stderr=log,check=True)
        cache.write_text(raw_fingerprint)
    raw=json.loads((frames/'frames.json').read_text())
    pieces=[];body_boxes=[]
    for index,(dx,dy,w,h)in enumerate(raw['frames']):
        n=np.array(Image.open(frames/f'{index}-n.png').convert('RGBA'));p=np.array(Image.open(frames/f'{index}-p.png').convert('RGBA'))
        diff=n[:,:,:3].astype(float)-p[:,:,:3].astype(float)
        gray=np.clip((diff[:,:,0]+2*diff[:,:,2]/3)/170,0,1)
        dark=np.clip((diff[:,:,2]+51*gray)/153,0,1)
        white=np.clip((diff[:,:,1]+51*gray+102*dark)/255,0,1)
        mask=np.dstack([white*255,gray*255,dark*255,n[:,:,3]]).round().astype('uint8');mask[n[:,:,3]==0]=0
        ys,xs=np.where(((white+gray+dark)>.45)&(n[:,:,3]>150))
        if len(xs):body_boxes.append([int(xs.min()+dx),int(ys.min()+dy),int(xs.max()+dx+1),int(ys.max()+dy+1)])
        pieces.append((Image.fromarray(n),Image.fromarray(mask),dx,dy))
    if not body_boxes:raise ValueError('Empty body mask: '+key)
    visibility=json.loads((ROOT/'electron/edge-visibility.json').read_text())['forms'][entry['form']]['body']
    widths=[b[2]-b[0]for b in body_boxes]
    scale=(visibility[2]-visibility[0])*RASTER/max(1,float(np.percentile(widths,60)))
    reference=body_boxes[0]
    x0=min(p[2]for p in pieces);y0=min(p[3]for p in pieces)
    x1=max(p[2]+p[0].width for p in pieces);y1=max(p[3]+p[0].height for p in pieces)
    viewport=[math.ceil((x1-x0)*scale)+4,math.ceil((y1-y0)*scale)+4]
    registration={'scale':scale,'cssPixelsPerAtlasPixel':1/RASTER,'centerX':((reference[0]+reference[2])/2-x0)*scale+2,'baseY':(reference[3]-y0)*scale+2}
    unique=[];lookup={};frame_map=[];poses=[];pose_lookup={}
    for n,m,dx,dy in pieces:
        x=round((dx-x0)*scale)+2;y=round((dy-y0)*scale)+2
        right=round((dx+n.width-x0)*scale)+2;bottom=round((dy+n.height-y0)*scale)+2
        size=(max(1,right-x),max(1,bottom-y))
        pair=[im.resize(size,Image.Resampling.LANCZOS)for im in [n,m]]
        labels,_=ndimage.label(np.asarray(pair[0])[:,:,3]>0,np.ones((3,3)))
        boxes=ndimage.find_objects(labels);parts=[]
        for region in boxes:
            if region is None:continue
            crop=(region[1].start,region[0].start,region[1].stop,region[0].stop)
            # Connected components trim the empty space between a falling
            # chocolate bean and the pet instead of retaining a giant texture.
            for cy in range(crop[1],crop[3],512):
                for cx in range(crop[0],crop[2],512):
                    cell=(cx,cy,min(cx+512,crop[2]),min(cy+512,crop[3]))
                    tiles=[im.crop(cell)for im in pair]
                    ink=tiles[0].getbbox()
                    if not ink:continue
                    tiles=[im.crop(ink)for im in tiles]
                    digest=hashlib.sha256(tiles[0].tobytes()+tiles[1].tobytes()+str(tiles[0].size).encode()).hexdigest()
                    if digest not in lookup:lookup[digest]=len(unique);unique.append((tiles,0,0))
                    parts.append([lookup[digest],x+cx+ink[0],y+cy+ink[1]])
        pose_key=json.dumps(parts,separators=(',',':'))
        if pose_key not in pose_lookup:pose_lookup[pose_key]=len(poses);poses.append(parts)
        frame_map.append(pose_lookup[pose_key])
    bins=[];rectangles=[None]*len(unique)
    for index in sorted(range(len(unique)),key=lambda i:unique[i][0][0].height,reverse=True):
        pair,dx,dy=unique[index];w,h=pair[0].size
        if max(w,h)>PAGE-2:raise ValueError(f'Clip needs overlarge frame: {key} {w}x{h}')
        slot=None
        for page,state in enumerate(bins):
            for shelf in state['shelves']:
                if h<=shelf['height']and shelf['x']+w+1<=PAGE:slot=(page,shelf['x'],shelf['y']);shelf['x']+=w+1;break
            if slot:break
            if state['bottom']+h+1<=PAGE:
                slot=(page,1,state['bottom']);state['shelves'].append({'x':w+2,'y':state['bottom'],'height':h});state['bottom']+=h+1;break
        if slot is None:bins.append({'shelves':[{'x':w+2,'y':1,'height':h}],'bottom':h+2});slot=(len(bins)-1,1,1)
        rectangles[index]=[*slot,w,h,dx,dy]
    dest.mkdir(parents=True,exist_ok=True);pages=[]
    for suffix in ['*.png','*.webp']:
        for stale in dest.glob(suffix):stale.unlink()
    for page in range(len(bins)):
        entries=[(pair,r)for(pair,_,_),r in zip(unique,rectangles)if r[0]==page]
        width=max(r[1]+r[3]+1 for _,r in entries);height=max(r[2]+r[4]+1 for _,r in entries)
        names=[]
        for part,kind in enumerate(['neutral','mask']):
            atlas=Image.new('RGBA',(width,height))
            for pair,r in entries:atlas.paste(pair[part],(r[1],r[2]))
            name=f'{kind}-{page}.png';atlas.save(dest/name,optimize=True);names.append(name.replace('.png','.webp'))
        pages.append({'neutral':names[0],'mask':names[1],'width':width,'height':height})
    subprocess.run(['node',str(ROOT/'scripts/art/compress-uploaded-atlases.cjs'),str(dest)],check=True)
    meta={'source':entry['file'],'sourceSha256':entry['sha256'],'exportFingerprint':fingerprint,'form':entry['form'],'id':entry['id'],'sprite':int(root_id),'bodySprite':int(body_id),'inferredBodyBinding':not bool(body),'bodyShapeIds':changed,'frames':source_frames,'fps':24,'durationMs':math.ceil(source_frames/24*1000),'width':viewport[0],'height':viewport[1],'registration':registration,'pages':pages,'frameMap':frame_map,'poses':poses,'rectangles':rectangles,'bodyReference':reference}
    receipt.write_text(json.dumps(meta,separators=(',',':'))+'\n')
    poster=pieces[0][0].copy();poster=poster.crop(poster.getbbox());poster.thumbnail((128,128),Image.Resampling.LANCZOS);poster.save(dest/'poster.png',optimize=True)
    # Small contact sheet for visual review. Playback uses the exact same crops.
    board=Image.new('RGBA',(480,320),'#ede5c7')
    for j,index in enumerate(np.linspace(0,source_frames-1,12).astype(int)):
        view=Image.new('RGBA',tuple(viewport))
        for tile,x,y in poses[frame_map[index]]:view.alpha_composite(unique[tile][0][0],(x,y))
        im=view;im.thumbnail((116,96));board.alpha_composite(im,(j%4*120+(120-im.width)//2,j//4*106+(100-im.height)//2))
    board.convert('RGB').save(work/'contact.jpg')
    print(key,source_frames,'source frames;',len(unique),'unique;',len(pages),'pages',flush=True)
    return key,meta

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--only');parser.add_argument('--workers',type=int,default=2);args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    records=json.loads((SOURCES/'sources.json').read_text())['files'];selected=[r for r in records if not args.only or f"{r['form']}-{r['id']}"in args.only.split(',')]
    for entry in selected:
        if hashlib.sha256((SOURCES/entry['file']).read_bytes()).hexdigest()!=entry['sha256']:raise ValueError('Source SHA mismatch: '+entry['file'])
    if any(not (Path('/tmp/mole-v31-xml')/r['form']/(r['id']+'.xml')).exists()for r in selected):
        subprocess.run(java('UploadedSwfExporter','xml',SOURCES/'raw','/tmp/mole-v31-xml'),check=True)
    by_hash={};aliases={}
    for r in selected:
        key=f"{r['form']}-{r['id']}"
        if r['sha256']in by_hash:aliases[key]=by_hash[r['sha256']]
        else:by_hash[r['sha256']]=r
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers)as pool:clips=dict(pool.map(run,by_hash.values()))
    for key,record in aliases.items():clips[key]=clips[f"{record['form']}-{record['id']}"]
    if not args.only:
        (OUT/'clips.json').write_text(json.dumps(clips,separators=(',',':'))+'\n')
        index={key:{**{k:c[k]for k in ['form','frames','durationMs','width','height','registration']},'id':key.split('-',1)[1],'assetKey':c['form']+'-'+c['id']}for key,c in clips.items()}
        (OUT/'index.json').write_text(json.dumps(index,separators=(',',':'))+'\n')
    print('Packed',len(clips),'supplied clips,',sum(c['frames']for c in clips.values()),'source time frames',flush=True)

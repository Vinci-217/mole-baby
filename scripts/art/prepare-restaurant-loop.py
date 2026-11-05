#!/usr/bin/env python3
"""Export original room/food/worker layers with the client's real colour transform."""
import concurrent.futures,json,subprocess,xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'artifacts/restaurant-loop';VAULT=ROOT/'local-assets';JAR='/opt/jpexs/26.4.0/ffdec-cli.jar';CP=f'{VAULT}/tools:/opt/jpexs/26.4.0/lib/*'
OUT.mkdir(parents=True,exist_ok=True)
def command(args):return subprocess.check_output(args,stderr=subprocess.STDOUT,timeout=90).decode()
def java(*args):return command(['java','-Xmx400m','-Djava.awt.headless=true','-jar',JAR,*map(str,args)])
def prepare_actor(sid,parent,body_ids,directions):
    xml=OUT/f'{sid}-source.xml'
    java('-swf2xml',VAULT/f'raw/root/resource/petcloth/swf2/{sid}.swf',xml)
    tree=E.parse(xml)
    # GF.setPetColor(ActionMC1,3), using GV.petColor_3 from ClientCommonDLL.
    # Apply at the original instance, keeping eyes and uniform on other layers.
    for place in tree.getroot().iter():
        if 'PlaceObject' not in place.get('type','') or place.get('characterId') not in body_ids:continue
        old=place.find('colorTransform')
        if old is not None:place.remove(old)
        place.set('placeFlagHasColorTransform','true')
        E.SubElement(place,'colorTransform',type='CXFORMWITHALPHA',hasAddTerms='true',hasMultTerms='true',nbits='10',redMultTerm='256',greenMultTerm='256',blueMultTerm='256',alphaMultTerm='256',redAddTerm='-215',greenAddTerm='-57',blueAddTerm='31',alphaAddTerm='0')
    adapted=OUT/f'{sid}-blue.xml';tree.write(adapted,encoding='utf-8',xml_declaration=True);swf=adapted.with_suffix('.swf');java('-xml2swf',adapted,swf)
    bounds=command(['java','-cp',CP,'SpriteProbe',str(swf),str(parent)]).strip().split('\t');bounds=list(map(int,bounds[1:]))
    results={}
    for direction,frame in directions.items():
        destination=OUT/'poses'/f'{sid}-{direction}'
        command(['java','-Xmx400m','-Djava.awt.headless=true','-cp',CP,'SourceExporter','nested',str(swf),str(destination),str(parent),str(frame),'15','4'])
        files=sorted(destination.rglob('*.png'),key=lambda p:int(p.stem))
        if len(files)!=15:raise ValueError(f'Incomplete original pose: {sid}/{direction}')
        results[direction]={'directory':str(files[0].parent),'boundsTwips':bounds,'zoom':4,'frames':15,'sourceFrame':frame,'sourceSprite':parent}
    return sid,results

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    actors=dict(pool.map(lambda args:prepare_actor(*args),[
        ('1200042',152,{'29','66','97','125','149'},{'rightdown':57}),
        ('1200043',150,{'29','64','95','123','147'},{'left':18,'leftup':25,'rightdown':57}),
    ]))
java('-swf2xml',VAULT/'raw/root/resource/oneBigStree/swf/1330004.swf',OUT/'room.xml')
command(['java','-Xmx400m','-Djava.awt.headless=true','-cp',CP,'SourceExporter','frames',str(VAULT/'raw/root/resource/restaurant/swf/1340002.swf'),str(OUT/'dish'),'71','5','1'])
room=E.parse(OUT/'room.xml');tags=room.getroot().find('tags')
for node in list(tags):
    if 'PlaceObject' in node.get('type','') and node.get('name') not in {'bg_mc','depth_mc','top_mc'}:tags.remove(node)
room_xml=OUT/'room-clean.xml';room.write(room_xml,encoding='utf-8',xml_declaration=True);room_swf=room_xml.with_suffix('.swf');java('-xml2swf',room_xml,room_swf)
java('-select','1','-export','frame',OUT/'room-clean',room_swf)
metadata={'actors':actors,'room':str(OUT/'room-clean/1.png'),'dish':str(next((OUT/'dish').rglob('*.png'))),'sourceFPS':24,'adaptation':'Original service-worker poses and original GV.petColor_3 instance transform; original restaurant 1330004 room layers, control/collision overlays omitted. Route, phase durations and demonstrative clearing of the served dish are local preview choreography, not an original full-game recording.'}
(OUT/'poses.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print('PASS: original directional matrices, body-only official colour transform, both uniform states, original restaurant layers and original dish exported.')

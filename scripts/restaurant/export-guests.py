#!/usr/bin/env python3
"""Bake the client's eatLamu2 body-instance colour transform, retaining all 16 frames."""
import subprocess,xml.etree.ElementTree as E
from pathlib import Path
root=Path(__file__).resolve().parents[2];base=root/'local-assets/research/restaurant-port';cp=f'{root}/local-assets/tools:/opt/jpexs/26.4.0/lib/*'
source=base/'restaurant.xml'
if not source.exists():subprocess.run(['java','-Xmx400m','-cp',cp,'SourceExporter','xml',str(root/'local-assets/raw/root/module/restaurant/restaurant.swf'),str(source)],check=True)
for color,offset in {'blue':[-215,-57,31],'pink':[51,-148,0],'red':[255,-199,-250],'yellow':[0,-21,-255]}.items():
 tree=E.parse(source)
 for n in tree.getroot().iter():
  if 'PlaceObject' not in n.get('type','')or n.get('name')!='body':continue
  old=n.find('colorTransform')
  if old is not None:n.remove(old)
  n.set('placeFlagHasColorTransform','true')
  E.SubElement(n,'colorTransform',type='CXFORMWITHALPHA',hasAddTerms='true',hasMultTerms='true',nbits='10',redMultTerm='256',greenMultTerm='256',blueMultTerm='256',alphaMultTerm='256',redAddTerm=str(offset[0]),greenAddTerm=str(offset[1]),blueAddTerm=str(offset[2]),alphaAddTerm='0')
 xml=base/f'eat-{color}.xml';tree.write(xml,encoding='utf-8',xml_declaration=True);swf=xml.with_suffix('.swf')
 for args in [['xml2swf',str(xml),str(swf)],['nested',str(swf),str(base/'guests'/color),'380','7','16','3']]:subprocess.run(['java','-Xmx400m','-Djava.awt.headless=true','-cp',cp,'SourceExporter',*args],check=True)

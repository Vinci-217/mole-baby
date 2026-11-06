#!/usr/bin/env python3
"""Recover the original purple book layer; never alter the archived SWF."""
from pathlib import Path
import hashlib,json,subprocess,xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'local-assets/raw/root/resource/petcloth/swf2/1200026.swf'
WORK=ROOT/'artifacts/original-reading-source'
JAR='/opt/jpexs/26.4.0/ffdec-cli.jar'
WORK.mkdir(parents=True,exist_ok=True)
def run(*args):
    subprocess.run(['java','-Xmx400m','-Djava.awt.headless=true',*map(str,args)],check=True,stdout=subprocess.DEVNULL,timeout=90)
run('-jar',JAR,'-swf2xml',SOURCE,WORK/'source.xml')
tree=E.parse(WORK/'source.xml')
book=next(n for n in tree.getroot().find('tags') if n.get('spriteId')=='13')
# Sprite 13 is the original front book. Its depth 1 is a grey rig/shadow
# placeholder, not a page. Keep every original page placement and matrix.
for tag in list(book.find('subTags')):
    if tag.get('depth')=='1' and tag.get('type','').startswith(('PlaceObject','RemoveObject')):
        book.find('subTags').remove(tag)
tree.write(WORK/'reading.xml',encoding='utf-8',xml_declaration=True)
run('-jar',JAR,'-xml2swf',WORK/'reading.xml',WORK/'reading.swf')
run('-cp',f'{ROOT}/local-assets/tools:/opt/jpexs/26.4.0/lib/*','SourceExporter','frames',WORK/'reading.swf',WORK/'original-pages','13','-1','6')
(WORK/'source.json').write_text(json.dumps({'source':'root/resource/petcloth/swf2/1200026.swf','sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceSprite':13,'sourceFrames':15,'fps':24,'adaptation':'Only the grey depth-1 registration placeholder is removed. Original page vectors, purple cover, colours, placement matrices and all 15 frames retained. Opening, reading cadence and page-turn timing in the app are local adaptation, not a recovered official read action.'},indent=2)+'\n')
print('Exported all 15 original purple-book frames without rig placeholders.')

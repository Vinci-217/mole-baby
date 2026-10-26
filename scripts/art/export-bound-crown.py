"""Export the original middle crown alone, keeping the original sprite bounds.
Hide the body placement without removing it: FFDec still uses its dimensions.
Requires the reference XML produced by prepare-original-actions.py.
"""
import argparse,subprocess
from pathlib import Path
import xml.etree.ElementTree as E

p=argparse.ArgumentParser()
p.add_argument('--reference',type=Path,required=True)
p.add_argument('--ffdec',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
tree=E.parse(a.reference);hidden=0
for sprite in tree.getroot().find('tags'):
 if sprite.get('spriteId') not in ['958','978','980']:continue
 for child in sprite.find('subTags'):
  if not child.get('type','').startswith('Place') or child.get('depth')!='3':continue
  child.set('placeFlagHasColorTransform','true')
  old=child.find('colorTransform')
  if old is not None:child.remove(old)
  E.SubElement(child,'colorTransform',type='CXFORMWITHALPHA',hasAddTerms='false',hasMultTerms='true',nbits='10',redMultTerm='256',greenMultTerm='256',blueMultTerm='256',alphaMultTerm='0',redAddTerm='0',greenAddTerm='0',blueAddTerm='0',alphaAddTerm='0')
  hidden+=1
assert hidden>0,'Expected original middle body placements'
xml=a.output/'leaf.xml';swf=a.output/'leaf.swf';tree.write(xml,encoding='utf-8',xml_declaration=True)
java=['java','-Xmx1g','-Djava.awt.headless=true','-jar',str(a.ffdec)]
with (a.output/'export.log').open('w') as log:
 subprocess.run(java+['-xml2swf',str(xml),str(swf)],check=True,stdout=log,stderr=log)
 subprocess.run(java+['-selectid','1532','-zoom','12','-ignorebackground','-export','sprite',str(a.output/'leaves'),str(swf)],check=True,stdout=log,stderr=log)
print('Exported original crown with body invisible and full source bounds')

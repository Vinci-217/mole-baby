"""Distinguish labelled empty placeholders from actual wearable timelines.

Read-only SWF structure inspection. Some old petcloth files label all growth
stages but explicitly remove their only character at the middle/high labels.
"""
import struct,zlib

def playable_outfit_forms(path,symbol):
 data=path.read_bytes();body=zlib.decompress(data[8:]) if data[:3]==b'CWS' else data[8:]
 header=(5+4*(body[0]>>3)+7)//8+4
 sprites={};symbols={};art=set();labels={}
 def tags(content,start=0):
  while start+2<=len(content):
   word=struct.unpack_from('<H',content,start)[0];start+=2
   code,length=word>>6,word&63
   if length==63:length=struct.unpack_from('<I',content,start)[0];start+=4
   yield code,content[start:start+length];start+=length
   if code==0:break
 def visit(content):
  for code,value in tags(content):
   if code==39:
    ident=struct.unpack_from('<H',value)[0];sprites[ident]=list(tags(value,4));visit(value[4:])
   elif code==76:
    cursor=2
    for _ in range(struct.unpack_from('<H',value)[0]):
     ident=struct.unpack_from('<H',value,cursor)[0];cursor+=2;end=value.index(0,cursor)
     symbols[value[cursor:end].decode('utf8')]=ident;cursor=end+1
   elif code in (2,22,32,83,6,20,21,35,36,90):art.add(struct.unpack_from('<H',value)[0])
 visit(body[header:])
 def contains_art(ident,seen=None):
  if ident in art:return True
  seen=set() if seen is None else seen
  if ident in seen:return False
  seen.add(ident)
  return any(contains_art(child,seen) for code,value in sprites.get(ident,[]) if (child:=placed(code,value)) is not None)
 def placed(code,value):
  if code==4:return struct.unpack_from('<H',value)[0]
  if code==26 and value[0]&2:return struct.unpack_from('<H',value,3)[0]
  if code==70 and value[0]&2:
   cursor=4
   if value[1]&8 or value[1]&16:cursor=value.index(0,cursor)+1
   return struct.unpack_from('<H',value,cursor)[0]
  return None
 main=sprites.get(symbols.get(symbol),[]);active={};result=[]
 for code,value in main:
  child=placed(code,value)
  if child is not None:
   depth=struct.unpack_from('<H',value,2 if code==4 else 1 if code==26 else 2)[0];active[depth]=child
  if code in (5,28):active.pop(struct.unpack_from('<H',value,2 if code==5 else 0)[0],None)
  if code==43:labels[value.split(b'\0')[0].decode('utf8')]=None
  if code==1:
   for label in labels:
    if label.startswith('level') and any(contains_art(ident) for ident in active.values()):result.append(label)
   labels.clear()
 return result

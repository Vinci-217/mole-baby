"""Add the original classic-super football timeline to the existing runtime.
Original body, eyes, leaves and ball share each frame's camera transform.
"""
import ast,copy,json,argparse,subprocess,xml.etree.ElementTree as E
from pathlib import Path
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--xml',type=Path,required=True);p.add_argument('--ffdec',required=True);p.add_argument('--work',type=Path,required=True);a=p.parse_args();a.work.mkdir(parents=True,exist_ok=True);root=Path(__file__).resolve().parents[2]
source=ast.parse((root/'scripts/art/export-registered-outfits.py').read_text());exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in ['matrix','bounds','union','Timeline']],type_ignores=[]),'<timeline>','exec'))
tl=Timeline(a.xml);tree=E.parse(a.xml);tags=tree.getroot().find('tags');ns={n.get('spriteId') or n.get('shapeId'):n for n in tags if n.get('spriteId') or n.get('shapeId')};body=union(bounds(tl.ns[s],m) for s,m in tl.action('2525','football',1,'body')[0]);scale=88*20/(body[2]-body[0]);master=ns['2525'];master.remove(master.find('subTags'));sub=E.SubElement(master,'subTags');allparts=[];near=[];contacts=[]
for i in range(148):
 pb=union(bounds(tl.ns[s],m) for s,m in tl.action('2525','football',i+1,'body')[0])
 if pb is None:break # Final source frame clears the display list.
 camera=np.array([[scale,0,160*20-scale*(pb[0]+pb[2])/2],[0,scale,297*20-scale*pb[3]],[0,0,1.]])
 parts,_=tl.action('2525','football',i+1,'all');parts=[(sid,camera@m) for sid,m in parts if sid!='41'];allparts+=parts
 bb=union(bounds(tl.ns[s],m) for s,m in parts if {(255,255,255),(0,0,0)}<={tuple(int(c.get(k,0)) for k in ['red','green','blue'])for c in tl.ns[s].iter('color')})
 bodyworld=[116*20,220*20,204*20,297*20];close=bool(bb and max(0,bodyworld[0]-bb[2],bb[0]-bodyworld[2])+max(0,bodyworld[1]-bb[3],bb[1]-bodyworld[3])<88*20*.3);near.append(close)
 if close and (not contacts or i+1-contacts[-1]>18):contacts.append(i+1)
 for depth in range(1,100):E.SubElement(sub,'item',type='RemoveObject2Tag',depth=str(depth),forceWriteAsLong='false')
 for depth,(sid,m) in enumerate(parts,1):
  n=E.SubElement(sub,'item',type='PlaceObject2Tag',characterId=sid,depth=str(depth),forceWriteAsLong='false',placeFlagHasCharacter='true',placeFlagHasMatrix='true',placeFlagMove='false',placeFlagHasColorTransform='false',placeFlagHasClipActions='false',placeFlagHasClipDepth='false',placeFlagHasName='false',placeFlagHasRatio='false')
  E.SubElement(n,'matrix',type='MATRIX',hasRotate='true',hasScale='true',nRotateBits='31',nScaleBits='31',nTranslateBits='31',scaleX=str(m[0,0]),scaleY=str(m[1,1]),rotateSkew0=str(m[1,0]),rotateSkew1=str(m[0,1]),translateX=str(round(m[0,2])),translateY=str(round(m[1,2])))
 E.SubElement(sub,'item',type='ShowFrameTag',forceWriteAsLong='false')
count=len(near);master.set('frameCount',str(count));box=union(bounds(tl.ns[s],m)for s,m in allparts)
for probe in [False,True]:
 r=copy.deepcopy(tree)
 if probe:
  for n in r.getroot().find('tags'):
   if not n.get('type','').startswith('DefineShape'):continue
   colors={tuple(int(c.get(k,0))for k in ['red','green','blue'])for c in n.iter('color')}
   if not {(255,255,255),(204,204,204)}<=colors or not colors<={(255,255,255),(204,204,204),(153,153,153)}:continue
   for c in n.iter('color'):
    v={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}[tuple(int(c.get(k,0))for k in ['red','green','blue'])]
    for k,x in zip(['red','green','blue'],v):c.set(k,str(x))
 name='probe'if probe else'neutral';xml=a.work/(name+'.xml');swf=a.work/(name+'.swf');r.write(xml,encoding='utf-8',xml_declaration=True)
 with (a.work/(name+'.log')).open('w')as log:
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-xml2swf',str(xml),str(swf)],stdout=log,stderr=log,check=True)
  subprocess.run(['java','-Xmx1g','-Djava.awt.headless=true','-jar',a.ffdec,'-selectid','2525','-zoom','1','-ignorebackground','-export','sprite',str(a.work/name),str(swf)],stdout=log,stderr=log,check=True)
 print(name,'exported',flush=True)
nd=next((a.work/'neutral').glob('DefineSprite_2525_*'));pd=next((a.work/'probe').glob('DefineSprite_2525_*'));atlas=[Image.new('RGBA',(160*8,192*19))for _ in range(2)]
for i in range(count):
 n=Image.open(nd/f'{i+1}.png').convert('RGBA');pr=Image.open(pd/f'{i+1}.png').convert('RGBA');pixels=np.array(n);d=pixels[:,:,:3].astype(float)-np.array(pr)[:,:,:3].astype(float);g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);dark=np.clip((d[:,:,2]+51*g)/153,0,1);w=np.clip((d[:,:,1]+51*g+102*dark)/255,0,1);mask=Image.fromarray(np.dstack([w*255,g*255,dark*255,pixels[:,:,3]]).round().astype('uint8'))
 for part,im in enumerate([n,mask]):
  frame=Image.new('RGBA',(320,384));frame.alpha_composite(im,(int(np.floor(box[0]/20)),int(np.floor(box[1]/20))));atlas[part].paste(frame.resize((160,192),Image.Resampling.LANCZOS),(i%8*160,i//8*192))
folder=root/'public/assets/original/football'
for part,kind in enumerate(['neutral','mask']):atlas[part].save(folder/f'classic-{kind}.png',optimize=True)
p=folder/'runtime.json';j=json.loads(p.read_text());j['forms']['classic']={'sourceSprite':2525,'sourceAction':'football','sourceClip':'2260','frameCount':count,'uniqueFrames':count,'rows':19,'frameMap':list(range(count)),'contacts':contacts,'nearBallFrames':near,'reducedFrame':58};p.write_text(json.dumps(j,separators=(',',':'))+'\n');print('contacts',contacts)

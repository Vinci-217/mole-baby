#!/usr/bin/env python3
"""Review assets only. Original SWF vector shapes -> transparent PNG frames.

Read Timeline_315.frame9 gotoAndPlay(3): keep exact source frames 3..8,
including their holds and complete body/crown depth order. No polar tween,
no presumed physical-blade identities, no whole-crown bitmap rotation.
Throw trajectories and velocity-sensitive playback are desktop adaptations.
"""
import argparse, ast, base64, copy, hashlib, io, json, math, subprocess, sys
from pathlib import Path
import xml.etree.ElementTree as E
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/previews/rotor-throw'
FPS=30
FORMS=['seed','junior','middle','senior','classic','super','water','wood','fire']
NAMES=dict(zip(FORMS,['种子','初级','中级 · 双叶','高级 · 风扇叶','经典三叶超拉','神力超级拉姆','水系神力拉姆','木系神力拉姆','火系神力拉姆']))
SOURCE_SHA='01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf'
SOURCE_URL='https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/NPC/lamubone.swf'
W,H=192,208
ROTOR_COLUMNS=6

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def export_senior(exporter,work):
    raw=ROOT/'research/references/original-flight/lamubone.swf'
    assert sha(raw)==SOURCE_SHA
    xml=work/'original.xml'
    if not xml.exists(): subprocess.run([exporter,'xml',str(raw),str(xml)],check=True,stdout=subprocess.DEVNULL)
    # Reuse reviewed SWF Move/HasCharacter handling. No app assets are changed.
    source=ast.parse((ROOT/'scripts/art/export-registered-outfits.py').read_text())
    scope={'E':E,'np':np,'copy':copy,'re':__import__('re')}
    exec(compile(ast.Module(body=[n for n in source.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))and n.name in ['Timeline','matrix','bounds','union']],type_ignores=[]),'<timeline>', 'exec'),scope)
    class OrderedTimeline(scope['Timeline']):
        # SWF depth, not insertion order: f5 removes depth7 then inserts
        # depth4. Dictionary insertion order paints that pupil over depth5.
        def active(self,sid,age):
            return sorted(super().active(sid,age),key=lambda item:int(item[0].get('depth','0')))
    tl=OrderedTimeline(xml);bounds=scope['bounds'];union=scope['union']
    tree=E.parse(xml);tags=tree.getroot().find('tags');master=next(n for n in tags if n.get('spriteId')=='1777')
    spec=json.loads((ROOT/'public/assets/original/flight/runtime.json').read_text())['forms']['senior']
    reg=spec['registration'];target=reg['bodyTarget'];b=reg['sourceBodyBounds'];scale=reg['scale']
    registration=np.array([[scale,0,(target[0]+target[2])*10-scale*(b[0]+b[2])/2],[0,scale,target[3]*20-scale*b[3]],[0,0,1.]])
    as_dir=ROOT/'research/references/original-flight/frame-scripts'
    as_dir.mkdir(exist_ok=True)
    subprocess.run([exporter,'scripts',str(raw),str(as_dir),'.*(timeline_315|timeline_314).*'],check=True,stdout=subprocess.DEVNULL)
    for script in as_dir.rglob('*.as'):
        # Normalise decompiler whitespace only; preserve all AS statements.
        script.write_text('\n'.join(line.rstrip()for line in script.read_text().splitlines()).rstrip()+'\n')
    leaf_script=(as_dir/'lamubone_fla/Timeline_315.as').read_text()
    assert 'addFrameScript(0,frame1,8,frame9)'in leaf_script and 'gotoAndPlay(3)'in leaf_script
    assert 'gotoAndPlay(3)'in(as_dir/'lamubone_fla/Timeline_314.as').read_text()
    entries=[];clips={};proof=[]
    for direction in ['down','left','right']:
        frames=[]
        for source_frame in range(3,9):
            parts=[(sid,registration@m)for sid,m in tl.action('1777',direction,source_frame,'all')[0]if sid!='41']
            frames.append(len(entries));entries.append(parts)
            proof.append({'direction':direction,'sourceFrame':source_frame,'wholeCrownRotation':False,'interpolation':False})
        clips[direction]={'indices':frames,'sourceFrames':list(range(3,9)),'fps':24,'periodSeconds':.25}
    originals=clips['down']['indices']
    sub=master.find('subTags');master.remove(sub);sub=E.SubElement(master,'subTags');master.set('frameCount',str(len(entries)))
    for parts in entries:
        for depth in range(1,40): E.SubElement(sub,'item',type='RemoveObject2Tag',depth=str(depth))
        for depth,(sid,m)in enumerate(parts,1):
            n=E.SubElement(sub,'item',type='PlaceObject2Tag',characterId=sid,depth=str(depth),placeFlagHasCharacter='true',placeFlagHasMatrix='true',placeFlagMove='false')
            E.SubElement(n,'matrix',type='MATRIX',hasRotate='true',hasScale='true',scaleX=str(m[0,0]),scaleY=str(m[1,1]),rotateSkew0=str(m[1,0]),rotateSkew1=str(m[0,1]),translateX=str(round(m[0,2])),translateY=str(round(m[1,2])))
        E.SubElement(sub,'item',type='ShowFrameTag')
    box=union(bounds(tl.ns[sid],m)for parts in entries for sid,m in parts)
    atlas=[]
    for probe in [False,True]:
        r=copy.deepcopy(tree)
        if probe:
            for n in r.getroot().find('tags'):
                if not n.get('type','').startswith('DefineShape'):continue
                colors={tuple(int(c.get(k,0))for k in ['red','green','blue'])for c in n.iter('color')}
                if not {(255,255,255),(204,204,204)}<=colors or not colors<={(255,255,255),(204,204,204),(153,153,153)}:continue
                for c in n.iter('color'):
                    rgb={(255,255,255):(255,0,255),(204,204,204):(0,255,255),(153,153,153):(255,255,0)}[tuple(int(c.get(k,0))for k in ['red','green','blue'])]
                    for k,v in zip(['red','green','blue'],rgb):c.set(k,str(v))
        name='senior-'+('probe'if probe else'neutral');target_xml=work/(name+'.xml');target_swf=work/(name+'.swf');folder=work/name
        r.write(target_xml,encoding='utf-8',xml_declaration=True)
        subprocess.run([exporter,'xml2swf',str(target_xml),str(target_swf)],check=True,stdout=subprocess.DEVNULL)
        subprocess.run([exporter,'frames',str(target_swf),str(folder),'1777','-1','2'],check=True,stdout=subprocess.DEVNULL)
        paths=sorted(folder.rglob('*.png'),key=lambda p:int(p.stem))
        # Use a new work directory for changed exports, never stale frames.
        assert len(paths)==len(entries)
        frames=[]
        for path in paths:
            im=Image.new('RGBA',(384,416));im.alpha_composite(Image.open(path).convert('RGBA'),(math.floor(box[0]/10),math.floor(box[1]/10)))
            frames.append(im.resize((W,H),Image.Resampling.LANCZOS))
        atlas.append(frames)
    neutral,probe=atlas;mask=[]
    for n,q in zip(neutral,probe):
        a=np.asarray(n).astype(float);d=a[:,:,:3]-np.asarray(q)[:,:,:3].astype(float)
        g=np.clip((d[:,:,0]+2*d[:,:,2]/3)/170,0,1);dark=np.clip((d[:,:,2]+51*g)/153,0,1);white=np.clip((d[:,:,1]+51*g+102*dark)/255,0,1)
        mask.append(Image.fromarray(np.dstack([white*255,g*255,dark*255,a[:,:,3]]).round().astype('uint8')))
    for kind,images in [('neutral',neutral),('mask',mask)]:
        sheet=Image.new('RGBA',(ROTOR_COLUMNS*W,math.ceil(len(images)/ROTOR_COLUMNS)*H))
        for i,im in enumerate(images):sheet.paste(im,(i%ROTOR_COLUMNS*W,i//ROTOR_COLUMNS*H))
        sheet.save(OUT/f'senior-{kind}.png',optimize=True)
    meta={'sourceUrl':SOURCE_URL,'sourceSha256':SOURCE_SHA,'sourceSprite':1777,'crownSprite':1538,'sourceLeafKeyFrames':[3,5,7],
          'sourceVisibleLoopFrames':6,'loopSourceFrames':list(range(3,9)),'sourceFps':24,'uniqueSourceCrownKeys':3,'body':'complete original body and crown in each source frame, sorted by SWF depth',
          'frameScript':{'class':'lamubone_fla.Timeline_315','frame1':'stop(); dispatch petBone2','frame9':'gotoAndPlay(3)','file':'research/references/original-flight/frame-scripts/lamubone_fla/Timeline_315.as','sha256':sha(as_dir/'lamubone_fla/Timeline_315.as')},
          'method':'Exact complete source loop frames 3..8 after applying original frame9 gotoAndPlay(3). No blade interpolation. Velocity-sensitive playback is a desktop adaptation.',
          'cell':[W,H],'columns':ROTOR_COLUMNS,'clips':clips,'exactOriginalIndices':originals,'frames':len(entries),
          'excludedSourceShapes':[41],'excludedSourceReason':'Original ground shadow is not part of the floating desktop character.',
          'candidatePhaseProof':proof,'files':{f'senior-{kind}.png':sha(OUT/f'senior-{kind}.png')for kind in ['neutral','mask']}}
    (OUT/'rotor-source.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print('PASS exported 18 complete original frames: 3 directions x source loop 3..8, no interpolation',flush=True)

def verify_direct_reference(exporter,work):
    """Independent raster path: render the original nested SWF directly,
    without our flattening/sorting code, then match all three distinct poses.
    JPEXS does not execute AS3; the loop selection comes from the verified AS.
    """
    folder=work/'direct-source';raw=ROOT/'research/references/original-flight/lamubone.swf'
    subprocess.run([exporter,'nested',str(raw),str(folder),'1777','6','9','2'],check=True,stdout=subprocess.DEVNULL)
    source={int(p.stem):Image.open(p).convert('RGBA')for p in folder.rglob('*.png')}
    assert len(source)==9
    meta=json.loads((OUT/'rotor-source.json').read_text());atlas=Image.open(OUT/'senior-neutral.png').convert('RGBA')
    reg=json.loads((ROOT/'public/assets/original/flight/runtime.json').read_text())['forms']['senior']['registration']
    scale=reg['scale']/2;target=reg['bodyTarget'];frames=[3,5,7]
    def green(im):
        a=np.asarray(im).astype(float)
        return(a[:,:,1]>a[:,:,0]*1.2)&(a[:,:,1]>a[:,:,2]*1.2)&(a[:,:,3]>110)
    candidate=[green(cell(atlas,i,columns=meta['columns']))for i in [0,2,4]]
    a=np.array(source[3]);body=(a[:,:,0]==a[:,:,1])&(a[:,:,1]==a[:,:,2])&(a[:,:,0]>=153)&(a[:,:,3]>200)
    ys,xs=np.where(body)
    tx=(target[0]+target[2])/2-(xs.min()+xs.max()+1)/2*scale;ty=target[3]-(ys.max()+1)*scale
    def fit(im,x,y):return im.transform((192,208),Image.Transform.AFFINE,(1/scale,0,-x/scale,0,1/scale,-y/scale),Image.Resampling.BICUBIC)
    best=(-1,None)
    # Fit one translation using only frame3. Reuse it unchanged for f4..8.
    for dx in np.arange(-3,3.01,.5):
        for dy in np.arange(-3,3.01,.5):
            g=green(fit(source[3],tx+dx,ty+dy));iou=float((g&candidate[0]).sum()/(g|candidate[0]).sum())
            if iou>best[0]:best=(iou,(float(tx+dx),float(ty+dy)))
    tx,ty=best[1];references=[green(fit(source[f],tx,ty))for f in frames]
    scores=[[float((a&b).sum()/(a|b).sum())for b in references]for a in candidate]
    assert np.argmax(scores,axis=1).tolist()==[0,1,2],'Candidate pose order disagrees with direct original renderer'
    assert all(scores[i][i]>.94 for i in range(3)),'Source leaf shape no longer matches direct original rendering'
    strip=Image.new('RGBA',(192*6,208))
    for i,f in enumerate(range(3,9)):strip.alpha_composite(fit(source[f],tx,ty),(i*192,0))
    strip.save(OUT/'direct-source-reference.png',optimize=True)
    receipt={'sourceSha256':SOURCE_SHA,'sourceExporterJavaSha256':sha(ROOT/'scripts/art/SourceExporter.java'),
             'method':'Direct original SWF nested-frame JPEXS render; no candidate flattening. Frame script determines 3..8 loop; JPEXS does not execute AS3.',
             'sprite':1777,'rootFrameZeroBased':6,'exportedFrames':9,'comparedDistinctSourceFrames':frames,
             'oneFixedRegistration':{'scale':scale,'x':tx,'y':ty},'candidateRowsVsDirectSourceColumnsIoU':scores,
             'correspondence':[3,5,7],'allDiagonalIoUAbove094':True,'originalFlashClientExecuted':False}
    (OUT/'direct-source-check.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('PASS direct original nested render matches ordered candidate poses 3/5/7, all leaf IoU > .94',flush=True)

def tint(neutral,mask,color='red'):
    offsets={'red':[255,-199,-250],'yellow':[0,-21,-255],'blue':[-215,-57,31],'pink':[51,-148,0],'white':[0,0,0]}[color]
    n=np.array(neutral).astype(float);m=np.asarray(mask).astype(float)/255
    deltas=np.array([np.clip(base+np.array(offsets),0,255)-base for base in [255,204,153]])
    n[:,:,:3]+=m[:,:,:3]@deltas
    return Image.fromarray(np.clip(n,0,255).round().astype('uint8'))

def cell(sheet,index,w=W,h=H,columns=8):return sheet.crop((index%columns*w,index//columns*h,index%columns*w+w,index//columns*h+h))
def body_bounds(mask):
    m=np.array(mask);ys,xs=np.where((m[:,:,:3].sum(2)>90)&(m[:,:,3]>100))
    return [int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]

def make_interactive(neutral,mask,meta):
    """Standalone offline preview: no install, network requests or app saves."""
    png=io.BytesIO();tint(neutral,mask).save(png,format='PNG',optimize=True)
    controller=(ROOT/'scripts/previews/source-rotor-motion.mjs').read_text().replace('export ','')
    inertia=(ROOT/'scripts/previews/throw-motion.mjs').read_text().split('\nif (process.argv[1]')[0].replace('export ','')
    html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>拉姆叶片 · 手速预览</title>
<style>html{background:#f6f3ea;color:#76583b;font:16px/1.7 "Microsoft YaHei",sans-serif}body{max-width:940px;margin:30px auto;padding:0 16px}h1{font-size:24px}canvas{display:block;width:100%;height:auto;background:#fffdf7;border:1px solid #e5d5b3;border-radius:18px;touch-action:none;cursor:grab}canvas:active{cursor:grabbing}button{font:inherit;color:inherit;background:#fff4ce;border:1px solid #ddc389;border-radius:12px;padding:5px 18px;cursor:pointer}p{margin:12px 0}small{color:#93795c}</style>
<h1>拉姆叶片 · 真实鼠标拖拽预览</h1>
<p>抓住拉姆左右拖动：滑得快，叶片转得快；停手或松手后逐渐降速。松手也会有短距离惯性。</p>
<canvas id="preview" width="900" height="330" aria-label="可拖拽的高级拉姆动画预览"></canvas>
<p><button id="reset">放回中间</button> <span id="state">正在准备原帧…</span></p>
<small>仅供动作确认：原 SWF 循环 3→4→5→6→7→8；未接入正式桌面窗口，不改存档、不联网。</small>
<script>(()=>{__CONTROLLER__
__INERTIA__
const spec=__META__,image=new Image(),canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),status=document.querySelector('#state');
let rotor=createSourceRotor(),position={x:450,y:190},held=false,last=0,samples=[],grip=null,coast=null,ready=false,painted=sampleSourceRotor(rotor);
const media=matchMedia('(prefers-reduced-motion: reduce)');
function point(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*900/b.width,y:(e.clientY-b.top)*330/b.height,at:performance.now()}}
function record(p){samples.push(p);samples=samples.filter(s=>s.at>=p.at-120)}
canvas.addEventListener('pointerdown',e=>{if(!ready||e.button!==0)return;const p=point(e);if(Math.abs(p.x-position.x)>60||Math.abs(p.y-position.y)>65)return;e.preventDefault();held=true;coast=null;samples=[];record(p);grip={x:p.x-position.x,y:p.y-position.y};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!held)return;const p=point(e);record(p);position={x:Math.max(52,Math.min(848,p.x-grip.x)),y:Math.max(70,Math.min(265,p.y-grip.y))}});
function release(e,cancel=false){if(!held)return;if(e&&!cancel)record(point(e));const now=performance.now();const velocity=cancel?{x:0,y:0}:releaseVelocity(samples,now,'senior');held=false;coast={origin:{...position},velocity,at:now};if(e&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)}
canvas.addEventListener('pointerup',e=>release(e));canvas.addEventListener('pointercancel',e=>release(e,true));canvas.addEventListener('lostpointercapture',e=>release(e,true));window.addEventListener('blur',()=>release(null,true));
document.querySelector('button').onclick=()=>{held=false;coast=null;samples=[];position={x:450,y:190};rotor=createSourceRotor()};
function paint(now){let speed=0,vx=0;
 if(held){const v=releaseVelocity(samples,now,'senior');speed=Math.hypot(v.x,v.y);vx=v.x}
 else if(coast){const p=sampleThrow('senior',coast.origin,coast.velocity,(now-coast.at)/1000,{left:52,right:848,top:70,bottom:265},media.matches);position={x:p.x,y:p.y};speed=Math.hypot(p.vx,p.vy);vx=p.vx;if(p.done)coast=null}
 painted=stepSourceRotor(rotor,last?now-last:0,speed,media.matches);last=now;
 const direction=vx>35?'right':vx<-35?'left':'down',index=spec.clips[direction].indices[painted.index];ctx.clearRect(0,0,900,330);
 ctx.drawImage(image,index%spec.columns*192,Math.floor(index/spec.columns)*208,192,208,position.x-50,position.y-54,100,108);
 status.textContent=(held?'正在拖动':coast?'松手滑行':'安静慢转')+' · '+painted.rate.toFixed(2)+'× · 原帧 '+painted.sourceFrame;
 requestAnimationFrame(paint);
}
window.rotorReview={getState:()=>({ready,held,phase:rotor.phase,rate:rotor.rate,sourceFrame:painted.sourceFrame,position:{...position}})};
image.onload=()=>{ready=true;requestAnimationFrame(paint)};image.src='data:image/png;base64,__IMAGE__';
})();</script></html>'''
    html=html.replace('__CONTROLLER__',controller).replace('__INERTIA__',inertia).replace('__META__',json.dumps(meta,separators=(',',':'))).replace('__IMAGE__',base64.b64encode(png.getvalue()).decode())
    (OUT/'interactive.html').write_text(html)

def make_previews(work):
    OUT.mkdir(parents=True,exist_ok=True)
    font_path=Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
    if not font_path.exists():font_path=Path(subprocess.check_output(['fc-match','-f','%{file}','sans:lang=zh'],text=True))
    def font(size):return ImageFont.truetype(str(font_path),size)
    f18,f14,f12=font(18),font(14),font(12)
    def label(im,text,xy,size=f14,color='#76583b',anchor='mm'):ImageDraw.Draw(im).text(xy,text,font=size,fill=color,anchor=anchor)
    def read_pair(folder,form,color='red'):
        n=Image.open(ROOT/f'public/assets/{folder}/{form}-neutral.png').convert('RGBA');m=Image.open(ROOT/f'public/assets/{folder}/{form}-mask.png').convert('RGBA')
        return tint(n,m,color),m
    rotor=json.loads((OUT/'rotor-source.json').read_text());rn=Image.open(OUT/'senior-neutral.png').convert('RGBA');rm=Image.open(OUT/'senior-mask.png').convert('RGBA');rotors={c:tint(rn,rm,c)for c in ['red','yellow','blue','pink']}
    flight=json.loads((ROOT/'public/assets/original/flight/runtime.json').read_text())
    drag=json.loads((ROOT/'public/assets/original/drag/runtime.json').read_text())
    sheets={};masks={}
    for form in ['junior','middle']:sheets[form],masks[form]=read_pair('original/drag',form)
    for form in ['classic','super']:sheets[form],masks[form]=read_pair('original/flight',form)
    for form in ['water','wood','fire']:sheets[form],masks[form]=read_pair('classic',form)
    elemental={form:{direction:[row*8+i for i in range(8)if np.array(cell(masks[form],row*8+i))[:,:,:3].sum()>10000]
                      for direction,row in [('down',0),('right',1),('left',2)]}for form in ['water','wood','fire']}
    assert all(indices for directions in elemental.values()for indices in directions.values())
    seedbody=Image.open(ROOT/'public/assets/original/seed/body.png').convert('RGBA');seedmask=Image.open(ROOT/'public/assets/original/seed/body-mask.png').convert('RGBA')
    seedbody=tint(seedbody,seedmask)
    # The original PNG is 154x133; source registration places it at 119x103.
    # Pasting it at its file resolution would crop the bottom of the pot.
    pot=Image.open(ROOT/'public/assets/original/seed/pot.png').convert('RGBA').resize((119,103),Image.Resampling.LANCZOS)
    # Normalised stage scale is the existing app proportion layer. One fixed
    # size per form; never fit individual frames to their changing outer boxes.
    sizes={'seed':.9,'junior':.82,'middle':.94,'senior':1,'classic':1,'super':1,'water':1,'wood':1,'fire':1}
    def pose(form,t,motion=None,direction=None,color='red'):
        direction=direction or ('right'if motion and motion['vx']>18 else'left'if motion and motion['vx']<-18 else'down')
        moving=motion and(motion['held']or motion['phase'].startswith('release'))
        if form=='seed':
            canvas=Image.new('RGBA',(W,H));canvas.alpha_composite(pot,(36,95))
            seedindex=0
            # The original upright source stem sways while held; the pot and
            # body always travel together after a release, with no auto-walk.
            canvas.alpha_composite(cell(seedbody,seedindex,96,99),(51,36));return canvas,[36,36,155,198]
        if form=='senior':
            phase=motion.get('rotor')if motion else None
            if phase is None and motion:
                phase=rotor_traces[30]['frames'][min(round(t*30),len(rotor_traces[30]['frames'])-1)]['rotor']
            frame=phase['index']if phase else int(t*24)%6
            index=rotor['clips'][direction]['indices'][frame]
            return cell(rotors[color],index,columns=rotor['columns']),body_bounds(cell(rm,index,columns=rotor['columns']))
        if form in ['junior','middle']:
            # Preserve the already accepted shared viscous body and bound
            # middle foliage. Never sample the hopping walk clip while held.
            direction=direction if moving else'down';clip=drag['forms'][form]['clips'][direction]
            phase=int(t*24)%clip['frameCount']if moving else 0;index=clip['frameMap'][phase]
            cw,ch=drag['forms'][form]['cell'];pic=cell(sheets[form],index,cw,ch)
            pic.info['sourceOrigin']=drag['forms'][form]['origin']
            return pic,drag['forms'][form]['poses'][index]['body']
        if form in ['classic','super']:
            clip=flight['forms'][form]['clips'][direction];entry=clip['frames'][int(t*24)%len(clip['frames'])]
            return cell(sheets[form],entry['index']),body_bounds(cell(masks[form],entry['index']))
        indices=elemental[form][direction];index=indices[int(t*24)%len(indices)]
        return cell(sheets[form],index),body_bounds(cell(masks[form],index))
    def sprite(im,form,x,base_y,t,motion):
        pic,bb=pose(form,t,motion);factor=sizes[form]/2
        if form=='middle':
            first=drag['forms'][form]['poses'][drag['forms'][form]['clips']['down']['frameMap'][0]]
            factor*=(first['wearBody'][2]-first['wearBody'][0])/(first['body'][2]-first['body'][0])
        # Align the held source body's baseline to eliminate the original
        # walk-cycle lift, especially on the two young forms.
        canonical=pose(form,0,None,'down')[1]
        offset=(canonical[3]-bb[3])if form in ['junior','middle']else 0
        # Middle cells deliberately extend left/up beyond the nominal body
        # canvas. Preserve their signed origin and complete foliage.
        ox,oy=pic.info.get('sourceOrigin',(0,0))
        layer=Image.new('RGBA',(384,416));layer.alpha_composite(pic,(96+ox,104+oy+offset))
        angle=0 if form in ['junior','middle']else-motion['tilt']
        layer=layer.rotate(angle,resample=Image.Resampling.BICUBIC,center=(192,228))
        layer=layer.resize((round(384*factor),round(416*factor)),Image.Resampling.LANCZOS)
        py=base_y-(104+canonical[3])*factor
        im.alpha_composite(layer,(round(x-192*factor),round(py)))
        return py,bb
    traces=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/previews/throw-motion.mjs')],text=True))
    rotor_traces={fps:json.loads(subprocess.check_output(['node',str(ROOT/'scripts/previews/record-rotor-traces.mjs'),str(fps)],text=True))for fps in [30,50]}
    def encode(name,frames,fps=FPS):
        dest=work/(name+'-frames');dest.mkdir(exist_ok=True)
        for i,im in enumerate(frames):im.convert('RGB').save(dest/f'{i:04}.png')
        target=OUT/(name+'.gif')
        subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(fps),'-i',str(dest/'%04d.png'),'-filter_complex','split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',str(target)],check=True)
        # GIF timing is quantised to 10ms. Verify actual encoded duration and
        # frames, not just a renderer loop counter.
        with Image.open(target)as gif:
            duration=0;count=gif.n_frames
            for i in range(count):gif.seek(i);duration+=gif.info['duration']
        assert abs(duration-len(frames)/fps*1000)<30
        print(f'PASS {name}: {len(frames)} rendered frames; {count} GIF frames; {duration} ms; {target.stat().st_size} bytes',flush=True)
        return {'file':target.name,'renderedFrames':len(frames),'encodedFrames':count,'durationMs':duration,'sha256':sha(target),'bytes':target.stat().st_size}
    records=[];image_checks={}
    assert rotor['loopSourceFrames']==[3,4,5,6,7,8]
    assert max(rn.size)<=2048 and rn.size==rm.size,'Preview texture exceeds 2048'
    mask_pixels=np.array(rm);untinted=mask_pixels[:,:,:3].sum(2)==0
    for color,sheet in rotors.items():
        assert np.array_equal(np.array(sheet)[untinted],np.array(rn)[untinted]),'Eyes/foliage outside body mask must retain original RGBA'
    image_checks['originalFrame9Goto3Applied']=True
    image_checks['fourPalettesPreserveUntintedRGBA']=True
    # Correct original script loop vs velocity-driven playback. No invented
    # intermediate blade placement is labelled as a source drawing.
    rotor_frames=[]
    for m in rotor_traces[50]['frames']:
        t=m['time'];im=Image.new('RGBA',(900,300),'#f6f3ea')
        label(im,'原帧顺序校正 · 拖动会加速，松手慢慢降速',(450,25),f18)
        label(im,'原循环：3 → 4 → 5 → 6 → 7 → 8 → 3',(450,51),f14)
        for col,kind in enumerate(['source','candidate','detail']):
            x=150+300*col
            pic=pose('senior',t,None,'down')[0]if kind=='source'else pose('senior',t,m,'down')[0]
            if kind=='candidate':
                x+=(m['x']-235)*.4
                d=ImageDraw.Draw(im);hx=450+(m['handX']-235)*.4
                d.ellipse((hx-4,72,hx+4,80),fill='#d6ad66'if m['held']else'#f6f3ea',outline='#b68d4d')
            if kind=='detail':im.alpha_composite(pic.crop((0,0,192,112)).resize((230,134),Image.Resampling.LANCZOS),(x-115,107))
            else:im.alpha_composite(pic,(round(x-96),72))
            label(im,['原片 · 正常播放','手速驱动 · 直接用原帧','叶片局部 · 同步帧'][col],(150+300*col,273),f14)
        label(im,('拖动加速'if m['held']else'松手续转'if m['phase'].startswith('release')else'安静慢转')+f"  · {m['rotor']['rate']:.2f}×",(450,294),f12)
        rotor_frames.append(im)
    records.append(encode('rotor-script-and-drag-v2',rotor_frames,50))
    # All release examples have the same hand path and marker. Different
    # glide lengths come from each form's drag profile, not another hand path.
    phase_text={'ready':'轻轻拿起','drag-right':'向右拖动','release-right':'松手 → 继续滑行','drag-left':'向左拖动','release-left':'松手 ← 继续滑行','settled':'慢慢停稳'}
    frames_by_form={};clip_proofs={}
    for form in FORMS:
        frames=[];body_baselines=[]
        for m in traces['forms'][form]:
            im=Image.new('RGBA',(480,210),'#f6f3ea');d=ImageDraw.Draw(im)
            label(im,NAMES[form],(240,21),f18)
            label(im,phase_text[m['phase']],(240,188),f14)
            d.line([(50,162),(440,162)],fill='#e0d9c9',width=1)
            # Open circle = stationary release position, filled = held hand.
            if m['phase']!='ready' and (m['held']or m['phase'].startswith('release')):
                hx=m['handX'];hy=62+m['handY'];d.ellipse((hx-4,hy-4,hx+4,hy+4),fill='#d6ad66'if m['held']else'#f6f3ea',outline='#b68d4d',width=1)
                if not m['held']:d.line([(hx,hy+7),(hx,157)],fill='#ddd5c4',width=1)
            sprite(im,form,m['x'],154+m['y'],m['time'],m)
            if form in ['junior','middle']and m['held']:body_baselines.append(154+m['y'])
            frames.append(im)
        if body_baselines: assert max(body_baselines)-min(body_baselines)<1e-8
        if form in ['junior','middle']:
            rendered_bottoms=[]
            for pic,m in zip(frames,traces['forms'][form]):
                if not m['held']:continue
                a=np.asarray(pic);red=(a[:,:,0]>210)&(a[:,:,1]<125)&(a[:,:,2]<100)&(a[:,:,3]>200)
                ys,xs=np.where(red);assert len(xs)>200
                rendered_bottoms.append(int(ys.max()))
            assert max(rendered_bottoms)-min(rendered_bottoms)<=1,'Rendered body baseline hops during horizontal drag'
            image_checks[form+'HorizontalDragBodyBottom']={'min':min(rendered_bottoms),'max':max(rendered_bottoms),'unit':'rendered pixels'}
        frames_by_form[form]=frames
        records.append(encode('throw-'+form,frames))
        clip_proofs[form]={'maxX':max(m['x']for m in traces['forms'][form]),'minX':min(m['x']for m in traces['forms'][form]),
                          'releaseRightTravelPixels':round(traces['forms'][form][78]['x']-235,3),'horizontalGrabBaselineRange':max(body_baselines)-min(body_baselines)if body_baselines else None}
    for name,forms,cols in [('throw-stages',['seed','junior','middle','senior','super'],2),('throw-evolutions',['classic','super','water','wood','fire'],2)]:
        combined=[];rows=math.ceil(len(forms)/cols)
        for i in range(len(next(iter(frames_by_form.values())))):
            im=Image.new('RGBA',(480*cols,rows*210),'#f6f3ea')
            for j,form in enumerate(forms):im.alpha_composite(frames_by_form[form][i],((j%cols)*480,(j//cols)*210))
            if len(forms)%cols:label(im,'实心点：正在拖动\n空心点：松手位置\n\n本轮仅供动作确认',(720,rows*210-110),f18)
            combined.append(im)
        records.append(encode(name,combined))
    # Four palettes on dark background expose halos and accidental eye/leaf
    # tinting that a cream sheet can hide.
    color_frames=[]
    for i in range(90):
        im=Image.new('RGBA',(720,250),'#202931');label(im,'同一叶冠 · 四种身体颜色',(360,22),f18,'#e7eee9')
        for j,color in enumerate(['red','yellow','blue','pink']):
            pic,_=pose('senior',i/FPS,None,'down',color);pic=pic.resize((154,166),Image.Resampling.LANCZOS);im.alpha_composite(pic,(j*180+13,46))
            label(im,{'red':'红色','yellow':'黄色','blue':'蓝色','pink':'粉色'}[color],(j*180+90,230),f14,'#e7eee9')
        color_frames.append(im)
    records.append(encode('rotor-colours-dark',color_frames))
    # Sample the exact rendered frames, including release/continued travel.
    contact=Image.new('RGBA',(480*3,210*3),'#f6f3ea')
    for r,form in enumerate(['seed','middle','senior']):
        for c,at in enumerate([1.25,1.65,2.6]):contact.alpha_composite(frames_by_form[form][round(at*FPS)],(480*c,210*r))
    contact.convert('RGB').save(OUT/'release-contact-sheet.png')
    sheet=Image.new('RGBA',(W*6,H))
    for i in range(6):sheet.alpha_composite(pose('senior',i/24,None,'down')[0],(i*W,0))
    sheet.save(OUT/'rotor-frame-sequence.png',optimize=True)
    receipt={'revision':2,'reviewOnly':True,'shippingCodeChanged':False,'releaseCreated':False,'renderFps':FPS,'source':{'url':SOURCE_URL,'sha256':SOURCE_SHA},
             'referenceMethod':'Original frame scripts verified. Complete source frames 3..8, sorted SWF depth; no blade interpolation. Existing source rigs, velocity-driven playback and new release choreography. No original-client reproduction claim.',
             'forms':FORMS,'checks':clip_proofs,'renderedImageChecks':image_checks,'previews':records,'windowsBlackRectangle':'Not reproduced in this Linux environment; no claimed fix or native Windows acceptance.'}
    (OUT/'checks.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    (OUT/'motion-traces.json').write_text(json.dumps(traces,separators=(',',':'))+'\n')
    (OUT/'rotor-motion-traces.json').write_text(json.dumps(rotor_traces[50],separators=(',',':'))+'\n')
    make_interactive(rn,rm,rotor)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--exporter',required=True);p.add_argument('--work',type=Path,default=Path('/tmp/mole-rotor-throw'));p.add_argument('--reuse-export',action='store_true');a=p.parse_args()
    a.work.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    if not a.reuse_export:export_senior(a.exporter,a.work)
    verify_direct_reference(a.exporter,a.work)
    make_previews(a.work)

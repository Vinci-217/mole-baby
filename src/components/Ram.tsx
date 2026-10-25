import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { easeGaze, type PetGaze } from '../pet-attention'
import type { PetColor, Stage, Evolution } from '../game'
import { getItemMotion, getItemMotionByAction, getItemMouthAnchor, sampleItemMotion, sampleCareRoutine, sampleGentleMouth, colorBlend, type ItemMotion } from '../item-motion'
import { groundedMotion, usesGroundedPose } from '../grounded-motion'
import './Ram.css'
import SocialCue, { paintSocialCue } from './SocialCue'
import { createPetSoundClock } from '../pet-audio'
import { itemSoundScore, socialSoundScore } from '../pet-sound-score'
import { CARE_COLUMNS, CARE_ROWS, getRamActionDuration, sampleRamPose, sampleSeedPose, sampleFlyingPose } from './ram-animation'
import { edgePeekTilt, type PetEdge } from '../edge-motion'
import {footballSpec,footballPose,footballDuration,slumberEmitter,type RamForm} from '../original-actions'
import {emotionSpec,emotionPose,emotionDuration,isEmotionClip} from '../mood-motion'
import RamWear from './RamWear'
import type {footballOutfitRig} from '../outfit-motion'
let outfitMotion:typeof import('../outfit-motion')|undefined
let outfitLoading:Promise<void>|undefined
const outfitWaiters=new Set<HTMLCanvasElement>()
function requestOutfitMotion(body:HTMLCanvasElement){
  outfitWaiters.add(body)
  outfitLoading??=import('../outfit-motion').then(module=>{outfitMotion=module;for(const canvas of outfitWaiters)if(canvas.isConnected)canvas.dispatchEvent(new Event('ram-wardrobe-change'));outfitWaiters.clear()}).catch(()=>{outfitLoading=undefined;outfitWaiters.clear()})
}
import {getOutfit,outfitCoversCrown} from '../wardrobe'
import {bodyWearAnchor,type WearAnchor} from '../wear-anchor'
import {isPastime,pastimeBody,spellCostume,PASTIME_LABELS} from '../pet-pastimes'
import LifeCue from './LifeCue'

interface RamProps {
  color: PetColor
  costume?: string
  companionId?: number
  stage: Stage
  evolution?: Evolution
  action?: string
  sleeping?: boolean
  peeking?: boolean
  peekSide?: PetEdge
  edgeEntry?: PetEdge
  fromColor?: PetColor
  sound?: boolean
  className?: string
  /** Compatibility only: every rendering path uses original game artwork. */
  artStyle?: 'classic' | 'hd'
  actionId?: number | string
  /** The exact consumed item, retained for the whole finite care animation. */
  itemId?: string
  gaze?: RefObject<PetGaze>
  dragTilt?: number
  dragging?: boolean
  shaking?: boolean
  onActionEnd?: () => void
}
type Form = RamForm
type SheetKind = 'classic' | 'care' | 'seed' | 'item' | 'grounded' | 'slumber' | 'gentle' | 'football' | 'emotion-joy' | 'emotion-grumpy'
interface SheetSource { neutral: ImageData; mask: Uint8ClampedArray; form?:string;kind?:SheetKind }
const CELL_WIDTH = 192
const CELL_HEIGHT = 208
const COLOR_NAMES: Record<PetColor, string> = { pink: '粉红色', yellow: '黄色', blue: '天蓝色', red: '红色' }
const COLOR_OFFSETS: Record<PetColor, readonly number[]> = {
  red: [255, -199, -250], yellow: [0, -21, -255],
  blue: [-215, -57, 31], pink: [51, -148, 0],
}
const sourceCache = new Map<string, Promise<SheetSource>>()
const tintedCache = new Map<string, Promise<HTMLCanvasElement>>()
const wearSources=new WeakMap<HTMLCanvasElement,SheetSource>()
const wearAnchors=new WeakMap<SheetSource,Map<string,WearAnchor|null>>()
const ACTION_NAMES: Record<string, string> = {
  'mood-joy':'开心地舒展开身体','mood-grumpy':'有点闷闷的，轻轻皱起眉头','mood-content':'安心地眯眯眼','mood-dozy':'困倦地打个小哈欠',
  'watch-butterfly':'好奇地看着小蝴蝶', 'look-around':'轻轻转身张望',
  idle: '正在陪伴你', 'walk-right': '向右走', 'running-right': '向右走',
  'walk-left': '向左走', 'running-left': '向左走', pet: '被小手轻轻摸摸',
  waving: '正在打招呼', feed: '开心地吃东西', eat: '开心地吃东西', drink: '正在喝水',
  wash: '正在洗澡', medical: '正在接受照料', use: '正在接受照料',
  sad: '有点难过', failed: '有点难过', sick: '有些不舒服', hungry: '肚子饿了',
  thirsty: '有些口渴', dirty: '需要清洁', tired: '有点困了',
  sleep: '闭着眼睛睡觉，可以轻轻叫醒', wake: '慢慢醒来了', waiting: '安静地等你',
  drag: '被轻轻提起来了', running: '正在活动', play: '和小球一起玩耍', focus: '翻开书安静陪你专注', dizzy: '有点头晕，停下来缓一缓', happy: '很开心', reward: '很开心', review: '很开心',
  peek: '从角落探出头看你', hide: '在角落安静地陪伴',
}
function sheetSpec(form: Form, kind: SheetKind) {
  if(kind==='gentle')return {width:(form==='seed'?96:CELL_WIDTH)*8,height:form==='seed'?99:CELL_HEIGHT,neutral:`./assets/original/gentle-care/${form}-neutral.png`,mask:`./assets/original/gentle-care/${form}-mask.png`}
  if (kind === 'seed') return { width: 96 * 8, height: 99 * 8, neutral: './assets/original/seed/body.png', mask: './assets/original/seed/body-mask.png' }
  if (kind === 'grounded') return { width: CELL_WIDTH * 5, height: CELL_HEIGHT, neutral: `./assets/original/grounded/${form}-neutral.png`, mask: `./assets/original/grounded/${form}-mask.png` }
  if (kind === 'slumber') return { width: (form==='seed'?96:CELL_WIDTH)*8, height:form==='seed'?99:CELL_HEIGHT, neutral:`./assets/original/slumber/${form}-neutral.png`, mask:`./assets/original/slumber/${form}-mask.png` }
  if (kind === 'football') return { width:160*8,height:192*footballSpec(form)!.rows,neutral:`./assets/original/football/${form}-neutral.png`,mask:`./assets/original/football/${form}-mask.png` }
  if(kind==='emotion-joy'||kind==='emotion-grumpy'){const emotion=kind.slice(8) as 'joy'|'grumpy';return {width:192*8,height:208*emotionSpec(form,emotion)!.rows,neutral:`./assets/original/emotions/${form}-${emotion}-neutral.png`,mask:`./assets/original/emotions/${form}-${emotion}-mask.png`}}
  if (kind === 'care') return { width: CELL_WIDTH * CARE_COLUMNS, height: CELL_HEIGHT * CARE_ROWS, neutral: `./assets/original/care/${form}-neutral.png`, mask: `./assets/original/care/${form}-mask.png` }
  if (kind === 'item') return { width: CELL_WIDTH * CARE_COLUMNS, height: CELL_HEIGHT * 4, neutral: `./assets/original/item-motion/${form}-neutral.png`, mask: `./assets/original/item-motion/${form}-mask.png` }
  return { width: CELL_WIDTH * 8, height: CELL_HEIGHT * 9, neutral: `./assets/classic/${form}-neutral.png`, mask: `./assets/classic/${form}-mask.png` }
}
async function loadPng(path: string, width: number, height: number) {
  const image = new Image()
  image.src = path
  await image.decode()
  if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error('经典拉姆图集尺寸不正确')
  return image
}
function getSource(form: Form, kind: SheetKind): Promise<SheetSource> {
  const key = kind === 'seed' ? 'seed' : `${kind}:${form}`
  const cached = sourceCache.get(key)
  if (cached) return cached
  if(kind==='football'||kind.startsWith('emotion-')){
    const old=[...sourceCache.keys()].filter(k=>k.startsWith('football:')||k.startsWith('emotion-'))
    if(old.length>=2)sourceCache.delete(old[0])
  }
  const spec = sheetSpec(form, kind)
  const pending = Promise.all([loadPng(spec.neutral, spec.width, spec.height), loadPng(spec.mask, spec.width, spec.height)]).then(([neutralImage, maskImage]) => {
    const canvas = document.createElement('canvas')
    canvas.width = spec.width; canvas.height = spec.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('无法初始化拉姆图片')
    context.drawImage(neutralImage, 0, 0)
    const neutral = context.getImageData(0, 0, spec.width, spec.height)
    context.clearRect(0, 0, spec.width, spec.height); context.drawImage(maskImage, 0, 0)
    return { neutral, mask: context.getImageData(0, 0, spec.width, spec.height).data }
  }).catch((error: unknown) => { sourceCache.delete(key); throw error })
  sourceCache.set(key, pending)
  return pending
}
/** Reproduce the original additive body transform. Coverage masks preserve the
 * original leaves, eye whites, pupils, props and pot. Seed uses the same four
 * colour offsets from adoption onwards, as requested for this desktop pet.
 */
function getTintedSheet(form: Form, color: PetColor, kind: SheetKind): Promise<HTMLCanvasElement> {
  if (['super', 'water', 'wood', 'fire'].includes(form) && !['seed','slumber','gentle','football'].includes(kind)&&!kind.startsWith('emotion-')) kind = 'classic'
  const key = kind === 'seed' ? `seed:${color}` : `${kind}:${form}:${color}`
  const cached = tintedCache.get(key)
  if (cached) return cached
  if(kind==='football'||kind.startsWith('emotion-')){
    const old=[...tintedCache.keys()].filter(k=>k.startsWith('football:')||k.startsWith('emotion-'))
    if(old.length>=3)tintedCache.delete(old[0])
  }
  const pending = getSource(form, kind).then(({ neutral, mask }) => {
    const canvas = document.createElement('canvas')
    canvas.width = neutral.width; canvas.height = neutral.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法初始化拉姆配色')
    const pixels = new ImageData(new Uint8ClampedArray(neutral.data), neutral.width, neutral.height)
    const clamp = (value: number) => Math.max(0, Math.min(255, value))
    const deltas = [255, 204, 153].map(base => COLOR_OFFSETS[color].map(offset => clamp(base + offset) - base))
    for (let i = 0; i < pixels.data.length; i += 4) {
      const white = mask[i] / 255, gray = mask[i + 1] / 255, dark = mask[i + 2] / 255
      if (!(white || gray || dark)) continue
      for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = clamp(pixels.data[i + channel] + deltas[0][channel] * white + deltas[1][channel] * gray + deltas[2][channel] * dark)
    }
    context.putImageData(pixels, 0, 0)
    wearSources.set(canvas,{neutral,mask,form,kind})
    return canvas
  }).catch((error: unknown) => { tintedCache.delete(key); throw error })
  // Keep old colour previews from retaining an unlimited number of large
  // canvases after repeated pet imports. Mounted components hold their own copy.
  if (tintedCache.size >= 18) tintedCache.delete(tintedCache.keys().next().value!)
  tintedCache.set(key, pending)
  return pending
}
/** Clothing belongs inside the body's transform layer and uses the same source
 * frame coverage. The anchor is cached per source cell, independent of colour. */
const crownlessSheets=new WeakMap<HTMLCanvasElement,HTMLCanvasElement>()
/** Original dress layers can hide foliage. Keep the source face and body; do
 * not paint a second face over it or tint the accessory with body colours. */
function wardrobeBody(body:HTMLCanvasElement,sheet:HTMLCanvasElement) {
  if(body.closest<HTMLElement>('.ram-sprite')?.dataset.crownHidden!=='true')return sheet
  const cached=crownlessSheets.get(sheet);if(cached)return cached
  const source=wearSources.get(sheet);if(!source)return sheet
  // Football foliage participates in the source performance and can cross the
  // face. Cropping a flattened crown there would leave holes in the body.
  if(source.kind==='football')return sheet
  const width=source.kind==='seed'||source.form==='seed'?96:192,height=source.kind==='seed'||source.form==='seed'?99:208
  const view=document.createElement('canvas');view.width=sheet.width;view.height=sheet.height;const ctx=view.getContext('2d');if(!ctx)return sheet
  ctx.drawImage(sheet,0,0);const pixels=ctx.getImageData(0,0,view.width,view.height),n=source.neutral.data,m=source.mask
  for(let sy=0;sy<view.height;sy+=height)for(let sx=0;sx<view.width;sx+=width){
    const anchor=bodyWearAnchor(m,n,view.width,sx,sy,width,height)
    if(!anchor){if(source.kind==='grounded'&&sx/width===4)for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels.data[((sy+y)*view.width+sx+x)*4+3]=0;continue}
    const left=anchor.x-anchor.bodyWidth/2,right=anchor.x+anchor.bodyWidth/2,top=anchor.y+anchor.bodyHeight*.025
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=((sy+y)*view.width+sx+x)*4
      if(m[i]+m[i+1]+m[i+2]>50)continue
      const coloured=Math.max(n[i],n[i+1],n[i+2])-Math.min(n[i],n[i+1],n[i+2])>25
      const outsideFace=y<top-anchor.bodyHeight*.35||x<left-anchor.bodyWidth*.1||x>right+anchor.bodyWidth*.1
      if((coloured&&(y<top+anchor.bodyHeight*.18||x<left-anchor.bodyWidth*.04||x>right+anchor.bodyWidth*.04))||(outsideFace&&y<top+anchor.bodyHeight*.9))pixels.data[i+3]=0
    }
  }
  ctx.putImageData(pixels,0,0);crownlessSheets.set(sheet,view);return view
}
const costumeImages=new Map<string,HTMLImageElement>()
const costumePending=new Map<string,Promise<HTMLImageElement>>()
const costumeListeners=new WeakMap<HTMLCanvasElement,string>()
function costumeImage(path:string,wear:HTMLCanvasElement,body:HTMLCanvasElement) {
  const ready=costumeImages.get(path);if(ready)return ready
  let pending=costumePending.get(path)
  if(!pending){pending=new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Costume PNG unavailable'));im.src=path});costumePending.set(path,pending)}
  if(costumeListeners.get(wear)!==path){costumeListeners.set(wear,path);pending.then(im=>{costumeImages.set(path,im);costumePending.delete(path);while(costumeImages.size>24)costumeImages.delete(costumeImages.keys().next().value!);if(body.isConnected&&wear.isConnected&&costumeListeners.get(wear)===path)body.dispatchEvent(new Event('ram-wardrobe-change'))}).catch(()=>{costumePending.delete(path)})}
  return null
}
function placeFootballHeadwear(wear:HTMLCanvasElement,rig:NonNullable<ReturnType<typeof footballOutfitRig>>,box:{x:number;y:number;width:number;height:number}){
  const sx=100/160*1.666666667,sy=100/192*1.846153846;
  wear.style.left=`${(rig.x-(rig.neutralX-box.x)*rig.scale)*sx-33.3333333}%`;
  wear.style.top=`${(rig.y-(rig.neutralY-box.y)*rig.scale)*sy-61.5384615}%`;
  wear.style.width=`${box.width*rig.scale*sx}%`;wear.style.height=`${box.height*rig.scale*sy}%`;
  wear.style.transformOrigin=`${(rig.neutralX-box.x)/box.width*100}% ${(rig.neutralY-box.y)/box.height*100}%`;
  wear.style.rotate=`${rig.angle}deg`;wear.dataset.headRegistration='original-symbols';
}
function paintWear(canvas:HTMLCanvasElement|null,sheet:HTMLCanvasElement,frame:number,row:number,width=192,height=208,football=false,sourceFrame?:number) {
  if(!canvas?.isConnected)return
  const wear=canvas.parentElement?.querySelector<HTMLCanvasElement>('.ram-wear'),source=wearSources.get(sheet)
  const outfit=getOutfit(wear?.dataset.outfit)
  if(!wear||!outfit||!source)return
  if(!outfitMotion){wear.style.visibility='hidden';requestOutfitMotion(canvas);return}
  const {outfitFrame,footballOutfitRig}=outfitMotion
  const kind=source.kind??'classic',form=width===96?'seed':source.form??'junior'
  if(football&&['magic-book','star-wand'].includes(outfit.id)){
    const image=costumeImage(`./assets/original/wardrobe/${outfit.id}.png`,wear,canvas),context=wear.getContext('2d');if(!image||!context){wear.style.visibility='hidden';return}
    if(wear.dataset.paint!==`stowed:${outfit.id}`){wear.width=image.naturalWidth;wear.height=image.naturalHeight;context.clearRect(0,0,wear.width,wear.height);context.drawImage(image,0,0);wear.dataset.paint=`stowed:${outfit.id}`}
    const settle=Math.min(1,Math.max(0,((sourceFrame??1)-1)/12)),size=outfit.id==='magic-book'?21:13;
    wear.style.left=outfit.id==='magic-book'?'7%':'82%';wear.style.top=`${72+(1-settle)*-8}%`;wear.style.width=`${size}%`;wear.style.height=`${size*192/208*image.naturalHeight/image.naturalWidth}%`;wear.style.transformOrigin='50% 100%';wear.style.rotate=outfit.id==='magic-book'?'-9deg':'24deg';wear.style.visibility='visible';wear.dataset.loaded='true';wear.dataset.registration='original-source';wear.dataset.stowed='true';wear.dataset.sourceFrame=String(sourceFrame);delete wear.dataset.headRegistration;return
  }
  delete wear.dataset.stowed;
  const rig=football&&sourceFrame?footballOutfitRig(form,sourceFrame):null;
  const headRig=rig&&!['magic-book','star-wand'].includes(outfit.id)?rig:null;
  const authored=headRig?outfitFrame(outfit.id,form,'slumber',0,0,8):outfitFrame(outfit.id,form,kind,frame,row,source.neutral.width/width,sourceFrame)
  if(!headRig){wear.style.transformOrigin='50% 100%';delete wear.dataset.headRegistration}
  const scaleX=football?1.666666667:1,scaleY=football?1.846153846:1
  const context=wear.getContext('2d');if(!context)return
  if(authored){
    const {sheet:spec,index}=authored,im=costumeImage(`./assets/original/wardrobe-motion/${spec.file}`,wear,canvas)
    if(!im){wear.style.visibility='hidden';return}
    const signature=`${spec.file}:${index}`
    if(wear.dataset.paint!==signature){wear.width=spec.cell[0];wear.height=spec.cell[1];context.clearRect(0,0,wear.width,wear.height);const box=spec.rects[index],w=box[2]-box[0],h=box[3]-box[1];context.drawImage(im,index%spec.columns*spec.tile[0],Math.floor(index/spec.columns)*spec.tile[1],w,h,box[0],box[1],w,h);wear.dataset.paint=signature}
    wear.style.left=`${-spec.origin[0]/width*100*scaleX-(football?33.3333333:0)}%`;wear.style.top=`${-spec.origin[1]/height*100*scaleY-(football?61.5384615:0)}%`
    wear.style.width=`${spec.cell[0]/width*100*scaleX}%`;wear.style.height=`${spec.cell[1]/height*100*scaleY}%`;wear.style.rotate='none';wear.style.visibility='visible';wear.dataset.registration='original-source';wear.dataset.sourceFrame=String(sourceFrame??frame)
    if(headRig)placeFootballHeadwear(wear,headRig,{x:-spec.origin[0],y:-spec.origin[1],width:spec.cell[0],height:spec.cell[1]})
  }else{
    const image=costumeImage(`./assets/original/wardrobe/${outfit.id}.png`,wear,canvas)
    if(!image){wear.style.visibility='hidden';return}
    let cache=wearAnchors.get(source);if(!cache){cache=new Map();wearAnchors.set(source,cache)}
    const key=`${frame}:${row}:${width}:${height}`
    if(!cache.has(key))cache.set(key,bodyWearAnchor(source.mask,source.neutral.data,source.neutral.width,frame*width,row*height,width,height,width===96))
    const anchor=cache.get(key);if(!anchor){wear.style.visibility='hidden';return}
    if(wear.dataset.paint!==outfit.id){wear.width=image.naturalWidth;wear.height=image.naturalHeight;context.clearRect(0,0,wear.width,wear.height);context.drawImage(image,0,0);wear.dataset.paint=outfit.id}
    const w=anchor.bodyWidth*outfit.width,x=(anchor.x+anchor.bodyWidth*outfit.x-w/2)/width*100*scaleX-(football?33.3333333:0)
    const y=(anchor.y+anchor.bodyHeight*outfit.y-w*image.naturalHeight/image.naturalWidth)/height*100*scaleY-(football?61.5384615:0)
    wear.style.left=`${x}%`;wear.style.top=`${y}%`;wear.style.width=`${w/width*100*scaleX}%`;wear.style.height=`${w*image.naturalHeight/image.naturalWidth/height*100*scaleY}%`;wear.style.rotate='none';wear.style.visibility='visible';wear.dataset.registration='head-fit'
    if(headRig){const b=headRig.body,bw=b[2]-b[0],bh=b[3]-b[1],size=bw*outfit.width;placeFootballHeadwear(wear,headRig,{x:(b[0]+b[2])/2+bw*outfit.x-size/2,y:b[1]-bh*.025+bh*outfit.y-size*image.naturalHeight/image.naturalWidth,width:size,height:size*image.naturalHeight/image.naturalWidth})}
  }
  wear.dataset.anchorFrame=`${frame}:${row}`;wear.dataset.loaded='true'
}
/** Body and accessory consume the exact same elapsed event clock. The
 * accessory is moved, not used to resize/re-register the original body. */
function paintItemCue(canvas: HTMLCanvasElement, motion: ItemMotion | undefined, elapsed: number, reduced: boolean) {
  if (!motion) return
  const root = canvas.closest<HTMLElement>('.ram-sprite')
  if (!root) return
  const pose = sampleItemMotion(motion, elapsed, reduced)
  const anchor = getItemMouthAnchor(canvas.dataset.form, motion, pose.bodyFrame)
  const routine=sampleCareRoutine(motion,elapsed,anchor,canvas.dataset.form==='seed',reduced)
  const vars:Record<string,string>={
    '--care-mouth-x':`${anchor[0]}%`,'--care-mouth-y':`${anchor[1]}%`,
    '--care-opacity':String(pose.opacity),'--care-jaw':String(sampleGentleMouth(motion,elapsed,reduced)/7),
    '--tray-x':`${routine.trayX}%`,'--tray-y':`${routine.trayY}%`,'--tray-opacity':String(routine.trayOpacity),'--tray-lift':`${routine.trayLift}%`,
    '--bottle-x':`${routine.bottleX}%`,'--bottle-y':`${routine.bottleY}%`,'--bottle-angle':`${routine.bottleAngle}deg`,'--bottle-empty':`${(1-routine.milk)*62}%`,
    '--clean-opacity':String(routine.cleanOpacity),'--clean-rinse':String(routine.rinse),'--care-sparkle':String(routine.sparkle),
  }
  for(const [name,value] of Object.entries(vars))root.style.setProperty(name,value)
  root.querySelectorAll<HTMLElement>('.care-food-bite').forEach((element,i)=>{const p=routine.pieces[i];if(!p)return;element.style.left=`${p.x}%`;element.style.top=`${p.y}%`;element.style.opacity=String(p.opacity);element.style.transform=`translate(-50%,-50%) rotate(${p.angle}deg) scale(${p.scale})`})
  root.querySelectorAll<HTMLElement>('.care-clean-bubble').forEach((element,i)=>{const t=reduced?0:elapsed/900+i*1.2;element.style.translate=`${Math.sin(t)*3}% ${Math.cos(t)*7}%`})

}
/** Readiness describes painted pixels, rather than the next React props. A
 * colour/action switch can retain a canvas while its source loads. */
function usePaintReadiness(ref:RefObject<HTMLCanvasElement|null>,key:string) {
  useLayoutEffect(()=>{const canvas=ref.current;if(canvas){delete canvas.dataset.loaded;delete canvas.dataset.loadedColor}},[ref,key])
}
function ClassicFrames({ form, color, fromColor, action, actionId, itemMotion, sound, gaze, startedAt, onError, onActionEnd }: {
  form: Form; color: PetColor; fromColor?: PetColor; action: string; actionId?: string | number;
  itemMotion?: ItemMotion;
  sound?: boolean; gaze?: RefObject<PetGaze>; startedAt:number;
  onError: () => void; onActionEnd?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flightClock = useRef(0)
  const eyePosition=useRef<PetGaze>({x:0,y:0})
  const gazeRef=useRef(gaze);gazeRef.current=gaze
  const soundRef=useRef(sound);soundRef.current=sound
  const errorRef = useRef(onError); errorRef.current = onError
  const endRef = useRef(onActionEnd); endRef.current = onActionEnd
  const [ready, setReady] = useState<{ key: string; classic: HTMLCanvasElement; care: HTMLCanvasElement; item: HTMLCanvasElement; grounded?: HTMLCanvasElement; slumber: HTMLCanvasElement; gentle:HTMLCanvasElement; previous: (HTMLCanvasElement | undefined)[] | null } | null>(null)
  const key = `${form}:${color}:${fromColor??''}`
  const sheets = ready?.key === key ? ready : null
  usePaintReadiness(canvasRef,`${key}:${action}:${actionId??0}`)
  useEffect(() => {
    let cancelled = false
    const load=async(c:PetColor)=>{
      const [classic,care,item]=await Promise.all([getTintedSheet(form,c,'classic'),getTintedSheet(form,c,'care'),getTintedSheet(form,c,'item')]);
      const grounded=['junior','middle'].includes(form)?await getTintedSheet(form,c,'grounded'):undefined;
      const slumber=await getTintedSheet(form,c,'slumber');
      const gentle=await getTintedSheet(form,c,'gentle');
      return {classic,care,item,grounded,slumber,gentle};
    };
    Promise.all([load(color),fromColor&&fromColor!==color?load(fromColor):null]).then(([current,old])=>{if(!cancelled)setReady({key,...current,previous:old?[old.classic,old.care,old.item,old.grounded,old.slumber,old.gentle]:null})}).catch(()=>{if(!cancelled)errorRef.current()});
    return () => { cancelled = true }
  }, [form, color, fromColor, key])
  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext('2d')
    if (!canvas || !context || !sheets) return
    const soundClock=createPetSoundClock(itemMotion?itemSoundScore(itemMotion):socialSoundScore(action),()=>soundRef.current===true)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0, elapsed = 0, last = 0, inView = true, ended = false, stopped = false, previous = ''
    const paint = (now: number) => {
      if (stopped || !canvas.isConnected || document.hidden || !inView) { last = 0; return }
      const delta=last&&now-last<250?now-last:0
      elapsed=['idle','waiting','still','drag'].includes(action)?elapsed+delta:Math.max(0,now-startedAt)
      flightClock.current+=delta
      eyePosition.current=media.matches?{x:0,y:0}:easeGaze(eyePosition.current,gazeRef.current?.current??{x:0,y:0},delta)
      last = now
      const pose = ['senior', 'super', 'water', 'wood', 'fire'].includes(form) ? sampleFlyingPose(action, elapsed, media.matches, form, flightClock.current) : sampleRamPose(action, elapsed, media.matches)
      if(!media.matches||action!=='focus')soundClock.tick(elapsed)
      paintItemCue(canvas, itemMotion, elapsed, media.matches)
      paintSocialCue(canvas, form === 'junior' ? 1 : form === 'middle' ? 2 : form === 'senior' ? 3 : 4, action, elapsed, media.matches, ['super','water','wood','fire'].includes(form) ? form as Evolution : undefined)
      const mix=itemMotion?.gesture==='recolor'?colorBlend(elapsed,itemMotion.duration,media.matches):1
      const grounded = pose.sheet!=='slumber' && sheets.grounded && usesGroundedPose(form,action) ? groundedMotion(form,action,elapsed,flightClock.current,media.matches,eyePosition.current) : null
      const gentle=Boolean(itemMotion);
      const sheet=gentle?'gentle':grounded?'grounded':pose.sheet??'classic', frame=gentle?sampleGentleMouth(itemMotion!,elapsed,media.matches):grounded?.frame??pose.frame, row=gentle||grounded?0:pose.row
      const signature = `${sheet}:${row}:${frame}:${Math.round(mix*255)}:${grounded?`${grounded.eyeX.toFixed(2)}:${grounded.eyeY.toFixed(2)}:${grounded.leafAngle.toFixed(2)}`:''}`
      if (signature !== previous) {
        context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
        const target=sheet==='gentle'?sheets.gentle:sheet==='grounded'?sheets.grounded!:sheet==='slumber'?sheets.slumber:sheet==='care'?sheets.care:sheet==='item'?sheets.item:sheets.classic
        const old=sheets.previous?.[sheet==='gentle'?5:sheet==='slumber'?4:sheet==='grounded'?3:sheet==='care'?1:sheet==='item'?2:0]
        const draw=(source:HTMLCanvasElement)=>{
          context.drawImage(wardrobeBody(canvas,source),frame*CELL_WIDTH,row*CELL_HEIGHT,CELL_WIDTH,CELL_HEIGHT,0,0,CELL_WIDTH,CELL_HEIGHT)
          if(grounded){
            if(frame===0)context.drawImage(wardrobeBody(canvas,source),3*CELL_WIDTH,0,CELL_WIDTH,CELL_HEIGHT,grounded.eyeX,grounded.eyeY,CELL_WIDTH,CELL_HEIGHT)
            context.save();context.translate(96,110);context.rotate(grounded.leafAngle*Math.PI/180);context.translate(-96,-110)
            context.drawImage(wardrobeBody(canvas,source),4*CELL_WIDTH,0,CELL_WIDTH,CELL_HEIGHT,0,0,CELL_WIDTH,CELL_HEIGHT);context.restore()
          }
        }
        if(old&&mix<1){draw(old);context.globalAlpha=mix}
        draw(target);context.globalAlpha=1
        if(grounded){canvas.dataset.gazeX=grounded.eyeX.toFixed(2);canvas.dataset.gazeY=grounded.eyeY.toFixed(2)}
        canvas.dataset.row=String(row);canvas.dataset.frame=String(frame);canvas.dataset.sheet=sheet;canvas.dataset.loaded='true';canvas.dataset.loadedColor=color;previous=signature
      }
      paintWear(canvas,sheet==='gentle'?sheets.gentle:sheet==='grounded'?sheets.grounded!:sheet==='slumber'?sheets.slumber:sheet==='care'?sheets.care:sheet==='item'?sheets.item:sheets.classic,frame,row)
      if (pose.finished && !ended) { ended = true; endRef.current?.() }
      if (!ended && action !== 'still' && (!media.matches || getRamActionDuration(action) !== null)) request = requestAnimationFrame(paint)
    }
    const resume = () => { cancelAnimationFrame(request); last = 0; previous = ''; request = requestAnimationFrame(paint) }
    const observer = new IntersectionObserver(entries => { inView = entries.some(e => e.isIntersecting); resume() })
    observer.observe(canvas); resume()
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume);canvas.addEventListener('ram-wardrobe-change',resume)
    return () => { soundClock.stop();stopped = true; cancelAnimationFrame(request); observer.disconnect(); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume);canvas.removeEventListener('ram-wardrobe-change',resume) }
  }, [sheets, action, actionId, itemMotion, form, startedAt])
  return <canvas ref={canvasRef} className="ram-classic-frame" width={192} height={208} aria-hidden="true" data-form={form} data-color={color}/>
}
/** A single original source image includes both pet and ball. The larger
 * transparent canvas leaves the physical 100px pet/hit box unchanged. */
function FootballFrames({form,color,actionId,sound,startedAt,performanceClock,onError,onActionEnd}:{form:Form;color:PetColor;actionId?:number|string;sound?:boolean;startedAt:number;performanceClock:RefObject<{began:number|undefined;lastAudioElapsed?:number}>;onError:()=>void;onActionEnd?:()=>void}) {
  const ref=useRef<HTMLCanvasElement>(null),soundRef=useRef(sound),endRef=useRef(onActionEnd),errorRef=useRef(onError)
  soundRef.current=sound;endRef.current=onActionEnd;errorRef.current=onError
  usePaintReadiness(ref,`${form}:${color}:${actionId??0}`)
  useEffect(()=>{
    let cancelled=false,request=0,ended=false,source:HTMLCanvasElement|null=null,previous=-1
    const canvas=ref.current,context=canvas?.getContext('2d'),media=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(!canvas||!context)return
    const score=socialSoundScore('play',form)
    score.cues=score.cues.filter(c=>c.at>(performanceClock.current.lastAudioElapsed??-1))
    const audio=createPetSoundClock(score,()=>soundRef.current===true)
    const paint=(now:number)=>{
      if(cancelled||!source||!canvas.isConnected||document.hidden)return
      if(performanceClock.current.began===undefined)performanceClock.current.began=now
      const elapsed=Math.max(0,now-performanceClock.current.began),pose=footballPose(form,elapsed,media.matches)
      if(!media.matches)audio.tick(elapsed)
      performanceClock.current.lastAudioElapsed=elapsed
      if(previous!==pose.frame){context.clearRect(0,0,160,192);context.drawImage(wardrobeBody(canvas,source),pose.frame%8*160,Math.floor(pose.frame/8)*192,160,192,0,0,160,192);previous=pose.frame}
      paintWear(canvas,source,pose.frame%8,Math.floor(pose.frame/8),160,192,true,pose.sourceFrame)
      canvas.dataset.loaded='true';canvas.dataset.loadedColor=color;canvas.dataset.frame=String(pose.frame);canvas.dataset.sourceFrame=String(pose.sourceFrame);canvas.dataset.nearBall=String(pose.nearBall)
      if(pose.finished&&!ended){ended=true;endRef.current?.()}
      if(!ended)request=requestAnimationFrame(paint)
    }
    const resume=()=>{cancelAnimationFrame(request);previous=-1;if(source)request=requestAnimationFrame(paint)}
    getTintedSheet(form,color,'football').then(value=>{if(!cancelled){source=value;resume()}}).catch(()=>{if(!cancelled)errorRef.current()})
    document.addEventListener('visibilitychange',resume);media.addEventListener('change',resume);canvas.addEventListener('ram-wardrobe-change',resume)
    return()=>{cancelled=true;cancelAnimationFrame(request);audio.stop();document.removeEventListener('visibilitychange',resume);media.removeEventListener('change',resume);canvas.removeEventListener('ram-wardrobe-change',resume)}
  },[form,color,actionId,startedAt,performanceClock])
  return <canvas ref={ref} className="ram-classic-frame ram-football-frame" width={160} height={192} data-sheet="football" data-form={form} data-color={color} data-duration={footballDuration(form)} aria-hidden="true"/>
}
function EmotionFrames({form,color,action,actionId,performanceClock,onError,onActionEnd}:{form:Form;color:PetColor;action:string;actionId?:number|string;performanceClock:RefObject<{began:number|undefined}>;onError:()=>void;onActionEnd?:()=>void}) {
  const ref=useRef<HTMLCanvasElement>(null),endRef=useRef(onActionEnd),errorRef=useRef(onError);endRef.current=onActionEnd;errorRef.current=onError
  usePaintReadiness(ref,`${form}:${color}:${action}:${actionId??0}`)
  useEffect(()=>{
    let cancelled=false,request=0,ended=false,source:HTMLCanvasElement|null=null,previous=-1
    const canvas=ref.current,context=canvas?.getContext('2d'),media=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(!canvas||!context)return
    const paint=(now:number)=>{
      if(cancelled||!source||!canvas.isConnected||document.hidden)return
      if(performanceClock.current.began===undefined)performanceClock.current.began=now
      const elapsed=Math.max(0,now-performanceClock.current.began),pose=emotionPose(form,action,elapsed,media.matches)
      if(previous!==pose.frame){context.clearRect(0,0,192,208);context.drawImage(wardrobeBody(canvas,source),pose.frame%8*192,Math.floor(pose.frame/8)*208,192,208,0,0,192,208);previous=pose.frame}
      paintWear(canvas,source,pose.frame%8,Math.floor(pose.frame/8),192,208,false,pose.sourceFrame)
      canvas.dataset.loaded='true';canvas.dataset.loadedColor=color;canvas.dataset.frame=String(pose.frame);canvas.dataset.sourceFrame=String(pose.sourceFrame)
      if(pose.finished&&!ended){ended=true;endRef.current?.()}
      if(!ended)request=requestAnimationFrame(paint)
    }
    const resume=()=>{cancelAnimationFrame(request);previous=-1;if(source)request=requestAnimationFrame(paint)}
    getTintedSheet(form,color,action==='mood-joy'?'emotion-joy':'emotion-grumpy').then(value=>{if(!cancelled){source=value;resume()}}).catch(()=>{if(!cancelled)errorRef.current()})
    document.addEventListener('visibilitychange',resume);media.addEventListener('change',resume);canvas.addEventListener('ram-wardrobe-change',resume)
    return()=>{cancelled=true;cancelAnimationFrame(request);document.removeEventListener('visibilitychange',resume);media.removeEventListener('change',resume);canvas.removeEventListener('ram-wardrobe-change',resume)}
  },[form,color,action,actionId,performanceClock])
  return <canvas ref={ref} className="ram-classic-frame ram-emotion-frame" width={192} height={208} data-sheet={action} data-form={form} data-color={color} data-duration={emotionDuration(action,form)} aria-hidden="true"/>
}
function SeedBody({ color, fromColor, action, actionId, itemMotion, sound, startedAt, onActionEnd }: { color: PetColor; fromColor?: PetColor; action: string; actionId?: string | number; itemMotion?: ItemMotion; sound?: boolean; startedAt:number; onActionEnd?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const soundRef=useRef(sound);soundRef.current=sound
  const endRef = useRef(onActionEnd); endRef.current = onActionEnd
  usePaintReadiness(ref,`${color}:${fromColor??''}:${action}:${actionId??0}`)
  useEffect(() => {
    const canvas=ref.current;if(!canvas)return
    const soundClock=createPetSoundClock(itemMotion?itemSoundScore(itemMotion):socialSoundScore(action),()=>soundRef.current===true)
    let cancelled = false, request = 0, elapsed = 0, last = 0, previous = '', ended = false
    let source: HTMLCanvasElement | null = null, oldSource: HTMLCanvasElement | null = null, slumber:HTMLCanvasElement|null=null,gentle:HTMLCanvasElement|null=null,oldGentle:HTMLCanvasElement|null=null
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = (now: number) => {
      if (cancelled || !source || ref.current!==canvas || !canvas.isConnected || document.hidden) { last = 0; return }
      const delta=last&&now-last<250?now-last:0
      elapsed=['idle','waiting','still','drag'].includes(action)?elapsed+delta:Math.max(0,now-startedAt)
      last = now
      const isGentle=Boolean(itemMotion);
      const pose = isGentle?{...sampleSeedPose(action,elapsed,media.matches),frame:sampleGentleMouth(itemMotion!,elapsed,media.matches)}:sampleSeedPose(action, elapsed, media.matches)
      if(!media.matches||action!=='focus')soundClock.tick(elapsed)
      if (ref.current) { paintItemCue(ref.current, itemMotion, elapsed, media.matches); paintSocialCue(ref.current, 0, action, elapsed, media.matches) }
      const sleepy=action==='sleep'||action==='wake'&&elapsed<240||action==='mood-dozy'&&(media.matches||elapsed>450&&elapsed<3300);
      const activeSource=sleepy?slumber!:isGentle?gentle!:source,old=isGentle?oldGentle:oldSource;
      const mix=itemMotion?.gesture==='recolor'?colorBlend(elapsed,itemMotion.duration,media.matches):1;const signature=`${sleepy}:${pose.frame}:${Math.round(mix*255)}`;
      if (previous !== signature) {
        const c = ref.current?.getContext('2d')
        if(c){c.clearRect(0,0,96,99);if(old&&mix<1){c.drawImage(old,pose.frame%8*96,Math.floor(pose.frame/8)*99,96,99,0,0,96,99);c.globalAlpha=mix;}c.drawImage(activeSource,pose.frame%8*96,Math.floor(pose.frame/8)*99,96,99,0,0,96,99);c.globalAlpha=1;}
        if (ref.current) { ref.current.dataset.loaded = 'true'; ref.current.dataset.loadedColor=color; ref.current.dataset.frame = String(pose.frame);ref.current.dataset.sheet=sleepy?'slumber':isGentle?'gentle':'seed' }
        previous = signature
      }
      paintWear(canvas,activeSource,pose.frame%8,Math.floor(pose.frame/8),96,99)
      if (pose.finished && !ended) { ended = true; endRef.current?.() }
      if (!ended && action !== 'still' && (!media.matches || getRamActionDuration(action) !== null)) request = requestAnimationFrame(paint)
    }
    const resume = () => { cancelAnimationFrame(request); last = 0; previous = ''; if (source) request = requestAnimationFrame(paint) }
    Promise.all([getTintedSheet('junior',color,'seed'),fromColor?getTintedSheet('junior',fromColor,'seed'):null,getTintedSheet('seed',color,'slumber'),getTintedSheet('seed',color,'gentle'),fromColor?getTintedSheet('seed',fromColor,'gentle'):null]).then(([loaded,old,sleep,eat,oldEat])=>{if(!cancelled){source=loaded;oldSource=old;slumber=sleep;gentle=eat;oldGentle=oldEat;resume()}}).catch(()=>{})
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume);canvas.addEventListener('ram-wardrobe-change',resume)
    return () => { soundClock.stop();cancelled = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume);canvas.removeEventListener('ram-wardrobe-change',resume) }
  }, [color, fromColor, action, actionId, itemMotion, startedAt])
  return <canvas ref={ref} width={96} height={99} className="seed-body-frame" aria-hidden="true" data-form="seed" data-color={color}/>
}
function ItemCue({ motion }: { motion: ItemMotion }) {
  return <span className={`ram-item-cue care-routine-${motion.body}`} style={{ color: motion.accent }} aria-hidden="true" data-item-id={motion.itemId} data-item-gesture={motion.gesture} data-care-routine={motion.body}>
    {motion.body==='eat'&&<><span className="care-food-plate care-prop-sheet"/>{[0,1,2,3].map(i=><img key={i} className="care-food-bite" src={motion.image} alt="" draggable={false}/>)}<span className="care-food-plate care-food-rim care-prop-sheet"/></>}
    {motion.body==='drink'&&<span className="care-drink-bottle"><span className="care-prop-sheet care-bottle-full"/><span className="care-prop-sheet care-bottle-empty"/><img className="care-bottle-label" src={motion.image} alt="" draggable={false}/></span>}
    {motion.body==='wash'&&<><span className="care-clean-foam">{[0,1,2,3,4,5,6,7].map(i=><i className="care-clean-bubble" key={i}/>)}</span><span className="care-clean-rinse">{[0,1,2,3,4].map(i=><i key={i}/>)}</span><img className="care-clean-product" src={motion.image} alt="" draggable={false}/></>}
    {motion.body==='medical'&&<img className="care-medicine-bottle" src={motion.image} alt="" draggable={false}/>}
    <span className="care-finish-sparkle">{[0,1,2].map(i=><img key={i} src="./assets/generated/v12-dizzy-star.png" alt="" draggable={false}/>)}</span>
  </span>
}
export default function Ram({ color, costume, companionId=0, stage, evolution, action = 'idle', sleeping = false, peeking = false, peekSide = 'right', edgeEntry, fromColor, sound = false, className = '', actionId, itemId, gaze, dragTilt = 0, dragging = false, shaking = false, onActionEnd }: RamProps) {
  const clock=useRef({key:'',startedAt:0})
  const playClock=useRef<{key:string;began:number|undefined;lastAudioElapsed?:number}>({key:'',began:undefined})
  const eventKey=`${action}:${actionId??0}:${itemId??''}`
  if(clock.current.key!==eventKey)clock.current={key:eventKey,startedAt:performance.now()}
  if(playClock.current.key!==eventKey)playClock.current={key:eventKey,began:undefined}
  const form: Form = stage === 4 ? evolution ?? 'super' : stage <= 1 ? 'junior' : stage === 2 ? 'middle' : 'senior'
  const lifeAction=!sleeping&&!dragging&&!shaking&&isPastime(action)?action:undefined
  const [illusion,setIllusion]=useState(false)
  const spellChoice=useRef({key:'',outfit:spellCostume(companionId)})
  if(spellChoice.current.key!==eventKey)spellChoice.current={key:eventKey,outfit:spellCostume(companionId)}
  const finishRef=useRef(onActionEnd);finishRef.current=onActionEnd
  useEffect(()=>{
    setIllusion(false)
    if(!lifeAction)return
    const timers:ReturnType<typeof setTimeout>[]=[]
    if(lifeAction==='spell'){timers.push(setTimeout(()=>setIllusion(true),1100),setTimeout(()=>setIllusion(false),6100))}
    if(lifeAction!=='play-alone')timers.push(setTimeout(()=>finishRef.current?.(),getRamActionDuration(lifeAction,stage===0?'seed':form)!))
    return()=>timers.forEach(clearTimeout)
  },[eventKey,lifeAction,form,stage])
  const wearing=lifeAction==='spell'&&illusion?spellChoice.current.outfit:costume
  const sourceEnd=lifeAction&&lifeAction!=='play-alone'?undefined:onActionEnd
  const itemRecipe = itemId ? getItemMotion(itemId) : getItemMotionByAction(action)
  const itemMotion = itemRecipe?.itemId && (getItemMotionByAction(action) || ['feed', 'eat', 'drink', 'wash', 'medical', 'use'].includes(action)) && !sleeping && action !== 'sleep' && !dragging ? itemRecipe : undefined
  const activeAction = sleeping || action === 'sleep' ? 'sleep' : shaking ? 'dizzy' : dragging ? 'drag' : itemMotion ? itemMotion.action : action==='balance'?'balance':pastimeBody(action)
  const resting = activeAction === 'sleep', key = `${form}:${color}`
  const mouth=slumberEmitter(stage===0?'seed':form)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const fallback = failedKey === key
  const tilt = Math.max(-12, Math.min(12, dragTilt)) + (peeking && !resting && !dragging ? edgePeekTilt(peekSide) : 0)
  const seedPeek = stage === 0 && peeking && peekSide === 'top' && !dragging ? 'translateY(60%) ' : ''
  // At the bottom edge the original leaves reach the screen before the face.
  // Lift the artwork within its fixed hit box so a peek actually reveals eyes;
  // the native window offset and drag-out placement stay unchanged.
  const bottomPeek = peeking && peekSide === 'bottom' && !dragging ? stage === 1 ? -25 : -45 : 0
  const label = `${COLOR_NAMES[color]}${['种子期', '初级', '中级', '高级', '神力'][stage]}拉姆，${stage === 0 ? '花盆可以拖动，' : ''}${lifeAction?PASTIME_LABELS[lifeAction]:itemMotion?.label ?? ACTION_NAMES[activeAction] ?? ACTION_NAMES.idle}`
  return <span className={`ram-sprite ram-classic action-${activeAction} ${lifeAction?`life-${lifeAction}`:''} ${itemMotion?'is-gentle-eating':''} ${stage === 0 ? 'ram-seed' : stage <= 2 ? 'ram-grounded' : ''} ${resting ? 'is-sleeping' : ''} ${stage >= 3 && activeAction !== 'still' && !dragging ? 'is-flying' : ''} ${peeking ? 'is-peeking' : ''} ${edgeEntry ? 'is-edge-entering' : ''} ${dragging ? 'is-dragging' : ''} ${shaking ? 'is-shaking' : ''} ${className}`}
    role="img" aria-label={label} data-crown-hidden={outfitCoversCrown(wearing)||undefined} data-life-action={lifeAction} data-illusion={illusion&&lifeAction==='spell'||undefined} data-art-style="classic" data-stage={stage} data-evolution={evolution} data-action={activeAction} data-color={color} data-sleeping={resting ? 'true' : 'false'} data-peek-side={peeking ? peekSide : undefined} data-edge-entry={edgeEntry} data-fallback={fallback || undefined}>
    <span className="ram-flight-layer">
    {stage === 0 ? <><img className="seed-pot-original" src="./assets/original/seed/pot.png" alt="" draggable={false}/><span className="seed-body-original" style={{ transform: `${seedPeek}rotate(${resting ? 0 : tilt}deg)` }}><span className="ram-elastic-layer"><span className={`ram-pose-layer ${activeAction==='focus'&&wearing==='magic-book'?'using-reading-book':''}`}><SeedBody startedAt={clock.current.startedAt} color={color} fromColor={fromColor} sound={sound} action={activeAction} actionId={actionId} itemMotion={itemMotion} onActionEnd={sourceEnd}/><RamWear costume={wearing}/></span></span></span></>
      : <span className="ram-artwork" style={{ transform: `translateY(${bottomPeek}%) rotate(${tilt}deg) translateY(${dragging ? '-2px' : '0'})` }}><span className="ram-elastic-layer"><span className={`ram-pose-layer ${activeAction==='focus'&&wearing==='magic-book'?'using-reading-book':''}`}>
        {fallback ? <img className="ram-original-static" src={`./assets/original/pets/${form}-${color}-idle.png`} alt="" draggable={false}/> : isEmotionClip(activeAction)?<EmotionFrames form={form} color={color} action={activeAction} actionId={actionId} performanceClock={playClock} onActionEnd={sourceEnd} onError={()=>setFailedKey(key)}/>:activeAction==='play'?<FootballFrames form={form} color={color} actionId={actionId} sound={sound} startedAt={clock.current.startedAt} performanceClock={playClock} onActionEnd={sourceEnd} onError={()=>setFailedKey(key)}/>:<ClassicFrames gaze={gaze} startedAt={clock.current.startedAt} form={form} color={color} fromColor={fromColor} sound={sound} action={activeAction} actionId={actionId} itemMotion={itemMotion} onActionEnd={sourceEnd} onError={() => setFailedKey(key)}/>}<RamWear costume={wearing}/>
      </span></span></span>}
    <LifeCue key={`life:${action}:${actionId??0}`} action={lifeAction} stage={stage} sound={sound}/><SocialCue key={`${activeAction}:${actionId ?? 0}`} action={activeAction} originalFootball={stage>0&&activeAction==='play'}/>
    {resting && <span className="ram-sleep-particles" style={{left:`${mouth[0]}%`,top:`${mouth[1]}%`}} aria-hidden="true">{[0,1,2].map(i=><img key={i} src="./assets/original/slumber/z.png" alt="" draggable={false} style={{animationDelay:`${-i*6.4/3}s`}}/>)}</span>}
    {itemMotion && <ItemCue key={`${itemMotion.itemId}:${actionId ?? ''}`} motion={itemMotion}/>}
    </span>
  </span>
}

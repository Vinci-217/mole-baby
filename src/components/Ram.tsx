import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { easeGaze, type PetGaze } from '../pet-attention'
import type { PetColor, Stage, Evolution } from '../game'
import { getItemMotion, getItemMotionByAction, getItemMouthAnchor, sampleItemMotion, colorBlend, type ItemMotion } from '../item-motion'
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
import {getOutfit} from '../wardrobe'
import {bodyWearAnchor,type WearAnchor} from '../wear-anchor'

interface RamProps {
  color: PetColor
  costume?: string
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
type SheetKind = 'classic' | 'care' | 'seed' | 'item' | 'grounded' | 'slumber' | 'football' | 'emotion-joy' | 'emotion-grumpy'
interface SheetSource { neutral: ImageData; mask: Uint8ClampedArray }
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
  if (['super', 'water', 'wood', 'fire'].includes(form) && !['seed','slumber','football'].includes(kind)&&!kind.startsWith('emotion-')) kind = 'classic'
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
    wearSources.set(canvas,{neutral,mask})
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
function paintWear(canvas:HTMLCanvasElement,sheet:HTMLCanvasElement,frame:number,row:number,width=192,height=208,football=false) {
  const wear=canvas.parentElement?.querySelector<HTMLImageElement>('.ram-wear'),source=wearSources.get(sheet)
  const outfit=getOutfit(wear?.dataset.outfit)
  if(!wear||!outfit||!source)return
  let cache=wearAnchors.get(source);if(!cache){cache=new Map();wearAnchors.set(source,cache)}
  const key=`${frame}:${row}:${width}:${height}`,seed=width===96
  if(!cache.has(key))cache.set(key,bodyWearAnchor(source.mask,source.neutral.data,source.neutral.width,frame*width,row*height,width,height,seed))
  const anchor=cache.get(key);if(!anchor){wear.style.visibility='hidden';return}
  const scaleX=football?1.666666667:1,scaleY=football?1.846153846:1
  const x=(anchor.x+anchor.bodyWidth*outfit.x)/width*100*scaleX-(football?33.3333333:0)
  const y=(anchor.y+anchor.bodyHeight*outfit.y)/height*100*scaleY-(football?61.5384615:0)
  wear.style.left=`${x}%`;wear.style.top=`${y}%`;wear.style.width=`${anchor.bodyWidth/width*100*scaleX*outfit.width}%`;wear.style.rotate=`${anchor.angle}deg`;wear.style.visibility='visible'
  wear.dataset.anchorFrame=`${frame}:${row}`
}
/** Body and accessory consume the exact same elapsed event clock. The
 * accessory is moved, not used to resize/re-register the original body. */
function paintItemCue(canvas: HTMLCanvasElement, motion: ItemMotion | undefined, elapsed: number, reduced: boolean) {
  if (!motion) return
  const root = canvas.closest<HTMLElement>('.ram-sprite')
  if (!root) return
  const pose = sampleItemMotion(motion, elapsed, reduced)
  const anchor = getItemMouthAnchor(canvas.dataset.form, motion, pose.bodyFrame)
  const vars: Record<string, string> = {
    '--care-mouth-x': `${anchor[0]}%`, '--care-mouth-y': `${anchor[1]}%`,
    '--care-x': `${pose.x}%`, '--care-y': `${pose.y}%`, '--care-angle': `${pose.angle}deg`,
    '--care-scale-x': String(pose.scaleX), '--care-scale-y': String(pose.scaleY), '--care-opacity': String(pose.opacity),
    '--care-progress': String(pose.progress), '--care-activity': String(pose.activity),
    '--care-lift': `${pose.activity * -12}%`, '--care-wave': `${Math.sin(pose.activity * motion.beats * Math.PI * 2) * 2}%`,
  }
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
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
  const [ready, setReady] = useState<{ key: string; classic: HTMLCanvasElement; care: HTMLCanvasElement; item: HTMLCanvasElement; grounded?: HTMLCanvasElement; slumber: HTMLCanvasElement; previous: (HTMLCanvasElement | undefined)[] | null } | null>(null)
  const key = `${form}:${color}:${fromColor??''}`
  const sheets = ready?.key === key ? ready : null
  useEffect(() => {
    let cancelled = false
    const load=async(c:PetColor)=>{
      const [classic,care,item]=await Promise.all([getTintedSheet(form,c,'classic'),getTintedSheet(form,c,'care'),getTintedSheet(form,c,'item')]);
      const grounded=['junior','middle'].includes(form)?await getTintedSheet(form,c,'grounded'):undefined;
      const slumber=await getTintedSheet(form,c,'slumber');
      return {classic,care,item,grounded,slumber};
    };
    Promise.all([load(color),fromColor&&fromColor!==color?load(fromColor):null]).then(([current,old])=>{if(!cancelled)setReady({key,...current,previous:old?[old.classic,old.care,old.item,old.grounded,old.slumber]:null})}).catch(()=>{if(!cancelled)errorRef.current()});
    return () => { cancelled = true }
  }, [form, color, fromColor, key])
  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext('2d')
    if (!canvas || !context || !sheets) return
    const soundClock=createPetSoundClock(itemMotion?itemSoundScore(itemMotion):socialSoundScore(action),()=>soundRef.current===true)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0, elapsed = 0, last = 0, inView = true, ended = false, stopped = false, previous = ''
    const paint = (now: number) => {
      if (stopped || document.hidden || !inView) { last = 0; return }
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
      const sheet=grounded?'grounded':pose.sheet??'classic', frame=grounded?.frame??pose.frame, row=grounded?0:pose.row
      const signature = `${sheet}:${row}:${frame}:${Math.round(mix*255)}:${grounded?`${grounded.eyeX.toFixed(2)}:${grounded.eyeY.toFixed(2)}:${grounded.leafAngle.toFixed(2)}`:''}`
      if (signature !== previous) {
        context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
        const target=sheet==='grounded'?sheets.grounded!:sheet==='slumber'?sheets.slumber:sheet==='care'?sheets.care:sheet==='item'?sheets.item:sheets.classic
        const old=sheets.previous?.[sheet==='slumber'?4:sheet==='grounded'?3:sheet==='care'?1:sheet==='item'?2:0]
        const draw=(source:HTMLCanvasElement)=>{
          context.drawImage(source,frame*CELL_WIDTH,row*CELL_HEIGHT,CELL_WIDTH,CELL_HEIGHT,0,0,CELL_WIDTH,CELL_HEIGHT)
          if(grounded){
            if(frame===0)context.drawImage(source,3*CELL_WIDTH,0,CELL_WIDTH,CELL_HEIGHT,grounded.eyeX,grounded.eyeY,CELL_WIDTH,CELL_HEIGHT)
            context.save();context.translate(96,110);context.rotate(grounded.leafAngle*Math.PI/180);context.translate(-96,-110)
            context.drawImage(source,4*CELL_WIDTH,0,CELL_WIDTH,CELL_HEIGHT,0,0,CELL_WIDTH,CELL_HEIGHT);context.restore()
          }
        }
        if(old&&mix<1){draw(old);context.globalAlpha=mix}
        draw(target);context.globalAlpha=1
        if(grounded){canvas.dataset.gazeX=grounded.eyeX.toFixed(2);canvas.dataset.gazeY=grounded.eyeY.toFixed(2)}
        canvas.dataset.row=String(row);canvas.dataset.frame=String(frame);canvas.dataset.sheet=sheet;canvas.dataset.loaded='true';previous=signature
      }
      paintWear(canvas,sheet==='grounded'?sheets.grounded!:sheet==='slumber'?sheets.slumber:sheet==='care'?sheets.care:sheet==='item'?sheets.item:sheets.classic,frame,row)
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
  useEffect(()=>{
    let cancelled=false,request=0,ended=false,source:HTMLCanvasElement|null=null,previous=-1
    const canvas=ref.current,context=canvas?.getContext('2d'),media=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(!canvas||!context)return
    const score=socialSoundScore('play',form)
    score.cues=score.cues.filter(c=>c.at>(performanceClock.current.lastAudioElapsed??-1))
    const audio=createPetSoundClock(score,()=>soundRef.current===true)
    const paint=(now:number)=>{
      if(cancelled||!source||document.hidden)return
      if(performanceClock.current.began===undefined)performanceClock.current.began=now
      const elapsed=Math.max(0,now-performanceClock.current.began),pose=footballPose(form,elapsed,media.matches)
      if(!media.matches)audio.tick(elapsed)
      performanceClock.current.lastAudioElapsed=elapsed
      if(previous!==pose.frame){context.clearRect(0,0,160,192);context.drawImage(source,pose.frame%8*160,Math.floor(pose.frame/8)*192,160,192,0,0,160,192);previous=pose.frame}
      paintWear(canvas,source,pose.frame%8,Math.floor(pose.frame/8),160,192,true)
      canvas.dataset.loaded='true';canvas.dataset.frame=String(pose.frame);canvas.dataset.sourceFrame=String(pose.sourceFrame);canvas.dataset.nearBall=String(pose.nearBall)
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
  useEffect(()=>{
    let cancelled=false,request=0,ended=false,source:HTMLCanvasElement|null=null,previous=-1
    const canvas=ref.current,context=canvas?.getContext('2d'),media=window.matchMedia('(prefers-reduced-motion: reduce)')
    if(!canvas||!context)return
    const paint=(now:number)=>{
      if(cancelled||!source||document.hidden)return
      if(performanceClock.current.began===undefined)performanceClock.current.began=now
      const elapsed=Math.max(0,now-performanceClock.current.began),pose=emotionPose(form,action,elapsed,media.matches)
      if(previous!==pose.frame){context.clearRect(0,0,192,208);context.drawImage(source,pose.frame%8*192,Math.floor(pose.frame/8)*208,192,208,0,0,192,208);previous=pose.frame}
      paintWear(canvas,source,pose.frame%8,Math.floor(pose.frame/8))
      canvas.dataset.loaded='true';canvas.dataset.frame=String(pose.frame);canvas.dataset.sourceFrame=String(pose.sourceFrame)
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
  useEffect(() => {
    const canvas=ref.current;if(!canvas)return
    const soundClock=createPetSoundClock(itemMotion?itemSoundScore(itemMotion):socialSoundScore(action),()=>soundRef.current===true)
    let cancelled = false, request = 0, elapsed = 0, last = 0, previous = '', ended = false
    let source: HTMLCanvasElement | null = null, oldSource: HTMLCanvasElement | null = null, slumber:HTMLCanvasElement|null=null
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = (now: number) => {
      if (cancelled || !source || document.hidden) { last = 0; return }
      const delta=last&&now-last<250?now-last:0
      elapsed=['idle','waiting','still','drag'].includes(action)?elapsed+delta:Math.max(0,now-startedAt)
      last = now
      const pose = sampleSeedPose(action, elapsed, media.matches)
      if(!media.matches||action!=='focus')soundClock.tick(elapsed)
      if (ref.current) { paintItemCue(ref.current, itemMotion, elapsed, media.matches); paintSocialCue(ref.current, 0, action, elapsed, media.matches) }
      const sleepy=action==='sleep'||action==='wake'&&elapsed<240||action==='mood-dozy'&&(media.matches||elapsed>450&&elapsed<3300);
      const activeSource=sleepy?slumber!:source;
      const mix=itemMotion?.gesture==='recolor'?colorBlend(elapsed,itemMotion.duration,media.matches):1;const signature=`${sleepy}:${pose.frame}:${Math.round(mix*255)}`;
      if (previous !== signature) {
        const c = ref.current?.getContext('2d')
        if(c){c.clearRect(0,0,96,99);if(oldSource&&mix<1){c.drawImage(oldSource,pose.frame%8*96,Math.floor(pose.frame/8)*99,96,99,0,0,96,99);c.globalAlpha=mix;}c.drawImage(activeSource,pose.frame%8*96,Math.floor(pose.frame/8)*99,96,99,0,0,96,99);c.globalAlpha=1;}
        if (ref.current) { ref.current.dataset.loaded = 'true'; ref.current.dataset.frame = String(pose.frame);ref.current.dataset.sheet=sleepy?'slumber':'seed' }
        previous = signature
      }
      paintWear(ref.current!,activeSource,pose.frame%8,Math.floor(pose.frame/8),96,99)
      if (pose.finished && !ended) { ended = true; endRef.current?.() }
      if (!ended && action !== 'still' && (!media.matches || getRamActionDuration(action) !== null)) request = requestAnimationFrame(paint)
    }
    const resume = () => { cancelAnimationFrame(request); last = 0; previous = ''; if (source) request = requestAnimationFrame(paint) }
    Promise.all([getTintedSheet('junior',color,'seed'),fromColor?getTintedSheet('junior',fromColor,'seed'):null,getTintedSheet('seed',color,'slumber')]).then(([loaded,old,sleep])=>{if(!cancelled){source=loaded;oldSource=old;slumber=sleep;resume()}}).catch(()=>{})
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume);canvas.addEventListener('ram-wardrobe-change',resume)
    return () => { soundClock.stop();cancelled = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume);canvas.removeEventListener('ram-wardrobe-change',resume) }
  }, [color, fromColor, action, actionId, itemMotion, startedAt])
  return <canvas ref={ref} width={96} height={99} className="seed-body-frame" aria-hidden="true" data-form="seed" data-color={color}/>
}
function ItemCue({ motion }: { motion: ItemMotion }) {
  const clean = motion.body === 'wash'
  return <span className={`ram-item-cue gesture-${motion.gesture}`} style={{ color: motion.accent }} aria-hidden="true" data-item-id={motion.itemId} data-item-gesture={motion.gesture}>
    {motion.gesture === 'bath' && <img className="ram-care-tub" src="./assets/original/item-motion/bath-tub.png" alt="" draggable={false}/>}
    <img className={`ram-care-item ${motion.gesture === 'brush' ? 'ram-care-toothpaste' : ''}`} src={motion.image} alt="" draggable={false}/>
    {motion.gesture === 'brush' && <img className="ram-care-brush" src="./assets/original/item-motion/toothbrush-generated.png" alt="" draggable={false}/>}
    {(clean || motion.gesture === 'fizz' || motion.gesture === 'medicine' || motion.gesture === 'recolor' || motion.gesture === 'glow' || motion.gesture === 'crunch' || motion.gesture === 'pour-beans') && <span className="ram-care-particles">{Array.from({ length: clean ? 6 : 3 }, (_, index) => <i key={index}>{motion.gesture==='recolor'&&<img src="./assets/generated/v12-dizzy-star.png" alt="" draggable={false}/>}</i>)}</span>}
    {motion.gesture === 'stretch' && <span className="ram-care-soft-puff"/>}
    {motion.gesture === 'peel' && <img className="ram-care-peel" src={motion.image} alt="" draggable={false}/>}
  </span>
}
export default function Ram({ color, costume, stage, evolution, action = 'idle', sleeping = false, peeking = false, peekSide = 'right', edgeEntry, fromColor, sound = false, className = '', actionId, itemId, gaze, dragTilt = 0, dragging = false, shaking = false, onActionEnd }: RamProps) {
  const clock=useRef({key:'',startedAt:0})
  const playClock=useRef<{key:string;began:number|undefined;lastAudioElapsed?:number}>({key:'',began:undefined})
  const eventKey=`${action}:${actionId??0}:${itemId??''}`
  if(clock.current.key!==eventKey)clock.current={key:eventKey,startedAt:performance.now()}
  if(playClock.current.key!==eventKey)playClock.current={key:eventKey,began:undefined}
  const form: Form = stage === 4 ? evolution ?? 'super' : stage <= 1 ? 'junior' : stage === 2 ? 'middle' : 'senior'
  const itemRecipe = itemId ? getItemMotion(itemId) : getItemMotionByAction(action)
  const itemMotion = itemRecipe?.itemId && (getItemMotionByAction(action) || ['feed', 'eat', 'drink', 'wash', 'medical', 'use'].includes(action)) && !sleeping && action !== 'sleep' && !dragging ? itemRecipe : undefined
  const activeAction = sleeping || action === 'sleep' ? 'sleep' : shaking ? 'dizzy' : dragging ? 'drag' : itemMotion ? itemMotion.action : action
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
  const label = `${COLOR_NAMES[color]}${['种子期', '初级', '中级', '高级', '神力'][stage]}拉姆，${stage === 0 ? '花盆可以拖动，' : ''}${itemMotion?.label ?? ACTION_NAMES[activeAction] ?? ACTION_NAMES.idle}`
  return <span className={`ram-sprite ram-classic action-${activeAction} ${stage === 0 ? 'ram-seed' : stage <= 2 ? 'ram-grounded' : ''} ${resting ? 'is-sleeping' : ''} ${stage >= 3 && activeAction !== 'still' && !dragging ? 'is-flying' : ''} ${peeking ? 'is-peeking' : ''} ${edgeEntry ? 'is-edge-entering' : ''} ${dragging ? 'is-dragging' : ''} ${shaking ? 'is-shaking' : ''} ${className}`}
    role="img" aria-label={label} data-art-style="classic" data-stage={stage} data-evolution={evolution} data-action={activeAction} data-color={color} data-sleeping={resting ? 'true' : 'false'} data-peek-side={peeking ? peekSide : undefined} data-edge-entry={edgeEntry} data-fallback={fallback || undefined}>
    <span className="ram-flight-layer">
    {stage === 0 ? <><img className="seed-pot-original" src="./assets/original/seed/pot.png" alt="" draggable={false}/><span className="seed-body-original" style={{ transform: `${seedPeek}rotate(${resting ? 0 : tilt}deg)` }}><span className="ram-pose-layer"><SeedBody startedAt={clock.current.startedAt} color={color} fromColor={fromColor} sound={sound} action={activeAction} actionId={actionId} itemMotion={itemMotion} onActionEnd={onActionEnd}/><RamWear costume={costume}/></span></span></>
      : <span className="ram-artwork" style={{ transform: `translateY(${bottomPeek}%) rotate(${tilt}deg) translateY(${dragging ? '-2px' : '0'})` }}><span className="ram-pose-layer">
        {fallback ? <img className="ram-original-static" src={`./assets/original/pets/${form}-${color}-idle.png`} alt="" draggable={false}/> : isEmotionClip(activeAction)?<EmotionFrames form={form} color={color} action={activeAction} actionId={actionId} performanceClock={playClock} onActionEnd={onActionEnd} onError={()=>setFailedKey(key)}/>:activeAction==='play'?<FootballFrames form={form} color={color} actionId={actionId} sound={sound} startedAt={clock.current.startedAt} performanceClock={playClock} onActionEnd={onActionEnd} onError={()=>setFailedKey(key)}/>:<ClassicFrames gaze={gaze} startedAt={clock.current.startedAt} form={form} color={color} fromColor={fromColor} sound={sound} action={activeAction} actionId={actionId} itemMotion={itemMotion} onActionEnd={onActionEnd} onError={() => setFailedKey(key)}/>}<RamWear costume={costume}/>
      </span></span>}
    <SocialCue key={`${activeAction}:${actionId ?? 0}`} action={activeAction} originalFootball={stage>0&&activeAction==='play'}/>
    {resting && <span className="ram-sleep-particles" style={{left:`${mouth[0]}%`,top:`${mouth[1]}%`}} aria-hidden="true">{[0,1,2].map(i=><img key={i} src="./assets/original/slumber/z.png" alt="" draggable={false} style={{animationDelay:`${-i*6.4/3}s`}}/>)}</span>}
    {itemMotion && <ItemCue key={`${itemMotion.itemId}:${actionId ?? ''}`} motion={itemMotion}/>}
    </span>
  </span>
}

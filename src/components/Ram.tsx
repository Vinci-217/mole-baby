import { useEffect, useRef, useState } from 'react'
import type { PetColor, Stage } from '../game'
import { getItemMotion, getItemMotionByAction, getItemMouthAnchor, sampleItemMotion, type ItemMotion } from '../item-motion'
import './Ram.css'
import { CARE_COLUMNS, CARE_ROWS, getRamActionDuration, sampleRamPose, sampleSeedPose } from './ram-animation'

interface RamProps {
  color: PetColor
  stage: Stage
  action?: string
  sleeping?: boolean
  className?: string
  /** Compatibility only: every rendering path uses original game artwork. */
  artStyle?: 'classic' | 'hd'
  actionId?: number | string
  /** The exact consumed item, retained for the whole finite care animation. */
  itemId?: string
  dragTilt?: number
  dragging?: boolean
  shaking?: boolean
  onActionEnd?: () => void
}
type Form = 'junior' | 'middle' | 'senior'
type SheetKind = 'classic' | 'care' | 'seed' | 'item'
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
const ACTION_NAMES: Record<string, string> = {
  idle: '正在陪伴你', 'walk-right': '向右走', 'running-right': '向右走',
  'walk-left': '向左走', 'running-left': '向左走', pet: '开心地打招呼',
  waving: '正在打招呼', feed: '开心地吃东西', eat: '开心地吃东西', drink: '正在喝水',
  wash: '正在洗澡', medical: '正在接受照料', use: '正在接受照料',
  sad: '有点难过', failed: '有点难过', sick: '有些不舒服', hungry: '肚子饿了',
  thirsty: '有些口渴', dirty: '需要清洁', tired: '有点困了',
  sleep: '闭着眼睛睡觉，点击休息按钮可唤醒', wake: '慢慢醒来了', waiting: '安静地等你',
  drag: '被轻轻提起来了', running: '正在活动', play: '开心地玩耍', happy: '很开心', reward: '很开心', review: '很开心',
  peek: '从角落探出头看你', hide: '在角落安静地陪伴',
}
function sheetSpec(form: Form, kind: SheetKind) {
  if (kind === 'seed') return { width: 96 * 8, height: 99 * 8, neutral: './assets/original/seed/body.png', mask: './assets/original/seed/body-mask.png' }
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
  const key = kind === 'seed' ? `seed:${color}` : `${kind}:${form}:${color}`
  const cached = tintedCache.get(key)
  if (cached) return cached
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
    return canvas
  }).catch((error: unknown) => { tintedCache.delete(key); throw error })
  // Keep old colour previews from retaining an unlimited number of large
  // canvases after repeated pet imports. Mounted components hold their own copy.
  if (tintedCache.size >= 18) tintedCache.delete(tintedCache.keys().next().value!)
  tintedCache.set(key, pending)
  return pending
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
function ClassicFrames({ form, color, action, actionId, itemMotion, onError, onActionEnd }: {
  form: Form; color: PetColor; action: string; actionId?: string | number;
  itemMotion?: ItemMotion;
  onError: () => void; onActionEnd?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const errorRef = useRef(onError); errorRef.current = onError
  const endRef = useRef(onActionEnd); endRef.current = onActionEnd
  const [ready, setReady] = useState<{ key: string; classic: HTMLCanvasElement; care: HTMLCanvasElement; item: HTMLCanvasElement } | null>(null)
  const key = `${form}:${color}`
  const sheets = ready?.key === key ? ready : null
  useEffect(() => {
    let cancelled = false
    Promise.all([getTintedSheet(form, color, 'classic'), getTintedSheet(form, color, 'care'), getTintedSheet(form, color, 'item')]).then(([classic, care, item]) => { if (!cancelled) setReady({ key, classic, care, item }) }).catch(() => { if (!cancelled) errorRef.current() })
    return () => { cancelled = true }
  }, [form, color, key])
  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext('2d')
    if (!canvas || !context || !sheets) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0, elapsed = 0, last = 0, inView = true, ended = false, stopped = false, previous = ''
    const paint = (now: number) => {
      if (stopped || document.hidden || !inView) { last = 0; return }
      if (last && now - last < 250) elapsed += now - last
      last = now
      const pose = sampleRamPose(action, elapsed, media.matches)
      paintItemCue(canvas, itemMotion, elapsed, media.matches)
      const signature = `${pose.sheet ?? 'classic'}:${pose.row}:${pose.frame}`
      if (signature !== previous) {
        context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
        context.drawImage(pose.sheet === 'care' ? sheets.care : pose.sheet === 'item' ? sheets.item : sheets.classic, pose.frame * CELL_WIDTH, pose.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT)
        canvas.dataset.row = String(pose.row); canvas.dataset.frame = String(pose.frame); canvas.dataset.sheet = pose.sheet ?? 'classic'; canvas.dataset.loaded = 'true'; previous = signature
      }
      if (pose.finished && !ended) { ended = true; endRef.current?.() }
      if (!ended && action !== 'still' && action !== 'sleep' && (!media.matches || getRamActionDuration(action) !== null)) request = requestAnimationFrame(paint)
    }
    const resume = () => { cancelAnimationFrame(request); last = 0; previous = ''; request = requestAnimationFrame(paint) }
    const observer = new IntersectionObserver(entries => { inView = entries.some(e => e.isIntersecting); resume() })
    observer.observe(canvas); resume()
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume)
    return () => { stopped = true; cancelAnimationFrame(request); observer.disconnect(); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume) }
  }, [sheets, action, actionId, itemMotion])
  return <canvas ref={canvasRef} className="ram-classic-frame" width={192} height={208} aria-hidden="true" data-form={form} data-color={color}/>
}
function SeedBody({ color, action, actionId, itemMotion, onActionEnd }: { color: PetColor; action: string; actionId?: string | number; itemMotion?: ItemMotion; onActionEnd?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const endRef = useRef(onActionEnd); endRef.current = onActionEnd
  useEffect(() => {
    let cancelled = false, request = 0, elapsed = 0, last = 0, previous = -1, ended = false
    let source: HTMLCanvasElement | null = null
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = (now: number) => {
      if (cancelled || !source || document.hidden) { last = 0; return }
      if (last && now - last < 250) elapsed += now - last
      last = now
      const pose = sampleSeedPose(action, elapsed, media.matches)
      if (ref.current) paintItemCue(ref.current, itemMotion, elapsed, media.matches)
      if (previous !== pose.frame) {
        const c = ref.current?.getContext('2d')
        c?.clearRect(0, 0, 96, 99); c?.drawImage(source, pose.frame % 8 * 96, Math.floor(pose.frame / 8) * 99, 96, 99, 0, 0, 96, 99)
        if (ref.current) { ref.current.dataset.loaded = 'true'; ref.current.dataset.frame = String(pose.frame) }
        previous = pose.frame
      }
      if (pose.finished && !ended) { ended = true; endRef.current?.() }
      if (!ended && action !== 'still' && action !== 'sleep' && (!media.matches || getRamActionDuration(action) !== null)) request = requestAnimationFrame(paint)
    }
    const resume = () => { cancelAnimationFrame(request); last = 0; previous = -1; if (source) request = requestAnimationFrame(paint) }
    getTintedSheet('junior', color, 'seed').then(loaded => { if (!cancelled) { source = loaded; resume() } }).catch(() => {})
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume)
    return () => { cancelled = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume) }
  }, [color, action, actionId, itemMotion])
  return <canvas ref={ref} width={96} height={99} className="seed-body-frame" aria-hidden="true" data-form="seed" data-color={color}/>
}
function ItemCue({ motion }: { motion: ItemMotion }) {
  const clean = motion.body === 'wash'
  return <span className={`ram-item-cue gesture-${motion.gesture}`} style={{ color: motion.accent }} aria-hidden="true" data-item-id={motion.itemId} data-item-gesture={motion.gesture}>
    {motion.gesture === 'bath' && <img className="ram-care-tub" src="./assets/original/item-motion/bath-tub.png" alt="" draggable={false}/>}
    <img className={`ram-care-item ${motion.gesture === 'brush' ? 'ram-care-toothpaste' : ''}`} src={motion.image} alt="" draggable={false}/>
    {motion.gesture === 'brush' && <img className="ram-care-brush" src="./assets/original/item-motion/toothbrush-generated.png" alt="" draggable={false}/>}
    {(clean || motion.gesture === 'fizz' || motion.gesture === 'medicine' || motion.gesture === 'glow' || motion.gesture === 'crunch' || motion.gesture === 'pour-beans') && <span className="ram-care-particles">{Array.from({ length: clean ? 6 : 3 }, (_, index) => <i key={index}/>)}</span>}
    {motion.gesture === 'stretch' && <span className="ram-care-soft-puff"/>}
    {motion.gesture === 'peel' && <img className="ram-care-peel" src={motion.image} alt="" draggable={false}/>}
  </span>
}
export default function Ram({ color, stage, action = 'idle', sleeping = false, className = '', actionId, itemId, dragTilt = 0, dragging = false, shaking = false, onActionEnd }: RamProps) {
  const form: Form = stage <= 1 ? 'junior' : stage === 2 ? 'middle' : 'senior'
  const itemRecipe = itemId ? getItemMotion(itemId) : getItemMotionByAction(action)
  const itemMotion = itemRecipe?.itemId && (getItemMotionByAction(action) || ['feed', 'eat', 'drink', 'wash', 'medical', 'use'].includes(action)) && !sleeping && action !== 'sleep' && !dragging ? itemRecipe : undefined
  const activeAction = sleeping || action === 'sleep' ? 'sleep' : dragging && stage > 0 ? 'drag' : itemMotion ? itemMotion.action : action
  const resting = activeAction === 'sleep', key = `${form}:${color}`
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const fallback = failedKey === key
  const tilt = Math.max(-12, Math.min(12, dragTilt))
  const label = `${COLOR_NAMES[color]}${['种子期', '初级', '中级', '高级'][stage]}拉姆，${stage === 0 ? '花盆固定，' : ''}${itemMotion?.label ?? ACTION_NAMES[activeAction] ?? ACTION_NAMES.idle}`
  return <span className={`ram-sprite ram-classic action-${activeAction} ${stage === 0 ? 'ram-seed' : ''} ${resting ? 'is-sleeping' : ''} ${dragging ? 'is-dragging' : ''} ${shaking ? 'is-shaking' : ''} ${className}`}
    role="img" aria-label={label} data-art-style="classic" data-stage={stage} data-action={activeAction} data-color={color} data-sleeping={resting ? 'true' : 'false'} data-fallback={fallback || undefined}>
    {stage === 0 ? <><img className="seed-pot-original" src="./assets/original/seed/pot.png" alt="" draggable={false}/><span className="seed-body-original" style={{ transform: `rotate(${tilt}deg)` }}><span className="ram-pose-layer"><SeedBody color={color} action={activeAction} actionId={actionId} itemMotion={itemMotion} onActionEnd={onActionEnd}/></span></span></>
      : <span className="ram-artwork" style={{ transform: `rotate(${tilt}deg) translateY(${dragging ? '-2px' : '0'})` }}><span className="ram-pose-layer">
        {fallback ? <img className="ram-original-static" src={`./assets/original/pets/${form}-${color}-idle.png`} alt="" draggable={false}/> : <ClassicFrames form={form} color={color} action={activeAction} actionId={actionId} itemMotion={itemMotion} onActionEnd={onActionEnd} onError={() => setFailedKey(key)}/>}
      </span></span>}
    {resting && <span className="ram-sleep-mark" aria-hidden="true">z<span>z</span></span>}
    {itemMotion && <ItemCue key={`${itemMotion.itemId}:${actionId ?? ''}`} motion={itemMotion}/>}
  </span>
}

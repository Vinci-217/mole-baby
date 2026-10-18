import { useEffect, useRef, useState } from 'react'
import type { PetColor, Stage } from '../game'
import './Ram.css'
import { sampleRamPose } from './ram-animation'

interface RamProps {
  color: PetColor
  stage: Stage
  action?: string
  sleeping?: boolean
  className?: string
  /** Compatibility only: every rendering path uses original game artwork. */
  artStyle?: 'classic' | 'hd'
  actionId?: number | string
  dragTilt?: number
  dragging?: boolean
  shaking?: boolean
  onActionEnd?: () => void
}

type Form = 'junior' | 'middle' | 'senior'
interface SheetSource { neutral: ImageData; mask: Uint8ClampedArray }

const CELL_WIDTH = 192
const CELL_HEIGHT = 208
const SHEET_WIDTH = CELL_WIDTH * 8
const SHEET_HEIGHT = CELL_HEIGHT * 9
const COLOR_NAMES: Record<PetColor, string> = { pink: '粉红色', yellow: '黄色', blue: '天蓝色', red: '红色' }
const COLOR_OFFSETS: Record<PetColor, readonly number[]> = {
  red: [255, -199, -250], yellow: [0, -21, -255],
  blue: [-215, -57, 31], pink: [51, -148, 0],
}
const sourceCache = new Map<Form, Promise<SheetSource>>()
const tintedCache = new Map<string, Promise<HTMLCanvasElement>>()

const ACTION_NAMES: Record<string, string> = {
  idle: '正在陪伴你', 'walk-right': '向右走', 'running-right': '向右走',
  'walk-left': '向左走', 'running-left': '向左走', pet: '开心地打招呼',
  waving: '正在打招呼', feed: '开心地吃东西', wash: '正在浇水清洁',
  sad: '有点难过', failed: '有点难过', sleep: '正在休息', waiting: '安静地等你',
  running: '正在活动', play: '开心地玩耍', happy: '很开心', reward: '很开心', review: '很开心',
}

async function loadPng(path: string) {
  const image = new Image()
  image.src = path
  await image.decode()
  if (image.naturalWidth !== SHEET_WIDTH || image.naturalHeight !== SHEET_HEIGHT) {
    throw new Error('经典拉姆图集尺寸不正确')
  }
  return image
}

function getSource(form: Form): Promise<SheetSource> {
  const cached = sourceCache.get(form)
  if (cached) return cached
  const pending = Promise.all([
    loadPng(`./assets/classic/${form}-neutral.png`),
    loadPng(`./assets/classic/${form}-mask.png`),
  ]).then(([neutralImage, maskImage]) => {
    const canvas = document.createElement('canvas')
    canvas.width = SHEET_WIDTH
    canvas.height = SHEET_HEIGHT
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('无法初始化拉姆图片')
    context.drawImage(neutralImage, 0, 0)
    const neutral = context.getImageData(0, 0, SHEET_WIDTH, SHEET_HEIGHT)
    context.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT)
    context.drawImage(maskImage, 0, 0)
    const mask = context.getImageData(0, 0, SHEET_WIDTH, SHEET_HEIGHT).data
    return { neutral, mask }
  }).catch((error: unknown) => {
    sourceCache.delete(form)
    throw error
  })
  sourceCache.set(form, pending)
  return pending
}

/** Reproduce the original Flash additive body transform, retaining leaves and eyes.
 * The three mask channels encode coverage of the 255, 204 and 153 body fills.
 * Source/provenance: public/assets/classic/SOURCE-RECORD.md.
 */
function getTintedSheet(form: Form, color: PetColor): Promise<HTMLCanvasElement> {
  const key = `${form}:${color}`
  const cached = tintedCache.get(key)
  if (cached) return cached
  const pending = getSource(form).then(({ neutral, mask }) => {
    const canvas = document.createElement('canvas')
    canvas.width = SHEET_WIDTH
    canvas.height = SHEET_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法初始化拉姆配色')
    const pixels = new ImageData(new Uint8ClampedArray(neutral.data), SHEET_WIDTH, SHEET_HEIGHT)
    const clamp = (value: number) => Math.max(0, Math.min(255, value))
    const deltas = [255, 204, 153].map(base => COLOR_OFFSETS[color].map(offset => clamp(base + offset) - base))
    for (let index = 0; index < pixels.data.length; index += 4) {
      const white = mask[index] / 255
      const gray = mask[index + 1] / 255
      const dark = mask[index + 2] / 255
      if (!(white || gray || dark)) continue
      for (let channel = 0; channel < 3; channel++) {
        pixels.data[index + channel] = clamp(pixels.data[index + channel]
          + deltas[0][channel] * white + deltas[1][channel] * gray + deltas[2][channel] * dark)
      }
    }
    context.putImageData(pixels, 0, 0)
    return canvas
  }).catch((error: unknown) => {
    tintedCache.delete(key)
    throw error
  })
  tintedCache.set(key, pending)
  return pending
}

function ClassicFrames({ form, color, action, actionId, onError, onActionEnd }: {
  form: Form; color: PetColor; action: string; actionId?: string | number;
  onError: () => void; onActionEnd?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const errorRef = useRef(onError); errorRef.current = onError
  const endRef = useRef(onActionEnd); endRef.current = onActionEnd
  const [ready, setReady] = useState<{ key: string; sheet: HTMLCanvasElement } | null>(null)
  const key = `${form}:${color}`
  const sheet = ready?.key === key ? ready.sheet : null
  useEffect(() => {
    let cancelled = false
    getTintedSheet(form, color).then(loaded => { if (!cancelled) setReady({ key, sheet: loaded }) })
      .catch(() => { if (!cancelled) errorRef.current() })
    return () => { cancelled = true }
  }, [form, color, key])
  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext('2d')
    if (!canvas || !context || !sheet) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let request = 0, elapsed = 0, last = 0, inView = true, ended = false, stopped = false
    let previous = ''
    const paint = (now: number) => {
      if (stopped || document.hidden || !inView) { last = 0; return }
      if (last && now - last < 250) elapsed += now - last
      last = now
      const pose = action === 'sleep' ? { row: 6, frame: form === 'junior' ? 4 : form === 'senior' ? 3 : 0, finished: false }
        : sampleRamPose(action, elapsed, media.matches)
      const signature = `${pose.row}:${pose.frame}`
      if (signature !== previous) {
        context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
        context.drawImage(sheet, pose.frame * CELL_WIDTH, pose.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT)
        canvas.dataset.row = String(pose.row); canvas.dataset.frame = String(pose.frame); canvas.dataset.loaded = 'true'
        previous = signature
      }
      if (pose.finished && !ended) { ended = true; endRef.current?.() }
      if (!media.matches && action !== 'still' && action !== 'sleep' && !ended) request = requestAnimationFrame(paint)
    }
    const resume = () => { cancelAnimationFrame(request); last = 0; previous = ''; request = requestAnimationFrame(paint) }
    const observer = new IntersectionObserver(entries => { inView = entries.some(e => e.isIntersecting); resume() })
    observer.observe(canvas); resume()
    document.addEventListener('visibilitychange', resume); media.addEventListener('change', resume)
    return () => { stopped = true; cancelAnimationFrame(request); observer.disconnect(); document.removeEventListener('visibilitychange', resume); media.removeEventListener('change', resume) }
  }, [sheet, form, action, actionId])
  return <canvas ref={canvasRef} className="ram-classic-frame" width={192} height={208} aria-hidden="true" data-form={form} data-color={color}/>
}

function SeedBody({ action, actionId }: { action: string; actionId?: string | number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false, request = 0, elapsed = 0, last = 0, previous = -1
    const source = new Image(); source.src = './assets/original/seed/body.png'
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = (now: number) => {
      if (cancelled) return
      if (last && now - last < 250 && !document.hidden) elapsed += now - last
      last = now
      const phase = elapsed % 9000
      const active = action !== 'idle' && action !== 'still' && action !== 'sleep'
      const frame = media.matches || action === 'still' || action === 'sleep' ? 0 : active ? Math.min(60, Math.floor(elapsed / 42)) : phase < 6000 ? 0 : Math.min(60, Math.floor((phase - 6000) / 42))
      if (previous !== frame) {
        const c = ref.current?.getContext('2d')
        c?.clearRect(0, 0, 96, 99); c?.drawImage(source, frame % 8 * 96, Math.floor(frame / 8) * 99, 96, 99, 0, 0, 96, 99)
        if (ref.current) ref.current.dataset.loaded = 'true'
        previous = frame
      }
      if (!media.matches && !document.hidden) request = requestAnimationFrame(paint)
    }
    const resume = () => { cancelAnimationFrame(request); last = 0; if (source.complete && source.naturalWidth) request = requestAnimationFrame(paint) }
    source.decode().then(resume).catch(() => {})
    document.addEventListener('visibilitychange', resume)
    return () => { cancelled = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', resume) }
  }, [action, actionId])
  return <canvas ref={ref} width={96} height={99} className="seed-body-frame" aria-hidden="true" data-form="seed"/>
}

export default function Ram({ color, stage, action = 'idle', sleeping = false, className = '', actionId, dragTilt = 0, dragging = false, shaking = false, onActionEnd }: RamProps) {
  const form: Form = stage <= 1 ? 'junior' : stage === 2 ? 'middle' : 'senior'
  const activeAction = sleeping ? 'sleep' : action
  const key = `${form}:${color}`
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const fallback = failedKey === key
  const tilt = Math.max(-12, Math.min(12, dragTilt))
  const label = `${COLOR_NAMES[color]}${['种子期', '初级', '中级', '高级'][stage]}拉姆，${stage === 0 ? '花盆固定，身体轻轻摆动' : ACTION_NAMES[activeAction] ?? ACTION_NAMES.idle}`
  return <span className={`ram-sprite ram-classic action-${activeAction} ${stage === 0 ? 'ram-seed' : ''} ${sleeping ? 'is-sleeping' : ''} ${dragging ? 'is-dragging' : ''} ${shaking ? 'is-shaking' : ''} ${className}`}
    role="img" aria-label={label} data-art-style="classic" data-stage={stage} data-fallback={fallback || undefined}>
    {stage === 0 ? <><img className="seed-pot-original" src="./assets/original/seed/pot.png" alt="" draggable={false}/><span className="seed-body-original" style={{ transform: `rotate(${tilt}deg)` }}><SeedBody action={activeAction} actionId={actionId}/></span></>
      : <span className="ram-artwork" style={{ transform: `rotate(${tilt}deg) translateY(${dragging ? '-2px' : '0'})` }}>
        {fallback ? <img className="ram-original-static" src={`./assets/original/pets/${form}-${color}-idle.png`} alt="" draggable={false}/> : <ClassicFrames form={form} color={color} action={dragging ? 'drag' : activeAction} actionId={actionId} onActionEnd={onActionEnd} onError={() => setFailedKey(key)}/>}
      </span>}
    {sleeping && <span className="ram-sleep-mark" aria-hidden="true">z<span>z</span></span>}
  </span>
}

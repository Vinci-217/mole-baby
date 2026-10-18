import { useEffect, useRef, useState } from 'react'
import type { PetColor, Stage } from '../game'
import './Ram.css'

interface RamProps {
  color: PetColor
  stage: Stage
  action?: string
  sleeping?: boolean
  className?: string
  /** Compatibility only: every rendering path uses original game artwork. */
  artStyle?: 'classic' | 'hd'
}

type Form = 'junior' | 'middle' | 'senior'
interface Clip { row: number; frames: number; delay: number; still?: number }
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

const clips: Record<string, Clip> = {
  idle: { row: 0, frames: 6, delay: 300 },
  'walk-right': { row: 1, frames: 8, delay: 140 },
  'running-right': { row: 1, frames: 8, delay: 140 },
  'walk-left': { row: 2, frames: 8, delay: 140 },
  'running-left': { row: 2, frames: 8, delay: 140 },
  pet: { row: 3, frames: 4, delay: 140 },
  waving: { row: 3, frames: 4, delay: 140 },
  feed: { row: 3, frames: 4, delay: 140 },
  wash: { row: 4, frames: 5, delay: 140 },
  sad: { row: 5, frames: 8, delay: 140 },
  failed: { row: 5, frames: 8, delay: 140 },
  sleep: { row: 6, frames: 6, delay: 300, still: 2 },
  waiting: { row: 6, frames: 6, delay: 180 },
  running: { row: 7, frames: 6, delay: 140 },
  play: { row: 8, frames: 6, delay: 140 },
  happy: { row: 8, frames: 6, delay: 140 },
  reward: { row: 8, frames: 6, delay: 140 },
  review: { row: 8, frames: 6, delay: 140 },
}
// Rest uses existing waiting poses; the middle form has no closed-eye frame.
const sleepClips: Record<Form, Clip> = {
  junior: { row: 6, frames: 6, delay: 300, still: 4 },
  middle: { row: 6, frames: 6, delay: 300, still: 0 },
  senior: { row: 6, frames: 6, delay: 300, still: 3 },
}
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

function ClassicFrames({ form, color, action, onError }: {
  form: Form; color: PetColor; action: string; onError: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const errorRef = useRef(onError)
  errorRef.current = onError
  const [ready, setReady] = useState<{ key: string; sheet: HTMLCanvasElement } | null>(null)
  const key = `${form}:${color}`
  const sheet = ready?.key === key ? ready.sheet : null
  const clip = action === 'sleep' ? sleepClips[form] : clips[action] ?? clips.idle

  useEffect(() => {
    let cancelled = false
    getTintedSheet(form, color).then(loaded => {
      if (!cancelled) setReady({ key, sheet: loaded })
    }).catch(() => {
      if (!cancelled) errorRef.current()
    })
    return () => { cancelled = true }
  }, [form, color, key])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas) return
    if (!context) {
      errorRef.current()
      return
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!sheet) return
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = media.matches ? 0 : clip.still ?? 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    let inView = true
    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(sheet, frame * CELL_WIDTH, clip.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, canvas.width, canvas.height)
      canvas.dataset.row = String(clip.row)
      canvas.dataset.frame = String(frame)
      canvas.dataset.loaded = 'true'
    }
    const stop = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }
    const schedule = () => {
      stop()
      if (disposed || document.hidden || !inView || media.matches || clip.still !== undefined) return
      timer = setTimeout(() => {
        frame = (frame + 1) % clip.frames
        draw()
        schedule()
      }, clip.delay)
    }
    const motionChange = () => {
      frame = media.matches ? 0 : clip.still ?? 0
      draw()
      schedule()
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting)
      schedule()
    })
    observer?.observe(canvas)
    draw()
    schedule()
    document.addEventListener('visibilitychange', schedule)
    media.addEventListener('change', motionChange)
    return () => {
      disposed = true
      stop()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', schedule)
      media.removeEventListener('change', motionChange)
    }
  }, [sheet, clip])

  return <canvas ref={canvasRef} className="ram-classic-frame" width={384} height={416} aria-hidden="true" data-form={form} data-color={color} />
}

export default function Ram({ color, stage, action = 'idle', sleeping = false, className = '' }: RamProps) {
  const form: Form = stage <= 1 ? 'junior' : stage === 2 ? 'middle' : 'senior'
  const activeAction = sleeping ? 'sleep' : action
  const key = `${form}:${color}`
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const fallback = failedKey === key
  const label = `${COLOR_NAMES[color]}${['种子期', '初级', '中级', '高级'][stage]}拉姆，${ACTION_NAMES[activeAction] ?? ACTION_NAMES.idle}${fallback ? '，动画暂未载入，显示同源原版静态形象' : ''}`

  return (
    <span
      className={`ram-sprite ram-classic action-${activeAction} ${stage === 0 ? 'ram-seed' : ''} ${activeAction === 'sleep' ? 'is-sleeping' : ''} ${className}`.trim()}
      role="img"
      aria-label={label}
      data-art-style="classic"
      data-stage={stage}
      data-fallback={fallback || undefined}
    >
      <span className="ram-artwork">
        {fallback ? <img className="ram-original-static" src={`./assets/original/pets/${form}-${color}-idle.png`} alt="" aria-hidden="true" draggable={false} /> : <ClassicFrames form={form} color={color} action={activeAction} onError={() => setFailedKey(key)} />}
      </span>
      {activeAction === 'sleep' && <span className="ram-sleep-mark" aria-hidden="true">z<span>z</span></span>}
    </span>
  )
}

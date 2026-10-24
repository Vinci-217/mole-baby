import {useLayoutEffect,useRef} from 'react'
import {getOutfit} from '../wardrobe'

/** Raster costume playback shares the body frame clock and transform parent. */
export default function RamWear({costume}:{costume?:string}) {
  const outfit=getOutfit(costume)
  const ref=useRef<HTMLCanvasElement>(null)
  useLayoutEffect(()=>{const wear=ref.current;if(wear){wear.style.visibility='hidden';delete wear.dataset.loaded;delete wear.dataset.paint;wear.parentElement?.querySelector('canvas')?.dispatchEvent(new Event('ram-wardrobe-change'))}},[outfit?.id])
  return outfit?<canvas ref={ref} className="ram-wear" data-outfit={outfit.id} width={256} height={288} aria-hidden="true"/>:null
}

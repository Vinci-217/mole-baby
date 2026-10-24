import {useLayoutEffect,useRef} from 'react'
import {getOutfit} from '../wardrobe'

export default function RamWear({costume}:{costume?:string}) {
  const outfit=getOutfit(costume)
  const ref=useRef<HTMLImageElement>(null)
  useLayoutEffect(()=>{if(ref.current){ref.current.style.visibility='hidden';ref.current.parentElement?.querySelector('canvas')?.dispatchEvent(new Event('ram-wardrobe-change'))}},[outfit?.id])
  return outfit?<img ref={ref} className="ram-wear" data-outfit={outfit.id} src={`./assets/original/wardrobe/${outfit.id}.png`} alt="" draggable={false}/>:null
}

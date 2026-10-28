import {createElement as h, useRef} from 'react'
import type {RefObject} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import type {PetColor} from '../src/game'
import type {PetGaze} from '../src/pet-attention'

/** Uses the shipping Ram renderer, original atlases and pointer-gaze input. */
export function mountMiddleIdleReview() {
  document.getElementById('root')!.style.display='none'
  const mount=document.createElement('main');mount.id='middle-idle-review';document.body.append(mount)
  const style=document.createElement('style')
  style.textContent=`html,body{margin:0!important;min-width:0!important;min-height:0!important;background:#faf6eb!important}
    #middle-idle-review{width:640px;height:270px;display:grid;grid-template-columns:repeat(4,160px);align-content:center}
    #middle-idle-review h1{grid-column:1/-1;margin:0 0 28px;text-align:center;font:500 18px sans-serif;color:#725a40}
    #middle-idle-review figure{margin:0;display:flex;align-items:center;flex-direction:column;gap:20px}
    #middle-idle-review .pet{position:relative;width:100px;height:109px}
    #middle-idle-review figcaption{font:14px sans-serif;color:#725a40}`
  document.head.append(style)
  const gazes:RefObject<PetGaze>[]=[]
  function Pet({color}:{color:PetColor}) {
    const gaze=useRef<PetGaze>({x:0,y:0});gazes.push(gaze)
    return h('figure',{},h('div',{className:'pet'},h(Ram,{stage:2,color,action:'idle',gaze})),
      h('figcaption',{},({red:'红色',yellow:'黄色',blue:'蓝色',pink:'粉色'})[color]))
  }
  const root=createRoot(mount)
  flushSync(()=>root.render([h('h1',{key:'heading'},'两片叶子 · 安静陪伴'),...(['red','yellow','blue','pink'] as PetColor[]).map(color=>h(Pet,{key:color,color}))]))
  return {gaze(value:PetGaze){for(const gaze of gazes)gaze.current=value},
    caption(text:string){mount.querySelector('h1')!.textContent=text}}
}

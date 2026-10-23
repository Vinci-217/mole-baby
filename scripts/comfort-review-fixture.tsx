import {createElement as h} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import type {Stage,Evolution,PetColor} from '../src/game'

/** Browser-only review fixture. Import through Vite so a fresh dependency cache
 * uses the same React instance and normal CJS interop as the application. */
export function mountComfortReview(forms:[string,Stage][]) {
  document.getElementById('root')!.style.display='none'
  const mount=document.createElement('main');mount.id='motion-review';document.body.append(mount)
  const style=document.createElement('style')
  style.textContent='body{margin:0!important;background:#f7f2e6!important;min-width:0!important}#motion-review{display:grid;grid-template-columns:repeat(8,160px);width:1280px;padding-top:40px}#motion-review figure{margin:0;height:220px;display:flex;align-items:center;flex-direction:column;justify-content:center;gap:24px}#motion-review figcaption{font:13px sans-serif;color:#795b39}#motion-review .pet{width:100px;height:109px;position:relative}'
  document.head.append(style)
  const root=createRoot(mount)
  let id=0,ends=0
  return {
    render(action:string,color:PetColor='red') {
      id++;ends=0
      flushSync(()=>root.render(forms.map(([form,stage])=>h('figure',{key:form},
        h('div',{className:'pet'},h(Ram,{color,stage,evolution:stage===4?form as Evolution:undefined,action,actionId:id,onActionEnd:()=>ends++})),
        h('figcaption',{},form+' · '+action)))))
    },
    endCount:()=>ends,
  }
}

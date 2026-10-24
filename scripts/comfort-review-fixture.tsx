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
  style.textContent='html,body{margin:0!important;background:#f7f2e6!important;min-width:0!important;min-height:100vh}#motion-review{display:grid;grid-template-columns:repeat(8,160px);width:1280px;padding-top:65px}#motion-review figure{margin:0;height:220px;display:flex;align-items:center;flex-direction:column;justify-content:center;gap:35px}#motion-review figcaption{font:13px sans-serif;color:#795b39}#motion-review .pet{width:100px;height:109px;position:relative}'
  document.head.append(style)
  const root=createRoot(mount)
  let id=0,ends=0,action='idle',color:PetColor='red',overrides={}
  const paint=()=>flushSync(()=>root.render(forms.map(([form,stage])=>h('figure',{key:form},
    h('div',{className:'pet'},h(Ram,{color,stage,evolution:stage===4?form as Evolution:undefined,action,actionId:id,onActionEnd:()=>ends++,...overrides})),
    h('figcaption',{},(({seed:'种子',junior:'初级',middle:'中级',senior:'高级',super:'神力超拉',water:'水系',wood:'木系',fire:'火系'} as Record<string,string>)[form]??form)+' · '+(({idle:'陪伴',pet:'摸摸',sleep:'睡觉',wake:'醒来',play:'玩球','mood-joy':'开心','mood-grumpy':'闷闷的','mood-content':'安心','mood-dozy':'困倦'} as Record<string,string>)[action]??action))))))
  return {
    render(nextAction:string,nextColor:PetColor='red') {
      id++;ends=0;action=nextAction;color=nextColor;overrides={};paint()
    },
    refresh(value:Record<string,unknown>){overrides={...overrides,...value};paint()},
    endCount:()=>ends,
  }
}

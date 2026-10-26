import {createElement as h,useRef,useState,useLayoutEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import {useElasticDrag} from '../src/use-elastic-drag'
import type{Stage,PetColor}from'../src/game'
export function mountElasticReview({bare=false,travel=false,stages=[0,1,2,3,4] as Stage[],wide=false,color='red' as PetColor,outfit='wizard-cap'}={}){
 document.getElementById('root')!.style.display='none'
 const mount=document.createElement('main');mount.id='pull-review';document.body.append(mount)
 const style=document.createElement('style');style.textContent='html,body{margin:0!important;background:#f7f2e6!important;min-width:0!important;min-height:100vh}#pull-review{display:flex;justify-content:center;gap:35px;padding-top:85px}#pull-review figure{width:105px;margin:0;text-align:center}#pull-review .pet{width:100px;height:109px;position:relative;translate:var(--demo-x,0px) var(--demo-y,0px)}#pull-review figcaption{font:14px sans-serif;color:#795b39;margin-top:40px}#pull-review .grip{display:none;position:absolute;width:8px;height:8px;border:1.5px solid #987144;border-radius:50%;background:#fff9;top:35%;left:50%;translate:-50% -50%;box-shadow:0 0 0 3px #fff6}#pull-review[data-held=true] .grip{display:block}.pull-caption{position:absolute;top:24px;left:0;width:100%;text-align:center;font:600 17px sans-serif;color:#795b39}'
 if(wide)style.textContent+='#pull-review{gap:150px;padding-top:88px}#pull-review figure{width:120px}';document.head.append(style)
 const drivers:ReturnType<typeof useElasticDrag>[]=[]
 const run:(point:'begin'|'pull'|'end',x?:number,y?:number)=>void=(point,x=0,y=0)=>drivers.forEach(d=>{if(point==='begin')d.start({x,y,at:performance.now()},50,35);else if(point==='pull')d.sample({x,y,at:performance.now()});else d.release()})
 let held=false,position={x:0,y:0}
 const refs:{set:(value:boolean)=>void}[]=[]
 function Pet({stage}:{stage:Stage}){
  const root=useRef<HTMLElement>(null),[dragging,setDragging]=useState(false)
  const driver=useElasticDrag(root,stage,false,()=>{})
  useLayoutEffect(()=>{drivers[stage]=driver;refs[stage]={set:setDragging}})
  return h('figure',{ref:root},h('div',{className:'pet'},h(Ram,{stage,color,evolution:stage===4?'super':undefined,costume:bare?undefined:outfit,action:'idle',dragging}),h('i',{className:'grip'})),h('figcaption',{},['种子 · 花盆端正','初级 · 转身与弹性','中级 · 同步叶片','高级 · 飞行惯性','超拉 · 悬空回弹'][stage]))
 }
 const root=createRoot(mount);flushSync(()=>root.render(stages.map(stage=>h(Pet,{stage,key:stage}))))
 return {start(){held=true;mount.dataset.held='true';flushSync(()=>refs.forEach(r=>r.set(true)));run('begin',position.x,position.y)},sample(x:number,y=0){if(held){position={x,y};if(travel){mount.style.setProperty('--demo-x',`${x}px`);mount.style.setProperty('--demo-y',`${y}px`)}run('pull',x,y)}},release(){held=false;mount.dataset.held='false';flushSync(()=>refs.forEach(r=>r.set(false)));run('end')}}
}

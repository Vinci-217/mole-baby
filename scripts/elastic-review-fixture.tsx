import {createElement as h,useRef,useState,useLayoutEffect} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import {useElasticDrag} from '../src/use-elastic-drag'
import type{Stage}from'../src/game'
export function mountElasticReview(){
 document.getElementById('root')!.style.display='none'
 const mount=document.createElement('main');mount.id='pull-review';document.body.append(mount)
 const style=document.createElement('style');style.textContent='html,body{margin:0!important;background:#f7f2e6!important;min-width:0!important;min-height:100vh}#pull-review{display:flex;justify-content:center;gap:35px;padding-top:85px}#pull-review figure{width:105px;margin:0;text-align:center}#pull-review .pet{width:100px;height:109px;position:relative}#pull-review figcaption{font:14px sans-serif;color:#795b39;margin-top:40px}'
 document.head.append(style)
 const drivers:ReturnType<typeof useElasticDrag>[]=[]
 const run:(point:'begin'|'pull'|'end',x?:number,y?:number)=>void=(point,x=0,y=0)=>drivers.forEach(d=>{if(point==='begin')d.start({x,y,at:performance.now()},50,35);else if(point==='pull')d.sample({x,y,at:performance.now()});else d.release()})
 let held=false
 const refs:{set:(value:boolean)=>void}[]=[]
 function Pet({stage}:{stage:Stage}){
  const root=useRef<HTMLElement>(null),[dragging,setDragging]=useState(false)
  const driver=useElasticDrag(root,stage,false,()=>{})
  useLayoutEffect(()=>{drivers[stage]=driver;refs[stage]={set:setDragging}})
  return h('figure',{ref:root},h('div',{className:'pet'},h(Ram,{stage,color:'red',evolution:stage===4?'super':undefined,costume:'wizard-cap',action:'idle',dragging})),h('figcaption',{},['种子 · 盆栽不歪','初级 · 软软拉伸','中级 · 叶片轻晃','高级 · 飞行惯性','超拉 · 悬空回弹'][stage]))
 }
 const root=createRoot(mount);flushSync(()=>root.render(([0,1,2,3,4]as Stage[]).map(stage=>h(Pet,{stage,key:stage}))))
 return {start(){held=true;flushSync(()=>refs.forEach(r=>r.set(true)));run('begin')},sample(x:number,y=0){if(held)run('pull',x,y)},release(){held=false;flushSync(()=>refs.forEach(r=>r.set(false)));run('end')}}
}

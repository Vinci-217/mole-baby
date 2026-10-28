import {createElement as h,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import {ELEMENT_SKILLS} from '../src/element-skills'
import type {Stage,Evolution} from '../src/game'

export function mountElementGallery(box=false){
 document.getElementById('root')!.style.display='none'
 const mount=document.createElement('main');mount.id='element-gallery';document.body.append(mount)
 const style=document.createElement('style');style.textContent='html,body{margin:0!important;min-width:0!important;min-height:0!important;background:#f7f1df!important}#element-gallery{width:600px;height:1110px;display:grid;grid-template-columns:repeat(3,200px);padding-top:30px;box-sizing:border-box}#element-gallery figure{height:180px;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:19px}#element-gallery .pet{position:relative;width:100px;height:109px}#element-gallery figcaption{font:12px sans-serif;color:#795d3b}';document.head.append(style)
 if(box)style.textContent+='#element-gallery{height:220px}'
 const root=createRoot(mount);let sequence=0
 function Performance({id,stage=4,evolution='super'}:{id:string;stage?:Stage;evolution?:Evolution}){const [done,setDone]=useState(false);return h(Ram,{stage,color:'red',evolution,action:done?'idle':id==='box'?'skill-magic':`element-${id}`,sound:false,onActionEnd:()=>setDone(true)})}
 const render=()=>flushSync(()=>root.render(box?([0,2,4] as Stage[]).map(stage=>h('figure',{key:`${stage}:${sequence}`},h('div',{className:'pet'},h(Performance,{id:'box',stage,evolution:'classic'})),h('figcaption',{},['种子 · 变魔术','','双叶 · 变魔术','','经典超拉 · 变魔术'][stage]))):Array.from({length:6},(_,i)=>['fire','water','wood'].map(type=>{
  const skill=ELEMENT_SKILLS.find(s=>s.type===type&&s.level===i+1)!
  return h('figure',{key:`${skill.id}:${sequence}`},h('div',{className:'pet'},h(Performance,{id:skill.id})),h('figcaption',{},skill.name))
 })).flat()))
 render();return {restart(){sequence++;render()}}
}

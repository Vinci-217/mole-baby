/** Review fixture: uses the shipping renderer, with an unchanged 100px hit box. */
import {createElement as h} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import type {Stage, Evolution, PetColor} from '../src/game'

const forms:[string,Stage,string][]=[['seed',0,'种子'],['junior',1,'初级'],['middle',2,'中级'],['senior',3,'高级'],['super',4,'神力'],['water',4,'水系'],['wood',4,'木系'],['fire',4,'火系']]
export const REVIEW_ACTIONS=['still','sleep','pet','eat','drink','mood-dozy','mood-joy','play','drag'] as const
const labels:Record<string,string>={still:'静止',sleep:'安睡',pet:'摸摸',eat:'进食',drink:'喝水','mood-dozy':'困倦','mood-joy':'开心',play:'玩球',drag:'提起'}
export function mountProportionReview(color:PetColor='red') {
 document.getElementById('root')!.style.display='none'
 const mount=document.createElement('main');mount.id='proportion-review';document.body.append(mount)
 const style=document.createElement('style');style.textContent=`html,body{margin:0!important;min-width:0!important;min-height:0!important;background:#f7f2e6!important;overflow:hidden!important}#proportion-review{width:1024px;color:#715a3e;font-family:'Noto Sans CJK SC',sans-serif}#proportion-review h1{margin:0;height:48px;line-height:48px;font-size:17px;font-weight:500;text-align:center}#proportion-review p{margin:0;height:28px;font-size:11px;text-align:center;color:#9a8368}#proportion-review section{display:grid;grid-template-columns:repeat(8,128px)}#proportion-review figure{margin:0;box-sizing:border-box;height:180px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:15px;padding:24px 0 12px;overflow:visible}#proportion-review .pet{width:100px;height:108.333333px;position:relative;flex:none}#proportion-review figcaption{height:18px;font-size:10px;line-height:18px;text-align:center}#proportion-review .zoom figure{height:270px;padding-top:45px;gap:28px}#proportion-review .zoom .pet{width:160px;height:173.333333px}#proportion-review .zoom{grid-template-columns:repeat(4,256px)}`;document.head.append(style)
 const root=createRoot(mount);let action='still',serial=0,zoom=false,costume: string|undefined;const completed=new Set<string>()
 function render(){
  const sections=([false,true] as const).map(active=>{
   const cells=forms.map(([form,stage,name])=>h('figure',{key:form,'data-form':form,'data-active':String(active)},
    h('div',{className:'pet'},h(Ram,{stage,color,evolution:stage===4?form as Evolution:undefined,action:active&&!completed.has(form)?action:'still',onActionEnd:active?()=>{completed.add(form);render()}:undefined,actionId:serial,itemId:active&&action==='eat'?'biscuit':active&&action==='drink'?'juice':undefined,costume,sound:false,dragging:active&&action==='drag'})),
    h('figcaption',{},`${name} · ${active?labels[action]:'静止'}`)))
   return h('section',{className:zoom?'zoom':'',key:String(active)},cells)
  })
  flushSync(()=>root.render(h('div',{},
   h('h1',{},`比例复核 · ${labels[action]} · ${color}`),
   h('p',{},zoom?'放大160px · 检查眼嘴、叶柄及装扮接点':'实际100px · 上排静止基准，下排当前动作'),sections)))
 }
 render()
 return {setAction(value:string){action=value;completed.clear();serial++;render()},restart(){completed.clear();serial++;render()},setZoom(value:boolean){zoom=value;render()},setCostume(value:string|undefined){costume=value;serial++;render()},tick(elapsed:number){if(action==='drag')for(const sprite of mount.querySelectorAll<HTMLElement>('figure[data-active=true] .ram-sprite')){sprite.style.setProperty('--drag-view',String(Math.sin(elapsed/520)));sprite.style.setProperty('--drag-distance',String(elapsed/40));sprite.dispatchEvent(new Event('ram-drag-motion'))}},width:1024,get height(){return zoom?1156:436}}
}

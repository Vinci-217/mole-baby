/** Offline source compositor. Never used as an application route. */
import {createElement as h} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import type {Evolution,PetColor,Stage} from '../src/game'
export const DAILY_FORMS=['seed','junior','middle','senior','super','classic','water','wood','fire']
export const DAILY_PALETTES:PetColor[]=['#ffffff','red','blue']
export const DAILY_ACTIONS={pet:2400,focus:8000,sleep:6400,'watch-butterfly':6500,'look-around':3600,wake:1800,dizzy:3200}
export function mountDailyFrames(){
 document.getElementById('root')!.style.display='none'
 const mount=document.createElement('div');mount.id='daily-source-review';document.body.append(mount)
 const style=document.createElement('style');style.textContent='html,body{background:transparent!important;margin:0!important;min-width:0!important;min-height:0!important;overflow:hidden!important}#daily-source-review{width:1620px;height:660px;position:relative;display:grid;grid-template-columns:repeat(9,180px)}.daily-cell{width:180px;height:220px;position:relative}.daily-cell>.ram-sprite{position:absolute;left:40px;top:70px;width:100px;height:108px}';document.head.append(style)
 const root=createRoot(mount);let sequence=0
 const cells=DAILY_PALETTES.flatMap((color,row)=>DAILY_FORMS.map((form,column)=>({color,form,rect:[column*180,row*220,180,220]})))
 const show=(action:string)=>{sequence++;flushSync(()=>root.render(h('div',{style:{display:'contents'}},cells.map(c=>h('div',{className:'daily-cell',key:c.form+c.color},h(Ram,{rawDaily:true,companionId:123456,color:c.color,stage:(c.form==='seed'?0:c.form==='junior'?1:c.form==='middle'?2:c.form==='senior'?3:4)as Stage,evolution:DAILY_FORMS.indexOf(c.form)>=4?c.form as Evolution:undefined,action,sleeping:action==='sleep',actionId:sequence,sound:false}))))))}
 return {show,cells,width:1620,height:660}
}

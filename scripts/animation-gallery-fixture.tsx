/** Review-only catalogue. Every sprite is the real application Ram component. */
import {createElement as h} from 'react'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import Ram from '../src/components/Ram'
import {RAM_ACTIONS} from '../src/components/ram-animation'
import {getItemMotion} from '../src/item-motion'
import {ITEMS} from '../src/catalog'
import {OUTFITS} from '../src/wardrobe'
import {edgeEntryAction,edgeTargetOffset,type PetEdge} from '../src/edge-motion'
import type {Stage,Evolution,PetColor} from '../src/game'

const forms:[string,Stage][]=[['seed',0],['junior',1],['middle',2],['senior',3],['super',4]]
const names:Record<string,string>={seed:'种子',junior:'初级',middle:'中级',senior:'高级',super:'神力超拉',water:'水系',wood:'木系',fire:'火系'}
interface Cell {form:string;stage:Stage;action:string;label:string;itemId?:string;costume?:string;color?:PetColor;fromColor?:PetColor;side?:PetEdge;locked?:boolean}
const rows=(actions:[string,string][]):Cell[]=>actions.flatMap(([action,label])=>forms.map(([form,stage])=>({form,stage,action,label})))
const items=ITEMS.map(item=>({form:item.minStage>=3?'senior':'middle',stage:Math.max(2,item.minStage) as Stage,action:getItemMotion(item.id).action,itemId:item.id,label:item.name,color:('changesColor' in item?item.changesColor:'red') as PetColor,fromColor:item.changesColor?(item.changesColor==='red'?'blue':'red') as PetColor:undefined}))
interface GallerySpec {title:string;duration:number;cells:Cell[];columns?:number}
export const GALLERY:Record<string,GallerySpec>={
 movement:{title:'日常移动与张望',duration:7200,cells:rows([['idle','安静陪伴'],['walk-left','向左移动'],['walk-right','向右移动'],['look-around','转身张望'],['waving','打招呼']])},
 reactions:{title:'开心、接到物品、奖励与失落',duration:6400,cells:rows([['happy','开心晃晃'],['catch','接到了'],['reward','收到奖励'],['failed','没接到']])},
 sleep:{title:'安静睡觉 · 原型眼睑和小小的呼吸',duration:9400,cells:rows([['sleep','闭眼安睡 · ZZZ'],['wake','慢慢醒来'],['mood-dozy','困倦眯眼']])},
 interaction:{title:'摸摸、翻书与逗蝴蝶 · 应用内动作',duration:8200,cells:rows([['pet','摸摸'],['focus','专注翻书'],['watch-butterfly','挥网逗蝴蝶']])},
 moods:{title:'不同心情的回应',duration:10000,cells:rows([['mood-joy','开心'],['mood-grumpy','闷闷不乐'],['mood-content','安心'],['dizzy','摇晃后头晕']])},
 conditions:{title:'需要照料时的小状态',duration:8500,cells:rows([['hungry','肚子饿'],['thirsty','口渴'],['dirty','需要清洁'],['sick','不舒服'],['tired','疲倦'],['sad','难过']])},
 pastimes:{title:'自己的小日子',duration:18200,cells:rows([['read-alone','自己看书'],['play-alone','自己玩球'],['balance','顶书练平衡'],['spell','魔法变装']]).map(c=>c.action==='spell'&&c.stage<2?{...c,locked:true,label:'尚未学变身术'}:c)},
 edges:{title:'四边走入 / 藏好 / 探头 · 动作层预览',duration:7400,cells:(['left','right','top','bottom'] as PetEdge[]).flatMap(side=>forms.map(([form,stage])=>({form,stage,side,action:'waiting',label:({left:'左边',right:'右边',top:'上边',bottom:'下边'})[side]})))},
 items1:{title:'全部消耗用品 · 第一页',duration:5200,cells:items.slice(0,16),columns:4},
 items2:{title:'全部消耗用品 · 第二页',duration:5200,cells:items.slice(16),columns:4},
 wardrobe:{title:'九件装扮 · 摸摸 / 睡觉 / 看书 / 玩球',duration:14500,cells:OUTFITS.map((o,i)=>({form:'middle',stage:2 as Stage,costume:o.id,action:['pet','sleep','focus','play'][i%4],label:o.name})),columns:3},
 evolutions:{title:'四种最高形态 · 轻轻摸摸 / 闭眼安睡 / 左右飞行',duration:9400,cells:(['pet','sleep','walk-left','walk-right'] as const).flatMap(action=>(['super','water','wood','fire'] as const).map(form=>({form,stage:4 as Stage,action,label:({pet:'摸摸',sleep:'睡觉','walk-left':'向左飞','walk-right':'向右飞'})[action]}))),columns:4},
 colours:{title:'四种颜色 · 安静睡眠',duration:9400,cells:(['red','yellow','blue','pink'] as const).flatMap(color=>forms.map(([form,stage])=>({form,stage,color,action:'sleep',label:({red:'红',yellow:'黄',blue:'蓝',pink:'粉'})[color]})))},
}
GALLERY.football={title:'完整玩球 · 全部八种形态',duration:11200,columns:4,cells:[...forms,['water',4],['wood',4],['fire',4]].map(([form,stage])=>({form:form as string,stage:stage as Stage,action:'play',label:'完整足球'}))}
const seen=new Set(Object.values(GALLERY).flatMap(g=>g.cells.map(c=>c.action)))
const labels:Record<string,string>={waiting:'安静等你',still:'安静站好',drag:'被提起', 'running-left':'向左小跑','running-right':'向右小跑',running:'活动一下',peek:'探看',hide:'藏好',review:'回应一下',feed:'吃东西',eat:'吃东西',drink:'喝水',wash:'清洁',medical:'照料',use:'使用用品'}
const remaining=RAM_ACTIONS.filter(action=>action!=='drag'&&!seen.has(action))
for(let i=0;i<remaining.length;i+=4)GALLERY['remaining-'+(i/4+1)]={title:'其余现有动作 · '+(i/4+1),duration:6600,cells:rows(remaining.slice(i,i+4).map(action=>[action,labels[action]??action]))}
for(const outfit of OUTFITS)GALLERY['outfit-'+outfit.id]={title:outfit.name+' · 全部形态的摸摸回应',duration:3200,columns:4,cells:[...forms,['water',4],['wood',4],['fire',4]].map(([form,stage])=>({form:form as string,stage:stage as Stage,costume:outfit.id,action:'pet',label:outfit.name}))}
export const GALLERY_COVERAGE={actions:RAM_ACTIONS,items:ITEMS.map(item=>({id:item.id,action:getItemMotion(item.id).action})),outfits:OUTFITS.map(o=>o.id)}
export type GalleryMode=keyof typeof GALLERY
export function mountAnimationGallery(mode:GalleryMode){
 const spec=GALLERY[mode],columns=spec.columns??5
 document.getElementById('root')!.style.display='none'
 const mount=document.createElement('main');mount.id='animation-gallery';document.body.append(mount)
 const style=document.createElement('style');style.textContent=`html,body{background:#f7f2e6!important;margin:0!important;min-width:0!important;min-height:0!important;overflow:hidden!important}#animation-gallery{width:${columns*140}px;color:#795b39;font-family:'Noto Sans CJK SC',sans-serif}#animation-gallery h1{text-align:center;font-size:17px;font-weight:500;height:55px;line-height:55px;margin:0}#animation-gallery section{display:grid;grid-template-columns:repeat(${columns},140px)}#animation-gallery figure{margin:0;height:164px;display:flex;align-items:center;justify-content:flex-end;flex-direction:column;gap:3px;padding:12px 0 14px}#animation-gallery .pet{width:100px;height:109px;position:relative;flex:none}#animation-gallery figcaption{font-size:10px;line-height:17px;text-align:center;white-space:nowrap}#animation-gallery .edge-clip{position:absolute;inset:0;overflow:hidden}#animation-gallery .edge-clip .ram-sprite{position:absolute;inset:0}`;document.head.append(style)
 const root=createRoot(mount);let id=0
 function paint(phase='start'){
  flushSync(()=>root.render(h('div',{},h('h1',{},spec.title),h('section',{},spec.cells.map((c:Cell,i)=>h('figure',{key:i},h('div',{className:'pet'},h('div',{className:c.side?'edge-clip':undefined},c.locked?h('span',{className:'gallery-locked'},'成长后解锁'):h(Ram,{color:c.color??'red',stage:c.stage,evolution:c.stage===4?c.form as Evolution:undefined,action:c.side?(phase==='entry'?edgeEntryAction(c.stage,c.side):'waiting'):c.action,actionId:id,itemId:c.itemId,costume:c.costume,fromColor:c.fromColor,sound:false,peeking:!!c.side&&phase==='peek',peekSide:c.side,edgeEntry:c.side&&phase==='entry'?c.side:undefined}))),h('figcaption',{},`${names[c.form]} · ${c.label}`)))))))
 }
 paint();let lastPhase='start'
 return {spec,width:columns*140,height:55+Math.ceil(spec.cells.length/columns)*164,restart(){id++;lastPhase='start';paint()},tick(t:number){
  if(mode!=='edges')return
  const phase=t<1800?'entry':t<3500?'hidden':t<5500?'peek':'hidden'
  if(phase!==lastPhase){lastPhase=phase;id++;paint(phase)}
  spec.cells.forEach((c:Cell,i)=>{if(!c.side)return;const offset=edgeTargetOffset(c.side,phase==='peek'?'peek':'hidden',undefined,c.form),s=t<1800?(t/1800)**2*(3-2*t/1800):1
   const clip=mount.querySelectorAll<HTMLElement>('.edge-clip')[i];clip.querySelector<HTMLElement>('.ram-sprite')!.style.translate=`${offset.x*s}px ${offset.y*s}px`
  })
 }}
}

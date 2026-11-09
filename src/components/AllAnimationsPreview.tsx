import {useEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import Ram from './Ram';
import OfficialRamClip from './OfficialRamClip';
import DesktopRestaurantWork from './DesktopRestaurantWork';
import {forms,actionLabels} from './AnimationSizePreview';
import {RAM_ACTIONS,getRamActionDuration} from './ram-animation';
import {ALL_OUTFITS} from '../wardrobe';
import {OFFICIAL_CLIPS,OFFICIAL_FORM,officialOutfitForm,type OfficialClip} from '../official-clips';
import {ITEMS} from '../catalog';
import {getItemMotion} from '../item-motion';
import {createPet} from '../game';
import {beginActivity} from '../pet-school';
import type {RamForm} from '../original-actions';
import './AllAnimationsPreview.css';

export interface AnimationReviewCase{id:string;group:string;name:string;form:RamForm;action:string;outfit?:string;itemId?:string;duration:number;source?:string;kind?:string;native?:boolean}
const sourceForm=(c:OfficialClip):RamForm=>forms.find(([id])=>OFFICIAL_FORM[id]===(c.forms.includes('level101_7')?'level101_7':c.forms.includes('level4')?'level4':c.forms.includes('level2')?'level2':c.forms.find(f=>f!=='level1')??({1:'level1',2:'level2',3:'level3',4:'level4',101:'level101'}[c.level]??'level2')))?.[0]??'junior';
const kinds:Record<string,string>={care:'原版道具',school:'原版自然动作',magic:'原版魔法',skill:'原版技能',transform:'原版变身'};
const reachable=(c:OfficialClip)=>c.kind==='care'||c.kind==='magic'||c.kind==='school'&&/\/lahmMovie\/pet\d+Movie\//.test(c.path)||['skill','transform'].includes(c.kind)&&c.animated&&!c.path.includes('/tatter/');
const priorityActions=['idle','walk-left','walk-right','pet','drag','play','focus','read-alone','sleep','wake','mood-joy','dizzy'];
const orderedActions=[...priorityActions,...RAM_ACTIONS.filter(a=>!priorityActions.includes(a))];
export const ALL_ANIMATION_CASES:AnimationReviewCase[]=[
 ...[...forms].sort((a,b)=>Number(b[0]==='super')-Number(a[0]==='super')).flatMap(([form,label])=>orderedActions.map(action=>({id:`action:${form}:${action}`,group:`日常与互动 · ${label}`,name:actionLabels[action]??action,form,action,duration:Math.max(4000,(getRamActionDuration(action,form)??9000)+800),kind:'action'}))),
 ...OFFICIAL_CLIPS.filter(c=>c.kind==='outfit').flatMap(c=>{
  const outfit=ALL_OUTFITS.find(o=>o.clipId===c.id||c.path.endsWith('/'+o.sourceId+'.swf'));
  return outfit?[...new Set(forms.filter(([id])=>id!=='seed').map(([id])=>officialOutfitForm(c,id)).filter((id):id is RamForm=>!!id))].map(form=>({id:`outfit:${c.id}:${form}`,group:'全部装扮 · 正面 / 左右走 / 摸头 / 拖动',name:outfit.name,form,action:'idle',outfit:outfit.id,duration:10000,source:c.path,kind:'outfit',native:true})):[];
 }),
 ...Object.keys(kinds).flatMap(kind=>OFFICIAL_CLIPS.filter(c=>c.kind===kind&&reachable(c)).map(c=>({id:`native:${c.id}`,group:kinds[c.kind],name:c.name,form:sourceForm(c),action:`official-${c.id}`,duration:16500,source:c.path,kind:c.kind,native:true}))),
 ...ITEMS.map(item=>({id:`item:${item.id}`,group:'背包用品 · 实际使用动作',name:item.name,form:(item.minStage>=3?'senior':'middle') as RamForm,action:getItemMotion(item.id).action,itemId:item.id,duration:Math.max(5500,getItemMotion(item.id).duration+1000),kind:'item'})),
 {id:'restaurant:desktop',group:'桌面餐厅打工',name:'烹饪 → 端盘 → 送餐 → 返回',form:'junior',action:'restaurant-work',duration:24000,kind:'restaurant'},
];
const formName=(form:RamForm)=>forms.find(([id])=>id===form)?.[1]??form;
const phaseAt=(ms:number)=>ms<1400?'idle':ms<3000?'walk-left':ms<4600?'walk-right':ms<6200?'pet':ms<7400?'drag-left':ms<8600?'drag-right':'release';
type Batch={indices:number[];page:number;pages:number};
declare global{interface Window{allAnimationReview?:{cases:readonly AnimationReviewCase[];show:(batch:Batch)=>void;restart:()=>void;tick:(ms:number)=>void;overviews:()=>void;nativeIds:()=>string[]}}}
/** Read-only catalogue: the real renderer, no save or game mutation bridge. */
export default function AllAnimationsPreview(){
 const [batch,setBatch]=useState<Batch>({indices:Array.from({length:12},(_,i)=>i),page:1,pages:Math.ceil(ALL_ANIMATION_CASES.length/12)});
 const preparedNative=useRef(new Set<string>());
 const [run,setRun]=useState(0),[phase,setPhase]=useState('idle'),[failed,setFailed]=useState<string[]>([]);
 const rows=batch.indices.map(i=>ALL_ANIMATION_CASES[i]);
 const workPet=useMemo(()=>beginActivity({...createPet('预览拉姆','blue'),growth:180},'restaurant').state,[]);
 const overviews=()=>{for(const tile of document.querySelectorAll<HTMLElement>('[data-animation-case]')){
  const target=tile.querySelector<HTMLCanvasElement>('.all-animation-overview'),frame=tile.querySelector('iframe');
  const source=frame?.contentDocument?.querySelector('ruffle-player')?.shadowRoot?.querySelector('canvas')??tile.querySelector<HTMLCanvasElement>('.original-element-skill');
  const ctx=target?.getContext('2d');if(!target||!ctx||!source)continue;
  ctx.clearRect(0,0,target.width,target.height);const k=Math.min(target.width/source.width,target.height/source.height);ctx.drawImage(source,(target.width-source.width*k)/2,(target.height-source.height*k)/2,source.width*k,source.height*k);target.dataset.loaded='true';
 }};
 useEffect(()=>{
  window.allAnimationReview={cases:ALL_ANIMATION_CASES,show:value=>flushSync(()=>{preparedNative.current.clear();setBatch(value);setRun(0);setPhase('idle');setFailed([])}),restart:()=>{for(const tile of document.querySelectorAll<HTMLElement>('[data-animation-case]:has(iframe)'))preparedNative.current.add(tile.dataset.animationCase!);flushSync(()=>setRun(n=>n+1))},tick:ms=>flushSync(()=>setPhase(phaseAt(ms))),overviews,nativeIds:()=>[...document.querySelectorAll<HTMLElement>('[data-animation-case]:has(iframe)')].map(n=>n.dataset.animationCase!)};
  return()=>{delete window.allAnimationReview};
 },[]);
 useEffect(()=>{let request=0;const draw=()=>{overviews();request=requestAnimationFrame(draw)};request=requestAnimationFrame(draw);return()=>cancelAnimationFrame(request)},[]);
 return <main className="all-animation-review"><header><h1>拉姆 · 全部动画总览</h1><span>第 {batch.page} / {batch.pages} 页 · {ALL_ANIMATION_CASES.length} 组</span><p>{rows[0]?.group} · 原播放速度 · 原片全景见右上角</p><nav><button disabled={batch.page<=1} onClick={()=>setBatch(b=>({...b,page:b.page-1,indices:Array.from({length:12},(_,i)=>(b.page-2)*12+i).filter(i=>i<ALL_ANIMATION_CASES.length)}))}>上一页</button><button disabled={batch.page>=batch.pages} onClick={()=>setBatch(b=>({...b,page:b.page+1,indices:Array.from({length:12},(_,i)=>b.page*12+i).filter(i=>i<ALL_ANIMATION_CASES.length)}))}>下一页</button></nav></header>
  <section>{rows.map(row=>{const spec=forms.find(([id])=>id===row.form)!;const action=row.outfit?(phase.startsWith('drag')?'drag':phase==='release'?'idle':phase):row.action;const id=row.native||preparedNative.current.has(row.id)?0:run;
   return <figure key={row.id} data-animation-case={row.id} data-failed={failed.includes(row.id)}><strong>{row.name}</strong><small>{formName(row.form)} · {row.outfit?(phase==='pet'?'摸头 · 项目适配':phase.startsWith('drag')?'拖动':actionLabels[action]??action):row.source?.split('/').slice(-2).join('/')??row.action}</small><div className="all-animation-stage">
    {row.kind==='restaurant'?<DesktopRestaurantWork pet={workPet} onView={()=>{}} onStop={()=>{}}/>:row.native&&!row.outfit?<span className="ram-sprite ram-classic"><OfficialRamClip clip={OFFICIAL_CLIPS.find(c=>'official-'+c.id===row.action)!} form={row.form} color="blue" finite sound={false} fallback={<Ram color="blue" stage={spec[2]} evolution={spec[3]} action="still"/>} onEnd={completed=>{if(completed===false)setFailed(f=>f.includes(row.id)?f:[...f,row.id])}}/></span>:<Ram color={ITEMS.find(i=>i.id===row.itemId)?.changesColor??'blue'} fromColor={row.itemId?'blue':undefined} stage={spec[2]} evolution={spec[3]} action={action} costume={row.outfit} itemId={row.itemId} actionId={`${id}:${row.outfit?phase:''}`} dragging={action==='drag'} dragTilt={phase==='drag-left'?-10:phase==='drag-right'?10:0} sound={false} onActionEnd={completed=>{if(completed===false)setFailed(f=>f.includes(row.id)?f:[...f,row.id])}}/>}
   </div><canvas className="all-animation-overview" width={88} height={95} aria-label="原片全景"/><figcaption>{row.id}</figcaption></figure>})}</section>
  <footer>全部已接入原片与角色动作；循环动作展示一轮，原版形变保留。此预览不读取或修改玩家存档。</footer>
 </main>;
}

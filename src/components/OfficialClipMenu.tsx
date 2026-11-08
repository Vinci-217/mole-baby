import {useId,useState} from 'react';
import type {ReactNode} from 'react';
import type {GameState} from '../game';
import {getStage} from '../game';
import {petActionAppearance} from '../wardrobe';
import {originalPlayTools,originalMagicActions,originalSpecialActions} from '../pet-original-actions';
import './OfficialClipMenu.css';
const tabs=[['activities','活动'],['toys','道具'],['magic','魔法']] as const;
export default function OfficialClipMenu({pet,busy,onPlay,onStop,playing,activities}:{pet:GameState;busy:boolean;onPlay:(id:string)=>void;onStop:()=>void;playing:boolean;activities:ReactNode}){
 const [tab,setTab]=useState<typeof tabs[number][0]>('activities'),id=useId(),form=petActionAppearance(pet,'play').form;
 const rows=tab==='toys'?originalPlayTools(form):tab==='magic'?[...originalMagicActions(form),...originalSpecialActions(form)]:[];
 const blocked=busy||pet.sleeping||Boolean(pet.activity)||Boolean(pet.outing)||getStage(pet.growth,pet.evolution)===0;
 return <section className="official-clip-menu" aria-label="原版互动与自然动作">
  <div className="original-menu-heading"><nav role="tablist" aria-label="一起玩耍分类">{tabs.map(([value,label],index)=><button type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-panel`} key={value} aria-selected={tab===value} tabIndex={tab===value?0:-1} onClick={()=>setTab(value)} onKeyDown={event=>{
   const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:undefined;
   if(next===undefined)return;event.preventDefault();setTab(tabs[next][0]);event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#${CSS.escape(id+'-'+tabs[next][0])}`)?.focus();
  }}>{label}</button>)}</nav>{playing&&<button type="button" className="original-stop" onClick={onStop}>停止</button>}</div>
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className={tab==='activities'?'original-activity-panel':'official-clip-grid'}>
   {tab==='activities'?activities:rows.map(row=><button type="button" key={row.id} disabled={blocked} onClick={()=>onPlay(row.clip.id)} aria-label={`播放${row.name}`} title={row.name}><img src={row.image??`./assets/original/ui/${tab==='magic'?'icon-bottle':'icon-happy'}.png`} alt="" draggable={false}/><span>{row.name}</span></button>)}
  </div>
 </section>;
}

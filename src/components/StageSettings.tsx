import {useEffect,useState} from 'react';
import {EVOLUTIONS,getStage,STAGES,type GrowthSelection,type GameState,type Stage} from '../game';
import Ram from './Ram';
import GrowthProgress from './GrowthProgress';
import ConfirmDialog from './ConfirmDialog';
import './SettingsPanel.css';

const selectionOf=(pet:GameState):GrowthSelection=>({mode:pet.growthLocked?'fixed':'auto',stage:getStage(pet.growth,pet.evolution),evolution:pet.evolution});
export default function StageSettings({pet,onChange}:{pet:GameState;onChange:(selection:GrowthSelection)=>void}){
 const current=selectionOf(pet),[draft,setDraft]=useState<GrowthSelection>(()=>selectionOf(pet)),[confirm,setConfirm]=useState(false);
 const changed=draft.mode!==current.mode||draft.stage!==current.stage||(draft.stage===4&&draft.evolution!==current.evolution);
 useEffect(()=>{setDraft(selectionOf(pet));setConfirm(false)},[pet.createdAt,pet.growthLocked,current.stage,pet.evolution]);
 const stageName=draft.stage===4?EVOLUTIONS.find(f=>f.id===draft.evolution)?.name:STAGES[draft.stage].name;
 return <section className="stage-settings settings-section" aria-label="当前成长阶段">
  <header className="settings-section-heading"><h3>当前成长阶段</h3><span className="growth-mode-badge">{pet.growthLocked?'固定形态':'自动成长'}</span></header>
  <GrowthProgress pet={pet}/>
  <div className="growth-mode-choices" role="group" aria-label="选择成长模式">
   <button type="button" aria-label="自动成长" aria-pressed={draft.mode==='auto'} onClick={()=>setDraft(d=>({...d,mode:'auto'}))}><b>自动成长</b><small>继续积累健康清醒时间</small></button>
   <button type="button" aria-label="固定形态" aria-pressed={draft.mode==='fixed'} onClick={()=>setDraft(d=>({...d,mode:'fixed'}))}><b>固定形态</b><small>暂停成长，保存已有进度</small></button>
  </div>
  <p className="settings-hint">选择起始阶段；同阶段保留进度，选择其他阶段从该阶段起点开始。点击应用并确认后生效。</p>
  <div className="stage-choices" role="group" aria-label="选择当前阶段">
   {STAGES.map((s,i)=><button key={s.name} type="button" aria-label={`切换到${s.name}`} aria-pressed={draft.stage===i} onClick={()=>setDraft(d=>({...d,stage:i as Stage,evolution:i===4?d.evolution??pet.evolution??'super':undefined}))}>
    <span className="stage-portrait"><Ram costume={pet.wearing} color={pet.color} stage={i as Stage} evolution={i===4?draft.evolution??pet.evolution??'super':undefined} action="still"/></span><b>{s.name}</b>
   </button>)}
  </div>
  {draft.stage===4&&<div className="stage-evolutions" role="group" aria-label="选择神力形态">
   {EVOLUTIONS.map(form=><button key={form.id} type="button" aria-label={`切换为${form.name}`} aria-pressed={draft.evolution===form.id} onClick={()=>setDraft(d=>({...d,evolution:form.id}))}>
    <span className="stage-portrait"><Ram costume={pet.wearing} color={pet.color} stage={4} evolution={form.id} action="still"/></span><b>{form.name}</b>
   </button>)}
  </div>}
  <div className="growth-apply"><span>{changed?'尚未应用，不会改动当前成长进度。':'当前设置已保存。'}</span><button className="game-button small" disabled={!changed} onClick={()=>setConfirm(true)}>应用成长设置</button></div>
  {confirm&&<ConfirmDialog title="确认切换成长设置？" onCancel={()=>setConfirm(false)} onConfirm={()=>{onChange(draft);setConfirm(false)}}>
   <p>成长模式：<strong>{draft.mode==='auto'?'自动成长':'固定形态'}</strong></p><p>起始阶段：<strong>{stageName}</strong></p>
   <p>{draft.stage===current.stage?'当前阶段的成长进度会保留。':'将从所选阶段的起点重新计算进度。'}{draft.mode==='fixed'?'固定期间暂停成长。':'自动成长的进度会持续保存。'}</p>
   {draft.stage!==current.stage&&(pet.activity||pet.outing)&&<p>更换阶段会结束当前课程／工作或召回外出的拉姆。</p>}
  </ConfirmDialog>}
 </section>;
}

import {petColorName} from '../pet-color';
import {useState} from 'react';
import {STAGES,getStage,getPetCondition} from '../game';
import type {GameState} from '../game';
import {getCompanionMood} from '../companion-memory';
import type {CompanionMemory} from '../companion-memory';
import Ram from './Ram';
import {StatusRules} from './PetStatus';
import './RoomPetPanel.css';
export default function RoomPetPanel({pet,memory,onRename,onWake,onMood}:{pet:GameState;memory:CompanionMemory;onRename:(name:string)=>void;onWake:()=>void;onMood:()=>void}){const[name,setName]=useState(pet.name),[rules,setRules]=useState(false),stage=getStage(pet.growth,pet.evolution),mood=getCompanionMood(memory,pet);return <section className="room-pet-profile"><div className="room-pet-card"><div className="room-pet-portrait"><Ram color={pet.color} stage={stage} evolution={pet.evolution} costume={pet.wearing} sleeping={pet.sleeping}/></div><div><form onSubmit={e=>{e.preventDefault();onRename(name)}}><input aria-label="拉姆的新名字" value={name} maxLength={16} onChange={e=>setName(e.target.value)}/><button className="game-button small">保存</button></form><p>{STAGES[stage].name} · {petColorName(pet.color)}</p><p>{new Date(pet.createdAt).toLocaleDateString('zh-CN')} 领养</p><span>{getPetCondition(pet).label} · {mood.relationship}</span></div></div><div className="room-pet-stats">{([['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],['happiness','心情'],['health','健康'],['energy','精力']] as const).map(([key,label])=><label key={key}><span>{label}</span><progress max={100} value={pet.stats[key]}/><b>{Math.round(pet.stats[key])}</b></label>)}</div><div className="room-status-help"><button className="game-button small" aria-label="状态值变化规则" aria-pressed={rules} onClick={()=>setRules(v=>!v)}>状态值变化规则 ?</button>{rules&&<StatusRules/>}</div><button className="game-button small" onClick={pet.sleeping?onWake:onMood}>{pet.sleeping?'叫醒拉姆':'看看我的心情'}</button></section>}

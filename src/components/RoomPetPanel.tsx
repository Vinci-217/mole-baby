import {useState, type ReactNode} from 'react';
import {petColorName} from '../pet-color';
import {STAGES,getStage,getPetCondition} from '../game';
import type {GameState} from '../game';
import {getCompanionMood} from '../companion-memory';
import type {CompanionMemory} from '../companion-memory';
import {StatusRules,StatusHistory} from './PetStatus';
import './RoomPetPanel.css';

interface Props {
  pet: GameState;
  memory: CompanionMemory;
  portrait: ReactNode;
  onRename: (name: string) => void;
  onWake: () => void;
  onMood: () => string | undefined;
  moodBusy: boolean;
}

export default function RoomPetPanel({pet,memory,portrait,onRename,onWake,onMood,moodBusy}: Props) {
  const [name,setName] = useState(pet.name);
  const [rules,setRules] = useState(false);
  const [reply,setReply] = useState('');
  const stage = getStage(pet.growth,pet.evolution);
  const mood = getCompanionMood(memory,pet);

  return <section className="room-pet-profile">
    <div className="room-pet-card">
      <div className="room-pet-portrait">{portrait}</div>
      <div>
        <form onSubmit={e=>{e.preventDefault();onRename(name)}}>
          <input aria-label="拉姆的新名字" value={name} maxLength={16} onChange={e=>setName(e.target.value)}/>
          <button className="game-button small">保存</button>
        </form>
        <p>{STAGES[stage].name} · {petColorName(pet.color)}</p>
        <p>{new Date(pet.createdAt).toLocaleDateString('zh-CN')} 领养</p>
        <span>{getPetCondition(pet).label} · {mood.relationship}</span>
        <div className="room-pet-mood-action">
          {pet.sleeping
            ? <button type="button" className="game-button small" onClick={onWake}>叫醒拉姆</button>
            : <button type="button" className="game-button small" disabled={moodBusy}
                onClick={()=>{const next=onMood();if(next)setReply(next)}}>回应心情</button>}
        </div>
      </div>
    </div>
    <div role="status" className="room-pet-mood-reply">{reply}</div>
    <div className="room-pet-stats">
      {([['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],['happiness','心情'],['health','健康'],['energy','精力']] as const)
        .map(([key,label])=><label key={key}><span>{label}</span><progress max={100} value={pet.stats[key]}/><b>{Math.round(pet.stats[key])}</b></label>)}
    </div>
    <div className="room-status-help">
      <button className="game-button small" aria-label="状态值变化规则" aria-pressed={rules} onClick={()=>setRules(v=>!v)}>状态值变化规则 ?</button>
      {rules&&<StatusRules/>}
    </div>
    <StatusHistory pet={pet}/>
  </section>;
}

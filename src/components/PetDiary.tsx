import {getDiary,type CompanionMemory} from '../companion-memory';
import './PetDiary.css';

export default function PetDiary({memory}:{memory:CompanionMemory}){
 const days=getDiary(memory).slice().reverse();
 const timers=memory.events.filter(e=>e.kind==='focus-timer'||e.kind==='reminder').slice().reverse();
 return <div className="diary-sections">
  <section className="pet-diary" aria-label="照料回忆"><details open>
   <summary><h3>我们的小日子</h3><span>{days.length} 天的回忆</span></summary>
   {days.length?days.map(day=><article key={day.day}><time>{day.day}</time><ul>{day.moments.map((text,i)=><li key={i}>{text}</li>)}</ul></article>):<p>喂喂饭、玩玩球，小小的日子都会记在这里。</p>}
  </details></section>
  <section className="pet-diary timer-history" aria-label="计时记录"><details open>
   <summary><h3>计时记录</h3><span>{timers.length} 条记录</span></summary>
   {timers.length?timers.map(event=><article key={event.id}><time>{new Date(event.at).toLocaleString('zh-CN')}</time><p>{event.detail}</p></article>):<p>完成或手动结束的计时会记在这里。</p>}
  </details></section>
 </div>;
}

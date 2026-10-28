import type {GameState} from '../game';
import {growthProgress,growthTimeLabel} from '../growth-progress';

export default function GrowthProgress({pet}:{pet:GameState}){
 const p=growthProgress(pet);
 return <section className="growth-progress" aria-label="成长进度">
  <div><strong>{p.complete?'本阶段成长已完成':`成长为${p.next!.name}`}</strong><b>{p.percent.toFixed(1)}%</b></div>
  <progress aria-label="当前阶段成长进度" max={100} value={p.percent}/>
  {p.complete?<p>{pet.evolution?'已到达最终阶段。':'可在成长页面选择神力形态。'}</p>:<p>还需约 <strong>{growthTimeLabel(p.remainingHours)}</strong> 健康清醒时间。</p>}
  {p.paused&&<p role="status">{p.paused}</p>}
  <small>进度自动保存；睡眠、饱食／水分／心情不足、清洁或精力不足时暂停。</small>
 </section>;
}

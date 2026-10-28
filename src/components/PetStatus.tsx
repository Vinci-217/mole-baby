import {WAKE_ENERGY,type GameState} from '../game';
import {NEED_RATES,STATUS_FIELDS,HEALTH_RECOVERY_PER_HOUR,HEALTH_LOSS_PER_HOUR} from '../pet-status';

export function StatusValues({pet}:{pet:GameState}){
 return <div className="pocket-status" aria-label="拉姆状态">{STATUS_FIELDS.map(([key,label])=><label key={key}><span>{label}</span><progress max={100} value={pet.stats[key]}/><b>{Math.round(pet.stats[key])}</b></label>)}</div>;
}
export function StatusRules(){
 return <section className="pocket-rules" aria-label="状态值变化规则"><h3>状态值怎样变化？</h3><p>所有数值为 0～100，按实际经过的时间变化。</p><table><thead><tr><th>每小时</th><th>醒着</th><th>睡觉</th></tr></thead><tbody>{STATUS_FIELDS.filter(([key])=>key!=='health').map(([key,label])=><tr key={key}><th>{label}</th><td>−{NEED_RATES.awake[key as keyof typeof NEED_RATES.awake]}</td><td>{key==='energy'?'+':'−'}{Math.abs(NEED_RATES.asleep[key as keyof typeof NEED_RATES.asleep])}</td></tr>)}</tbody></table><p>饱食、水分、清洁都不低于 20 时，健康每小时 +{HEALTH_RECOVERY_PER_HOUR}；其中一项不足时每小时 −{HEALTH_LOSS_PER_HOUR}，最低为 1。</p><p>食物、饮品、清洁用品和药水按物品标注恢复；满值部分不累积。离线最多结算 24 小时。睡眠每分钟恢复 {Math.abs(NEED_RATES.asleep.energy)/60} 点精力，精力达到 {WAKE_ENERGY} 后自然醒来；也可以手动叫醒。</p></section>;
}

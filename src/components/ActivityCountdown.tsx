import {useEffect,useState} from 'react'
import {activityName,type PetActivity} from '../pet-school'

export default function ActivityCountdown({activity}:{activity:PetActivity}){
 const [now,setNow]=useState(Date.now)
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[activity.id])
 const countup=activity.kind==='restaurant',remaining=countup?Math.max(0,Math.floor((now-activity.startedAt)/1000)):Math.max(0,Math.ceil((activity.endsAt-now)/1000)),duration=activity.endsAt-activity.startedAt
 const label=activityName(activity)
 return <div className="activity-countdown" data-activity-id={activity.id}>
  <strong>{countup?'已打工':label}</strong><span role="timer" aria-label={`${label}${countup?'已用时间':'倒计时'}`}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</span>
  {!countup&&<progress aria-label={`${label}进度`} max={duration} value={Math.min(duration,Math.max(0,now-activity.startedAt))}/>}
  {countup&&<small>本次已赚 {activity.paidCoins??0} 豆</small>}
 </div>
}

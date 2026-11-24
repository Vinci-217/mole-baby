import { useEffect, useState } from 'react'
import { MIN_IDLE_INTERVAL_SECONDS, MAX_IDLE_INTERVAL_SECONDS, validIdleIntervalSeconds } from '../idle-behavior'

export default function IdleIntervalSetting({seconds,onChange}:{seconds:number;onChange:(seconds:number)=>void}) {
  const [draft,setDraft]=useState(String(seconds))
  useEffect(()=>setDraft(String(seconds)),[seconds])
  return <label className="settings-row"><span>随机动作间隔</span><span className="reminder-interval">
      <input type="number" min={MIN_IDLE_INTERVAL_SECONDS} max={MAX_IDLE_INTERVAL_SECONDS} step={1}
        aria-label="随机动作间隔" title={`${MIN_IDLE_INTERVAL_SECONDS}–${MAX_IDLE_INTERVAL_SECONDS} 秒，空闲时触发`} value={draft}
        onBlur={()=>setDraft(String(seconds))}
        onChange={event=>{
          setDraft(event.target.value)
          const value=event.target.valueAsNumber
          if(validIdleIntervalSeconds(value)===value)onChange(value)
        }}/>
      秒
    </span></label>
}

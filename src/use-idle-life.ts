import { useEffect, useRef } from 'react'
import { chooseIdleBehavior, idleDelay } from './idle-behavior'
import type { IdleAction } from './idle-behavior'
import type { GameState } from './game'
import type { CompanionMemory } from './companion-memory'

/** Local micro-behaviour only. Never moves a seed/window, alters needs, starts
 * timers, creates affection or pretends that the user did something. */
export function useIdleLife({petId,pet,memory,enabled,blocked,onAction}:{petId?:number;pet?:GameState;memory?:CompanionMemory;enabled:boolean;blocked:boolean;onAction:(action:string,sequence:number)=>void}) {
  const current=useRef(onAction);current.current=onAction
  const live=useRef({pet,memory});live.current={pet,memory}
  const identity=pet?.createdAt??petId
  const sequence=useRef(0), deadline=useRef(0)
  const previous=useRef<IdleAction|undefined>(undefined)
  useEffect(()=>{sequence.current=0;deadline.current=0;previous.current=undefined},[identity])
  useEffect(()=>{
    if(!enabled||blocked||identity===undefined)return
    const delay=()=>idleDelay(identity,sequence.current)
    deadline.current=Math.max(Date.now()+15000,deadline.current||Date.now()+delay())
    const timer=setInterval(()=>{
      if(document.hidden||Date.now()<deadline.current)return
      const {pet:active,memory:remembered}=live.current
      const behavior=active?chooseIdleBehavior(active,remembered,sequence.current,previous.current):null
      // Retain the old observer-only behaviour for callers without a pet model.
      const action=active?behavior?.action:previous.current==='look-around'?'watch-butterfly':'look-around'
      if(action){previous.current=action;current.current(action,sequence.current)}
      sequence.current++;deadline.current=Date.now()+delay()
    },5000)
    return()=>clearInterval(timer)
  },[identity,enabled,blocked])
}

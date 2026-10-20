import { useEffect, useRef } from 'react'

/** Local micro-behaviour only. Never moves a seed/window, alters needs, starts
 * timers, creates affection or pretends that the user did something. */
export function useIdleLife({petId,enabled,blocked,onAction}:{petId?:number;enabled:boolean;blocked:boolean;onAction:(action:string)=>void}) {
  const current=useRef(onAction);current.current=onAction
  const sequence=useRef(0), deadline=useRef(0)
  useEffect(()=>{sequence.current=0;deadline.current=0},[petId])
  useEffect(()=>{
    if(!enabled||blocked||petId===undefined)return
    const delay=()=>120000+Math.abs(Math.floor(petId/1000)+sequence.current*73129)%120001
    deadline.current=Math.max(Date.now()+15000,deadline.current||Date.now()+delay())
    const timer=setInterval(()=>{
      if(document.hidden||Date.now()<deadline.current)return
      current.current(sequence.current%4===3?'watch-butterfly':'look-around')
      sequence.current++;deadline.current=Date.now()+delay()
    },5000)
    return()=>clearInterval(timer)
  },[petId,enabled,blocked])
}

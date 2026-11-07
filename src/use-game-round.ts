import {useEffect,useRef} from 'react';
import type {RewardRound} from './economy';

/** Count visible, unpaused frame time, excluding suspension and result screens. */
export function useGameRound(active:boolean,paused=false){
 const clock=useRef({id:'',activeMs:0,last:0}),enabled=useRef(false);enabled.current=active&&!paused;
 useEffect(()=>{
  let request=0;
  const reset=()=>{clock.current.last=performance.now()};
  const tick=(now:number)=>{const c=clock.current,delta=now-c.last;c.last=now;if(enabled.current&&!document.hidden&&delta>=0&&delta<=250)c.activeMs+=delta;request=requestAnimationFrame(tick)};
  reset();document.addEventListener('visibilitychange',reset);request=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(request);document.removeEventListener('visibilitychange',reset)};
 },[]);
 return {
  start(){clock.current={id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`,activeMs:0,last:performance.now()}},
  finish(activeMs?:number):RewardRound{return {id:clock.current.id,activeMs:Math.floor(activeMs??clock.current.activeMs)}},
 };
}

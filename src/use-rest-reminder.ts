import { useEffect, useRef, useState } from 'react';
import {MOBILE_FOCUS_KEY,focusReminderId,parseMobileFocus} from './mobile-focus';

export type TimerDirection = 'countdown' | 'countup';
export interface TimerRecord {petId:number;startedAt:number;endedAt:number;elapsedSeconds:number;plannedMinutes:number;direction:TimerDirection;completed:boolean}
export function timerDisplaySeconds(direction:TimerDirection,remaining:number,total:number){return direction==='countup'?Math.max(0,total-remaining):Math.max(0,remaining)}
export function timerRecordDetail(record:TimerRecord){return `${record.direction==='countup'?'正向':'倒数'}计时${record.completed?'完成':'结束'}：${reminderTime(record.elapsedSeconds)}（计划 ${record.plannedMinutes} 分钟）。`}

export function validReminderMinutes(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 240 ? value : 40;
}
export function reminderTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

/** A manual, one-shot timer. Pet sleep/quiet mode never changes its deadline.
 * Reopening, changing pets/duration or disabling reminders returns to idle. */
export function useRestReminder(petId: number | undefined, enabled: boolean, minutes: number, onDue: (alreadyNotified?:boolean) => void, direction:TimerDirection='countdown',onRecord?:(record:TimerRecord)=>void) {
  const duration = validReminderMinutes(minutes) * 60000;
  const callback = useRef(onDue); callback.current = onDue;
  const recorder=useRef(onRecord);recorder.current=onRecord;
  const session=useRef<{petId:number;startedAt:number;direction:TimerDirection;plannedMinutes:number}|null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(timerDisplaySeconds(direction,duration/1000,duration/1000));
  const [finished, setFinished] = useState(false);
  const generation = useRef(0);
  const initialized=useRef<string|null>(null);
  const finishRecord=(completed:boolean)=>{const active=session.current;session.current=null;if(!active)return;if(window.mobile){localStorage.removeItem(MOBILE_FOCUS_KEY);void window.mobile.cancelReminder(focusReminderId(active)).catch(()=>{});}const endedAt=Date.now(),elapsedSeconds=completed?active.plannedMinutes*60:Math.min(active.plannedMinutes*60,Math.max(0,Math.floor((endedAt-active.startedAt)/1000)));if(completed||elapsedSeconds>0)recorder.current?.({...active,endedAt,elapsedSeconds,completed})};
  const cancel = () => { finishRecord(false);generation.current++; setDeadline(null); setFinished(false); setSeconds(timerDisplaySeconds(direction,duration/1000,duration/1000)); };
  const start = () => {
    if (petId === undefined || !enabled) return;
    if(session.current)return;
    const now=Date.now();session.current={petId,startedAt:now,direction,plannedMinutes:validReminderMinutes(minutes)};
    if(window.mobile){localStorage.setItem(MOBILE_FOCUS_KEY,JSON.stringify({...session.current,deadline:now+duration}));void window.mobile.scheduleReminder(focusReminderId(session.current),now+duration,'拉姆 · 计时结束','站起来伸伸懒腰，喝口水，看看远处吧。').catch(()=>{});}
    generation.current++; setFinished(false); setSeconds(timerDisplaySeconds(direction,duration/1000,duration/1000)); setDeadline(now + duration);
  };
  useEffect(() => {
    const configuration=`${petId}:${enabled}:${duration}:${direction}`;
    if(initialized.current===configuration)return;
    const first=initialized.current===null;initialized.current=configuration;
    if(window.mobile&&first){const saved=enabled?parseMobileFocus(localStorage.getItem(MOBILE_FOCUS_KEY),petId,validReminderMinutes(minutes),direction):null;
      if(saved){session.current=saved;generation.current++;setDeadline(saved.deadline);setSeconds(timerDisplaySeconds(direction,Math.max(0,Math.ceil((saved.deadline-Date.now())/1000)),duration/1000));return;}
      localStorage.removeItem(MOBILE_FOCUS_KEY);
    }
    finishRecord(false);generation.current++;setDeadline(null);setFinished(false);setSeconds(timerDisplaySeconds(direction,duration/1000,duration/1000));
  }, [petId, enabled, duration,direction]);
  useEffect(() => {
    if (deadline === null) return;
    const token = generation.current;
    let fired = false;
    const due = () => {
      if (fired || token !== generation.current) return;
      const active=session.current;fired = true;finishRecord(true); setSeconds(timerDisplaySeconds(direction,0,duration/1000)); setDeadline(null); setFinished(true);
      if(window.mobile&&active){void window.mobile.wasNotified(focusReminderId(active)).then(notified=>callback.current(notified)).catch(()=>callback.current(false));}else callback.current();
    };
    const update = () => {if(window.mobile&&Date.now()>=deadline){due();return;} if (!fired&&token === generation.current) setSeconds(timerDisplaySeconds(direction,Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),duration/1000)); };
    update();
    const interval = setInterval(update, 1000);
    const timeout = setTimeout(due, Math.max(0, deadline - Date.now()));
    const off=window.mobile?.on('resume',update);
    return () => { clearTimeout(timeout); clearInterval(interval);off?.(); };
  }, [deadline]);
  return { seconds, running: deadline !== null, finished, start, cancel };
}

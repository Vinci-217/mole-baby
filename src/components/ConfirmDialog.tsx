import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import './SettingsPanel.css';

export default function ConfirmDialog({title,children,onConfirm,onCancel}:{title:string;children:ReactNode;onConfirm:()=>void;onCancel:()=>void}){
 const ref=useRef<HTMLDivElement>(null),cancel=useRef(onCancel);cancel.current=onCancel;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel.current();return;}
   if(event.key!=='Tab')return;
   const items=ref.current?.querySelectorAll<HTMLButtonElement>('button');if(!items?.length)return;
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',key,true);
  return()=>{
   document.removeEventListener('keydown',key,true);
   if(previous?.isConnected&&!previous.matches(':disabled'))previous.focus();
   else{const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"]');dialogs[dialogs.length-1]?.focus()}
  };
 },[]);
 return createPortal(<div className="settings-confirm-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onCancel()}}><div ref={ref} className="settings-confirm" role="alertdialog" aria-modal="true" aria-label={title}>
  <h3>{title}</h3>{children}<footer><button className="game-button small" onClick={onCancel}>取消</button><button className="game-button small" onClick={onConfirm}>确认切换</button></footer>
 </div></div>,document.body);
}

import {useCallback,useEffect,useState} from 'react';

export function useRoomFullscreen(nativeFullscreen:boolean){
 const [webFullscreen,setWebFullscreen]=useState(Boolean(document.fullscreenElement));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const fullscreen=window.desktop?nativeFullscreen:webFullscreen;
 useEffect(()=>{
  const changed=()=>setWebFullscreen(Boolean(document.fullscreenElement));
  document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);
 },[]);
 const set=useCallback(async(enabled:boolean)=>{
  if(window.desktop){await window.desktop.setRoomFullscreen(enabled);return;}
  if(enabled&&!document.fullscreenElement)await document.documentElement.requestFullscreen();
  else if(!enabled&&document.fullscreenElement)await document.exitFullscreen();
 },[]);
 const toggle=async()=>{
  setBusy(true);setError('');
  try{await set(!fullscreen)}catch(e){setError(e instanceof Error?e.message:'全屏切换失败，请重试。')}finally{setBusy(false)}
 };
 useEffect(()=>{
  if(!fullscreen)return;
  const key=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||event.defaultPrevented||document.querySelector('[role="dialog"],[role="alertdialog"]'))return;
   event.preventDefault();void set(false).catch(e=>setError(e instanceof Error?e.message:'退出全屏失败，请重试。'));
  };
  document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
 },[fullscreen,set]);
 return {fullscreen,busy,error,toggle,exit:()=>set(false)};
}

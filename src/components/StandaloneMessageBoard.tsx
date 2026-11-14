import {useEffect,useRef,useState} from 'react';
import MessageBoard from './MessageBoard';
import type {BoardSnapshot} from './MessageBoard';
import type {PetNote} from '../pet-records';

// This window deliberately does not mount App, tick the pet or write storage.
export default function StandaloneMessageBoard(){
 const [snapshot,setSnapshot]=useState<BoardSnapshot|null>(null),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const busy=useRef(false),version=useRef(0);
 useEffect(()=>{
  const bridge=window.desktop?.messageBoard;if(!bridge)return;
  let active=true;const generation=version.current;
  const off=bridge.onSnapshot(value=>{version.current++;if(active){setSnapshot(value);if(!value)setError('请先领养一只拉姆。')}});
  void bridge.get().then(value=>{if(active&&version.current===generation)setSnapshot(value)}).catch(()=>{if(active)setError('留言板暂时无法读取，请关闭后重试。')});
  return()=>{active=false;off()};
 },[]);
 async function change(notes:PetNote[]){
  const bridge=window.desktop?.messageBoard;if(!snapshot||!bridge||busy.current)return false;
  busy.current=true;setSaving(true);setError('');
  try{setSnapshot(await bridge.change({petId:snapshot.createdAt,baseNotes:JSON.stringify(snapshot.notes??[]),notes}));return true}
  catch(reason){
   const raw=reason instanceof Error?reason.message:'';
   const message=raw.includes('已有更新')?'留言已有更新，已读取最新内容。你的输入仍保留，请再点一次保存。':raw.includes('超时')?'保存超时，输入内容已保留。请稍后重试。':raw.includes('存储')?'本地存储写入失败，输入内容已保留。请检查存储空间后重试。':'留言未保存，输入内容已保留，请重试。';
   setError(message);try{setSnapshot(await bridge.get())}catch{/* Keep the last readable board and the user's input. */}throw new Error(message);
  }
  finally{busy.current=false;setSaving(false)}
 }
 return <main className="standalone-board" aria-busy={saving}>{snapshot?<MessageBoard pet={snapshot} onChange={change} onClose={()=>void window.desktop?.messageBoard?.close()}/>:<p role="status">{error||'正在打开留言板……'}</p>}{error&&snapshot&&<div className="board-save-error" role="alert">{error}</div>}</main>;
}

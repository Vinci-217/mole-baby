import {useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import type {GameState} from '../game';
import type {PetNote} from '../pet-records';
import './MessageBoard.css';

// Coordinates are the original GuestBookUI timeline in pixels. Its sprites,
// title, avatars, paper, controls and wood frame are exported from GuestBook.swf.
const SLOTS=[[28.2,98.95],[255.6,97.95],[484.6,101],[28.2,284.95],[255.2,283.95],[483.2,287]];
const PAGE_SIZE=6;
type Compose={kind:'new'|'edit'|'reply';id:string;createdAt:number;petId:number};
export type BoardSnapshot=Pick<GameState,'name'|'createdAt'|'notes'>;
export default function MessageBoard({pet,onChange,onClose}:{pet:BoardSnapshot;onChange:(notes:PetNote[])=>void|boolean|Promise<boolean>;onClose:()=>void}){
 const dialog=useRef<HTMLElement>(null),scroll=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 const busy=useRef(false);
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[width,setWidth]=useState(770),[page,setPage]=useState(0),[compose,setCompose]=useState<Compose|null>(null),[text,setText]=useState(''),[removing,setRemoving]=useState<string|null>(null);
 const notes=pet.notes??[],pages=Math.max(1,Math.ceil(notes.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1);
 const visible=notes.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
 useLayoutEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;dialog.current?.focus({preventScroll:true});
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key==='Tab'){
    const items=[...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),textarea')];
    const first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  // Resolve the real size before the first paint. A passive effect exposes
  // the default 770px board for one frame before enlarging it to the window.
  // Use the same measurement initially and in the observer to avoid a second
  // fractional-width correction on displays with non-integer scaling.
  const resize=()=>{if(scroll.current)setWidth(Math.max(700,Math.min(940,scroll.current.clientWidth)))};
  resize();document.addEventListener('keydown',key);const observer=new ResizeObserver(resize);if(scroll.current)observer.observe(scroll.current);
  return()=>{document.removeEventListener('keydown',key);observer.disconnect();previous?.focus({preventScroll:true});};
 },[]);
 function open(kind:Compose['kind'],note?:PetNote){setError('');setCompose({kind,id:note?.id??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,createdAt:note?.createdAt??Date.now(),petId:pet.createdAt});setText(kind==='edit'?note!.text:kind==='reply'?note?.reply??'':'');}
 async function persist(next:PetNote[]){
  if(busy.current)return false;
  busy.current=true;setSaving(true);setError('');
  try{if(await onChange(next)===false){setError('留言未保存，内容已保留。请重试，或检查本地存储空间。');return false}return true}
  catch(reason){setError(reason instanceof Error?reason.message:'留言未保存，内容已保留，请重试。');return false}
  finally{busy.current=false;setSaving(false)}
 }
 async function save(){
  const value=text.trim();if(!value||!compose||busy.current)return;
  if(compose.petId!==pet.createdAt){setError('拉姆记录已切换，请关闭编辑框后重新留言。');return}
  const existing=notes.some(note=>note.id===compose.id);
  if(compose.kind==='new'&&!existing&&notes.length>=40){setError('留言板最多保存 40 条，请先删除不需要的留言。');return}
  if(compose.kind!=='new'&&!notes.some(note=>note.id===compose.id)){setError('这条留言已被删除，输入内容仍为你保留。');return}
  // A delayed native acknowledgement may arrive after a timeout. Retrying the
  // same draft updates its ID instead of adding the same message twice.
  const next=compose.kind==='new'&&!existing?[...notes,{id:compose.id,text:value,done:false,createdAt:compose.createdAt}]:notes.map(note=>note.id===compose.id?compose.kind==='reply'?{...note,reply:value}:{...note,text:value}:note);
  if(await persist(next)){if(compose.kind==='new')setPage(0);setCompose(null);setText('');}
 }
 const scale=width/770;
 return <div className="message-board-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialog} tabIndex={-1} className="message-board-window" role="dialog" aria-modal="true" aria-label="小屋留言板">
   <div className="message-board-mobile-bar"><span>小屋留言板 · 左右滑动查看</span><button onClick={onClose} aria-label="关闭留言板">×</button></div>
   <div ref={scroll} className="message-board-scroll">
    <div className="message-board-stage" style={{width,height:531*scale}}>
     <div className="message-board-original" style={{transform:`scale(${scale})`}}>
      <img className="message-board-original-art" src="./assets/original/message-board/window.png" alt="" draggable={false}/>
      <button className="board-art-hit board-write" aria-label="我要留言" disabled={notes.length>=40} onClick={()=>open('new')}/>
      <button className="board-art-hit board-close" aria-label="关闭留言板" onClick={onClose}/>
      {!notes.length&&<p className="message-board-empty">还没有留言，点击上方「我要留言」。</p>}
      {visible.map((note,index)=>{const [x,y]=SLOTS[index];return <article key={note.id} className={`message-card ${note.done?'is-done':''} ${note.reply?'has-reply':''}`} style={{left:x,top:y} as CSSProperties} aria-label="留言">
        <img className="message-card-art" src={`./assets/original/message-board/${note.reply?'card':'card-plain'}.png`} alt="" draggable={false}/>
        <span className="message-card-name">{pet.name}</span>
        <button className="message-card-content" onClick={()=>open('edit',note)} aria-label={`编辑留言：${note.text}`}>{note.text}</button>
        {note.reply&&<p className="message-card-reply-content">{note.reply}</p>}
        <time className="message-card-date">{new Date(note.createdAt).toLocaleDateString('zh-CN').replaceAll('/','.')}</time>
        <button className="board-art-hit card-delete" onClick={()=>setRemoving(note.id)} aria-label={`删除留言：${note.text}`}/>
        <button className="board-art-hit card-reply" onClick={()=>open('reply',note)} aria-label={`回复留言：${note.text}`}/>
        {note.reply&&<button className="board-art-hit card-delete-reply" disabled={saving} onClick={()=>void persist(notes.map(item=>item.id===note.id?{...item,reply:undefined}:item))} aria-label="删除回复"/>}
        <button className="card-done" disabled={saving} aria-pressed={note.done} onClick={()=>void persist(notes.map(item=>item.id===note.id?{...item,done:!item.done}:item))}>{note.done?'✓ 已完成':'□ 待完成'}</button>
      </article>})}
      <footer className="message-board-footer"><span>{currentPage+1}/{pages}页</span><span>{notes.length}条留言</span></footer>
      <button className="board-art-hit board-prev" disabled={currentPage===0} aria-label="留言上一页" onClick={()=>setPage(Math.max(0,currentPage-1))}/>
      <button className="board-art-hit board-next" disabled={currentPage+1===pages} aria-label="留言下一页" onClick={()=>setPage(Math.min(pages-1,currentPage+1))}/>
     </div>
    </div>
   </div>
   <p className="message-board-save-note">本地自动保存 · 点击留言正文可编辑，待办完成后可以勾选。</p>
   {error&&!compose&&!removing&&<p className="board-inline-error" role="alert">{error}</p>}
   {compose&&<div className="board-compose-overlay"><form className="board-compose" onSubmit={event=>{event.preventDefault();save()}} aria-label={compose.kind==='reply'?'回复留言':compose.kind==='edit'?'编辑留言':'写留言'}>
    <img className="board-compose-art" src="./assets/original/message-board/compose.png" alt="" draggable={false}/>
    <label htmlFor="board-note">{compose.kind==='reply'?'回复留言':compose.kind==='edit'?'编辑留言':'我要留言'}</label>
    <textarea id="board-note" maxLength={240} autoFocus value={text} onChange={event=>setText(event.target.value)} placeholder="在这里写下留言或待办……"/>
    <small>{text.length}/240</small>
    {error&&<p className="board-compose-error" role="alert">{error}</p>}
    <div className="board-compose-actions"><button type="button" disabled={saving} onClick={()=>{setCompose(null);setError('')}}>取消</button><button type="submit" disabled={!text.trim()||saving}>{saving?'保存中…':'保存'}</button></div>
   </form></div>}
   {removing&&<div className="board-compose-overlay"><section className="board-remove" role="alertdialog" aria-label="删除这条留言？"><p>删除这条留言？</p>{error&&<p className="board-inline-error" role="alert">{error}</p>}<button disabled={saving} onClick={()=>{setRemoving(null);setError('')}}>保留</button><button disabled={saving} onClick={async()=>{if(await persist(notes.filter(note=>note.id!==removing)))setRemoving(null)}}>{saving?'删除中…':'确认删除'}</button></section></div>}
  </section>
 </div>;
}

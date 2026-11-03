import {useMemo, useState} from 'react';
import type {GameState} from '../game';
import type {PetNote} from '../pet-records';
import './MessageBoard.css';

const PAGE_SIZE = 6;
const previewNotes: PetNote[] = [
  {id:'preview-1', text:'你是爱，是暖，是希望；你是人间的四月天。', done:false, createdAt:Date.now()},
  {id:'preview-2', text:'拉姆今天也要好好吃饭，记得完成自己的小目标。', done:false, createdAt:Date.now()-86400000},
  {id:'preview-3', text:'把想做的事情写在这里，完成后可以在卡片下方勾选。', done:false, createdAt:Date.now()-172800000},
  {id:'preview-4', text:'小屋留言板会跟随本地存档一起保存。', done:false, createdAt:Date.now()-259200000},
  {id:'preview-5', text:'欢迎回来，今天也和拉姆一起加油吧！', done:false, createdAt:Date.now()-345600000},
  {id:'preview-6', text:'完成一件小事，就给自己一个小小的奖励。', done:false, createdAt:Date.now()-432000000},
];

function MessageAvatar({index}:{index:number}) {
  return <span className={`message-avatar avatar-${index%3}`} aria-hidden="true"><i/><i/></span>;
}

export default function MessageBoard({pet,onChange,onClose}:{pet:GameState;onChange:(notes:PetNote[])=>void;onClose:()=>void}) {
  const [text,setText]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [page,setPage]=useState(0);
  const [removing,setRemoving]=useState<string|null>(null);
  const [composing,setComposing]=useState(false);
  const notes=pet.notes??[];
  const totalPages=Math.max(1,Math.ceil(notes.length/PAGE_SIZE));
  const currentPage=Math.min(page,totalPages-1);
  const visible=useMemo(()=>notes.length?notes.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE):previewNotes,[notes,currentPage]);

  function save() {
    const value=text.trim();
    if(!value||(!editing&&notes.length>=40))return;
    const next=editing
      ? notes.map(note=>note.id===editing?{...note,text:value}:note)
      : [...notes,{id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,text:value,done:false,createdAt:Date.now()}];
    onChange(next); setText(''); setEditing(null); setPage(0);
  }
  function edit(note:PetNote) {setEditing(note.id);setText(note.text);setComposing(true);}

  return <div className="message-board-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="message-board-window" role="dialog" aria-modal="true" aria-label="小屋留言板">
      <header className="message-board-window-header">
        <button type="button" className="message-board-heading" aria-expanded={composing} onClick={()=>setComposing(value=>!value)}><h2>我要留言</h2><span className="message-board-pencil" aria-hidden="true">✎</span></button>
        <button className="message-board-close" onClick={onClose} aria-label="关闭留言板">×</button>
      </header>
      <div className="message-board-wood-frame">
        {composing&&<form className="message-board-compose" onSubmit={event=>{event.preventDefault();save()}}>
          <label htmlFor="board-note">{editing?'编辑这条留言':'写一条给自己的留言'}</label>
          <textarea id="board-note" maxLength={240} rows={2} value={text} onChange={event=>setText(event.target.value)} placeholder="例如：明天记得给拉姆洗澡……"/>
          <div className="message-board-compose-actions"><small>{text.length}/240 · {notes.length}/40条</small>{editing&&<button type="button" className="board-text-button" onClick={()=>{setEditing(null);setText('')}}>取消</button>}<button className="board-submit" disabled={!text.trim()||(!editing&&notes.length>=40)}>{editing?'保存修改':'写入留言板'}</button></div>
        </form>}
        <div className="message-board-grid" aria-live="polite">
          {visible.map((note,index)=>{
            const placeholder=note.id.startsWith('preview-');
            return <article key={note.id} className={`message-card ${note.done?'is-done':''} ${placeholder?'is-preview':''}`}>
              <MessageAvatar index={index}/>
              <div className="message-card-body">
                <div className="message-card-meta"><strong>{placeholder?'拉姆小屋':pet.name}</strong><span>{placeholder?'留言板':new Date(note.createdAt).toLocaleDateString('zh-CN')}</span></div>
                <p>{note.text}</p>
                {!placeholder&&<div className="message-card-reply"><span>回复</span><button onClick={()=>edit(note)} aria-label={`编辑留言：${note.text}`}>编辑</button><button onClick={()=>setRemoving(note.id)} aria-label={`删除留言：${note.text}`}>×</button></div>}
                {!placeholder&&removing===note.id&&<div className="message-card-confirm" role="alert"><span>删除这条留言？</span><button onClick={()=>{onChange(notes.filter(item=>item.id!==note.id));setRemoving(null)}}>确定</button><button onClick={()=>setRemoving(null)}>保留</button></div>}
                {!placeholder&&<label className="message-card-done"><input type="checkbox" checked={note.done} onChange={event=>onChange(notes.map(item=>item.id===note.id?{...item,done:event.target.checked}:item))}/><span>{note.done?'已完成':'标记为已完成'}</span></label>}
              </div>
            </article>;
          })}
        </div>
        <footer className="message-board-footer">
          <button aria-label="上一页" disabled={currentPage===0} onClick={()=>setPage(value=>Math.max(0,value-1))}>◀</button>
          <span>{currentPage+1}/{totalPages}页</span>
          <strong>{notes.length}条留言</strong>
          <button aria-label="下一页" disabled={currentPage+1>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages-1,value+1))}>▶</button>
        </footer>
      </div>
      <p className="message-board-save-note">留言会随拉姆本地存档自动保存，更新后也会保留。</p>
    </section>
  </div>;
}

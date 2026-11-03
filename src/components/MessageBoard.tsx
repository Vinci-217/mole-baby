import {useState} from 'react';
import type {GameState} from '../game';
import type {PetNote} from '../pet-records';
export default function MessageBoard({pet,onChange}:{pet:GameState;onChange:(notes:PetNote[])=>void}){
 const [text,setText]=useState(''),[editing,setEditing]=useState<string|null>(null),[removing,setRemoving]=useState<string|null>(null);
 const notes=pet.notes??[],remaining=notes.filter(note=>!note.done).length;
 function save(){
  const value=text.trim();if(!value||(!editing&&notes.length>=40))return;
  onChange(editing?notes.map(note=>note.id===editing?{...note,text:value}:note):[...notes,{id:`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`,text:value,done:false,createdAt:Date.now()}]);
  setText('');setEditing(null);
 }
 return <section className="message-board official-memo-board" aria-label="小屋留言板">
  <header className="memo-board-title"><div><span className="memo-board-kicker">拉姆小屋 · 我的记录</span><h3>留言板</h3></div><span className="memo-board-count">{remaining} 项待办 · {notes.length}/40</span></header>
  <p className="memo-board-intro">把要记住的事情写下来，完成后可以勾选收好。</p>
  <form className="memo-board-compose" onSubmit={event=>{event.preventDefault();save()}}><label htmlFor="board-note">{editing?'编辑记录':'新增记录'}</label><textarea id="board-note" maxLength={240} rows={3} value={text} onChange={event=>setText(event.target.value)} placeholder="写下今天想完成的事……"/><div><small>{text.length}/240</small><button className="game-button small" disabled={!text.trim()||(!editing&&notes.length>=40)}>{editing?'保存修改':'写入留言板'}</button>{editing&&<button type="button" className="game-button small" onClick={()=>{setEditing(null);setText('')}}>取消</button>}</div></form>
  {!notes.length&&<p className="board-empty">这里还没有记录。写下一件小事吧。</p>}
  <ul>{notes.map(note=><li key={note.id} className={note.done?'is-done':''}><label><input type="checkbox" aria-label={`完成：${note.text}`} checked={note.done} onChange={event=>onChange(notes.map(item=>item.id===note.id?{...item,done:event.target.checked}:item))}/><span>{note.text}</span></label><div><button type="button" onClick={()=>{setEditing(note.id);setText(note.text)}}>编辑</button><button type="button" aria-label={`删除：${note.text}`} onClick={()=>setRemoving(note.id)}>删除</button></div>{removing===note.id&&<p role="alert">要移除这条留言吗？<button type="button" onClick={()=>{onChange(notes.filter(item=>item.id!==note.id));if(editing===note.id){setEditing(null);setText('')}setRemoving(null)}}>确认删除</button><button type="button" onClick={()=>setRemoving(null)}>保留</button></p>}</li>)}</ul>
  <p className="board-save-note">本地自动保存 · 导出存档时会一起备份</p>
 </section>;
}

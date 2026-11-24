import {useEffect,useRef} from 'react';
import LocalSaveInspector from './LocalSaveInspector';
import './SaveManager.css';

export type SaveFeedback={kind:'pending'|'success'|'error'|'info';message:string};
export type SaveImport={file:File}|{text:string};
export function SaveOperationFeedback({feedback,onDismiss}:{feedback:SaveFeedback|null;onDismiss?:()=>void}){
 const receipt=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(feedback&&!onDismiss)receipt.current?.scrollIntoView({block:'nearest'})},[feedback,onDismiss]);
 if(!feedback)return null;
 return <div ref={receipt} className={`save-operation-feedback is-${feedback.kind}`} role={feedback.kind==='error'?'alert':'status'} aria-atomic="true">
  <span>{feedback.message}</span>{onDismiss&&feedback.kind!=='pending'&&<button type="button" aria-label="收起存档操作提示" onClick={onDismiss}>×</button>}
 </div>;
}

/** All entry points share the picker, retry handling, inspection and receipts.
 * The parent owns the receipt so importing from adoption can change screens. */
export default function SaveManager({onImport,onExport,exportLabel='导出存档',importLabel='导入存档',feedback,onFeedback}:{
 onImport:(source:SaveImport)=>Promise<boolean>;onExport?:()=>Promise<void>;exportLabel?:string;importLabel?:string;
 feedback:SaveFeedback|null;onFeedback:(feedback:SaveFeedback)=>void;
}){
 const input=useRef<HTMLInputElement>(null),busy=feedback?.kind==='pending';
 useEffect(()=>{
  const picker=input.current,cancel=()=>onFeedback({kind:'info',message:'已取消选择存档。'});
  picker?.addEventListener('cancel',cancel);return()=>picker?.removeEventListener('cancel',cancel);
 },[onFeedback]);
 return <div className="save-manager" aria-busy={busy}>
  <div className="settings-actions">
   {onExport&&<button type="button" className="game-button small" disabled={busy} onClick={()=>void onExport()}>{exportLabel}</button>}
   <button type="button" className="game-button small" disabled={busy} onClick={()=>input.current?.click()}>{importLabel}</button>
   <input ref={input} hidden type="file" accept="application/json,.json" onChange={event=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';
    if(file)void onImport({file});
    else onFeedback({kind:'info',message:'已取消选择存档。'});
   }}/>
  </div>
  <SaveOperationFeedback feedback={feedback}/>
  <LocalSaveInspector busy={busy} onRestore={text=>onImport({text})}/>
 </div>;
}

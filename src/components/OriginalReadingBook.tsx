import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {RAM_BOOKS,ramBook,bookmarkPage,type RamBookId,type ReadingProgress} from '../reading-books';
import type {readingPageLayout} from '../reading-page-layout';
import {bookDownloads,type CachedBookPages} from '../book-downloads';
import './ReadingShelf.css';

function BookPage({src,title,style}:{src:string;title:string;style:CSSProperties}){
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[retry,setRetry]=useState(0);
 return <><img key={retry} className="reading-page-image" src={src} decoding="async" alt={title} draggable={false} onLoad={()=>setStatus('ready')} onError={()=>setStatus('error')} style={style}/>{status==='error'?<div className="reading-page-error" role="alert">这一页暂时没能打开。<button onClick={()=>{setStatus('loading');setRetry(value=>value+1)}}>再试一次</button></div>:status==='loading'&&<span className="reading-sr-only" role="status">正在翻开书页…</span>}</>;
}

export default function OriginalReadingBook({progress,initialBook,onProgress,onClose,onDownloadBooks}:{progress?:ReadingProgress;initialBook?:RamBookId;onProgress:(progress:ReadingProgress)=>void;onClose:()=>void;onDownloadBooks?:()=>void}){
 const [selected]=useState(()=>ramBook(initialBook)?.id??ramBook(progress?.lastBook)?.id??RAM_BOOKS[0].id);
 const book=ramBook(selected)!,[page,setPage]=useState(()=>bookmarkPage(progress,selected,progress?.pages[selected]??0).pages[selected]!);
 const [geometry,setGeometry]=useState<typeof readingPageLayout|null>(null),[layoutFailed,setLayoutFailed]=useState(false);
 const downloads=bookDownloads();
 const [downloaded,setDownloaded]=useState<CachedBookPages|null>();
 const dialog=useRef<HTMLElement>(null),progressRef=useRef(progress),close=useRef(onClose),turnRef=useRef<(delta:number)=>void>(()=>{}),pageRef=useRef(page);
 progressRef.current=progress;close.current=onClose;
 function remember(next:number){const value=bookmarkPage(progressRef.current,selected,next);progressRef.current=value;onProgress(value)}
 function turn(delta:number){const next=Math.max(0,Math.min(book.pages.length-1,pageRef.current+delta));if(next===pageRef.current)return;pageRef.current=next;setPage(next);remember(next)}
 turnRef.current=turn;
 useEffect(()=>{
  let live=true;
  void import('../reading-page-layout').then(({readingPageLayout})=>{if(live)setGeometry(()=>readingPageLayout)},()=>{if(live)setLayoutFailed(true)});
  return()=>{live=false};
 },[]);
 useEffect(()=>{
  if(!downloads)return;
  let live=true,result:CachedBookPages|null=null;
  void downloads.prepare(selected).then(pages=>{
   if(live){result=pages;setDownloaded(pages)}else pages?.dispose?.();
  },()=>{if(live)setDownloaded(null)});
  return()=>{live=false;result?.dispose?.()};
 },[downloads,selected]);
 useEffect(()=>{
  remember(pageRef.current);
  const previous=document.activeElement as HTMLElement|null;dialog.current?.focus({preventScroll:true});
  const key=(event:KeyboardEvent)=>{
   const dialogs=document.querySelectorAll('[role=dialog]');if(dialogs[dialogs.length-1]!==dialog.current)return;
   if(event.key==='Escape'){event.preventDefault();close.current();return}
   if(event.key==='Tab'){
    const items=[...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled)')],first=items[0],last=items[items.length-1];
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){event.preventDefault();first?.focus()}
   }
   if(dialog.current?.hasAttribute('data-page')&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();turnRef.current(event.key==='ArrowLeft'?-1:1)}
  };
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[]);
 const bundledPage=book.pages[page];
 const pageStem=bundledPage.split('/').at(-1)?.replace(/\.[^.]+$/,'')??'';
 const source=downloads?downloaded?.sources[pageStem]:bundledPage;
 const layout=source?geometry?.(book,page):undefined;
 return <div className="reading-shelf-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`阅读《${book.title}》`} className={layout?'reading-original-book':'reading-book-loading'} data-book={layout?book.id:undefined} data-page={layout?page:undefined} style={layout?{'--book-width':`${layout.width}px`,'--book-ratio':layout.width/layout.height} as CSSProperties:undefined}>
   {layout?<>
   <BookPage key={`${book.id}:${page}`} src={source!} title={`${book.title}，${page===0?'封面':`第 ${page+1} 页`}`} style={layout.image}/>
   <button className="reading-page-hit reading-previous" style={layout.previous} aria-label="上一页" disabled={page===0} onClick={()=>turn(-1)}/>
   <button className="reading-page-hit reading-next" style={layout.next} aria-label="下一页" title={page===0?'翻开书本':'下一页'} disabled={page===book.pages.length-1} onClick={()=>turn(1)}/>
   <button className="reading-page-hit reading-close" style={layout.close} aria-label="合上书本" onClick={onClose}/>
   <span className="reading-sr-only" role="status" aria-live="polite">{book.title}，第 {page+1} 页，共 {book.pages.length} 页。点击左下角或右下角翻页，按 Escape 合上书本。</span>
   </>:<>
    <p role={layoutFailed?'alert':'status'}>{downloaded===null?'请先在设置里下载图书素材。':layoutFailed?'书页暂时打不开。':'正在翻开书本…'}</p>
    {downloaded===null&&onDownloadBooks&&<button type="button" className="game-button" onClick={onDownloadBooks}>去下载</button>}
    <button type="button" className="game-button" onClick={onClose}>合上书本</button>
   </>}
  </section>
  {layout&&<span className="reading-page-note" aria-hidden="true">第 {page+1} / {book.pages.length} 页{page===0&&book.pages.length>1?' · 点右下角翻页':''}</span>}
 </div>;
}

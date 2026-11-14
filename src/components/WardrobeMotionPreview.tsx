import {useEffect,useRef,useState} from 'react';
import {ALL_OUTFITS,costumePlayback,type CostumeFamily} from '../wardrobe';
import type {Evolution,Stage} from '../game';
import Ram from './Ram';
import './WardrobeMotionPreview.css';
const FORMS=[['junior','初级'],['middle','中级'],['senior','高级'],['classic','经典超级拉姆'],['super','神力超级拉姆'],['water','水系'],['wood','木系'],['fire','火系']];
const FAMILIES:[CostumeFamily,string][]=[['junior-accessory','初级配饰'],['junior-costume','初级整套造型'],['form-costume','多形态整套造型'],['form-accessory','按形态穿戴的配饰']];
const PAGE_SIZE=6;
const SAMPLES=['wizard-cap','original-1200113','magic-book','angel-wings','original-1200005','original-1200025'];

export default function WardrobeMotionPreview(){
 const [form,setForm]=useState(()=>{const requested=new URLSearchParams(location.search).get('form');return FORMS.some(([id])=>id===requested)?requested!:'junior'}),[action,setAction]=useState('idle'),[run,setRun]=useState(0);
 const [zoom,setZoom]=useState(()=>new URLSearchParams(location.search).get('zoom')==='2'?'2':'1');
 const [family,setFamily]=useState(()=>{const value=new URLSearchParams(location.search).get('category');return value==='samples'||FAMILIES.some(([id])=>id===value)?value!:'all'}),[page,setPage]=useState(0);
 const root=useRef<HTMLElement>(null);
 const stage:Stage=form==='junior'?1:form==='middle'?2:form==='senior'?3:4;
 const outfits=ALL_OUTFITS.filter(item=>family==='all'||(family==='samples'?SAMPLES.includes(item.id):costumePlayback(stage,stage===4?form as Evolution:undefined,item.id).family===family));
 const pages=Math.ceil(outfits.length/PAGE_SIZE),shown=outfits.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 useEffect(()=>{const url=new URL(location.href);url.searchParams.set('form',form);url.searchParams.set('zoom',zoom);url.searchParams.set('category',family);history.replaceState(null,'',url)},[form,zoom,family]);
 useEffect(()=>{
  let raf=0,started=performance.now(),previous='';
  const paint=(now:number)=>{
   const t=(now-started)%9000;
   const next=t<1800?'idle':t<3200?'walk-left':t<6000?'walk-right':t<7400?'walk-left':'idle';
   const x=t<1800?0:t<3200?-(t-1800)/1400*32:t<6000?-32+(t-3200)/2800*64:t<7400?32-(t-6000)/1400*32:0;
   root.current?.style.setProperty('--walking-x',`${x}px`);
   if(next!==previous){previous=next;setAction(next)}
   raf=requestAnimationFrame(paint);
  };
  raf=requestAnimationFrame(paint);return()=>cancelAnimationFrame(raf);
 },[form,run]);
 return <main className={`wardrobe-motion-page ${zoom==='2'?'is-closeup':''}`} ref={root}>
  <header><h1>衣橱 · 方向与移动预览</h1><p>正面停留 → 向左走 → 向右走 → 回到原位</p><p>全部 {ALL_OUTFITS.length} 件装扮 · 所有形态可直接查看；此预览不修改存档。</p><label>形态 <select aria-label="移动预览形态" value={form} onChange={e=>setForm(e.target.value)}>{FORMS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="wardrobe-review-zoom">分类 <select aria-label="装扮分类" value={family} onChange={e=>{setFamily(e.target.value);setPage(0)}}><option value="all">全部</option><option value="samples">分类抽样</option>{FAMILIES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="wardrobe-review-zoom">查看大小 <select aria-label="预览放大倍数" value={zoom} onChange={e=>setZoom(e.target.value)}><option value="1">标准</option><option value="2">放大 2 倍</option></select></label><button onClick={()=>setRun(n=>n+1)}>重新播放</button></header>
  <section className="wardrobe-motion-grid" aria-label="全部装扮移动展示">{shown.map(item=><figure key={item.id} data-costume={item.id}><div className="wardrobe-motion-track"><div className="wardrobe-moving-pet"><Ram color="blue" costume={item.id} stage={stage} evolution={stage===4?form as Evolution:undefined} action={action} actionId={`${form}:${run}`} sound={false}/></div></div><figcaption>{item.name}<small>{costumePlayback(stage,stage===4?form as Evolution:undefined,item.id).appearance.form!==form?'使用原片中的完整穿衣外观，成长保留':'使用当前形态的原版外观'}</small></figcaption></figure>)}</section>
  <nav className="wardrobe-motion-pages" aria-label="装扮预览翻页"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{page+1} / {pages} · {outfits.length} 件</span><button disabled={page+1===pages} onClick={()=>setPage(p=>p+1)}>下一页</button></nav>
  <footer>使用桌宠实际的角色与服饰播放器 · 独立预览，不修改存档</footer>
 </main>;
}

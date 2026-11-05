import {useEffect,useRef,useState} from 'react';
import {OUTFITS} from '../wardrobe';
import type {Evolution,Stage} from '../game';
import Ram from './Ram';
import './WardrobeMotionPreview.css';

export default function WardrobeMotionPreview(){
 const [form,setForm]=useState('middle'),[action,setAction]=useState('idle'),[run,setRun]=useState(0);
 const root=useRef<HTMLElement>(null);
 const stage:Stage=form==='junior'?1:form==='middle'?2:form==='senior'?3:4;
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
 return <main className="wardrobe-motion-page" ref={root}>
  <header><h1>衣橱 · 方向与移动预览</h1><p>正面停留 → 向左走 → 向右走 → 回到原位</p><label>形态 <select aria-label="移动预览形态" value={form} onChange={e=>setForm(e.target.value)}>{[['junior','初级'],['middle','中级'],['senior','高级'],['super','超级拉姆'],['water','水系'],['wood','木系'],['fire','火系']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button onClick={()=>setRun(n=>n+1)}>重新播放</button></header>
  <section className="wardrobe-motion-grid" aria-label="全部装扮移动展示">{OUTFITS.map(item=><figure key={item.id} data-costume={item.id}><div className="wardrobe-motion-track"><div className="wardrobe-moving-pet"><Ram color="blue" costume={item.id} stage={stage} evolution={stage===4?form as Evolution:undefined} action={action} actionId={`${form}:${run}`} sound={false}/></div></div><figcaption>{item.name}</figcaption></figure>)}</section>
  <footer>使用桌宠实际的角色与服饰播放器 · 独立预览，不修改存档</footer>
 </main>;
}

import {useEffect, useRef, useState} from 'react';
import type {GameState} from '../game';
import {loadRestaurantImage, loadRestaurantWorkers, paintRestaurantWorker, RESTAURANT_ASSET} from '../restaurant-painter';
import {desktopRestaurantFrame} from '../desktop-restaurant-work';
import ActivityCountdown from './ActivityCountdown';
import './DesktopRestaurantWork.css';

export default function DesktopRestaurantWork({pet,onView,onStop}:{pet:GameState;onView:()=>void;onStop:()=>void}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [loadState,setLoadState]=useState<'loading'|'loaded'|'error'>('loading');
  useEffect(()=>{
    let disposed=false, raf=0, elapsed=0, last=0;
    setLoadState('loading');
    const load=async()=>{
      const [workers,stove,burner,table,dish]=await Promise.all([loadRestaurantWorkers(pet.color),loadRestaurantImage(`${RESTAURANT_ASSET}work-details/stove.webp`),loadRestaurantImage(`${RESTAURANT_ASSET}work-details/burner.webp`),loadRestaurantImage(`${RESTAURANT_ASSET}work-details/table.webp`),loadRestaurantImage(`${RESTAURANT_ASSET}dishes/1340002.webp`)]);
      if(disposed)return;
      const ctx=canvas.current?.getContext('2d');if(!ctx)return;
      setLoadState('loaded');
      const paint=(now:number)=>{
        if(disposed)return;
        if(last&&!document.hidden)elapsed+=Math.min(100,now-last);last=now;
        const frame=desktopRestaurantFrame(elapsed);
        const element=canvas.current;if(element){element.dataset.phase=frame.phase;element.dataset.loadedColor=pet.color;element.dataset.loaded='true';}
        ctx.clearRect(0,0,352,164);
        ctx.drawImage(stove,6,10,96,133);ctx.drawImage(burner,24,92,53,38);
        ctx.drawImage(table,270,78,78,80);
        if(frame.dishVisible){ctx.save();ctx.globalAlpha=frame.dishOpacity;ctx.drawImage(dish,288,82,34,34*dish.height/dish.width);ctx.restore();}
        paintRestaurantWorker(ctx,workers,frame.worker,elapsed,.9);
        raf=requestAnimationFrame(paint);
      };raf=requestAnimationFrame(paint);
    };
    void load().catch(()=>{if(!disposed){setLoadState('error');if(canvas.current)canvas.current.dataset.error='true';}});
    return()=>{disposed=true;cancelAnimationFrame(raf)};
  },[pet.color,pet.activity?.id]);
  return <section className="desktop-restaurant-work" aria-label="桌面餐厅打工" data-testid="desktop-restaurant-work">
    <button className="desktop-work-view" onClick={onView} aria-label="进入餐厅"><canvas ref={canvas} width={352} height={164} role="img" aria-label="左侧灶台、右侧餐桌，拉姆往返端盘送餐"/>{loadState!=='loaded'&&<span className="desktop-work-loading" role="status">{loadState==='error'?'餐厅动画暂时无法加载，点击进入餐厅':'正在准备餐厅…'}</span>}</button>
    <div className="desktop-work-caption"><span>拉姆去餐厅打工了</span><button onClick={onStop}>停止打工</button></div>
    {pet.activity&&<ActivityCountdown activity={pet.activity}/>}
  </section>;
}

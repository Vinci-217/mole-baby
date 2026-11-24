import {useId,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import type {OfficialClip} from './official-clips';

export interface DrawingBounds{x:number;y:number;width:number;height:number}
/** Care/skill timelines travel much farther than a resting costume. More
 * drawing space never changes the logical body width or its screen anchor. */
export const officialViewportScale=(clip:Pick<OfficialClip,'kind'|'viewportScale'>)=>Number.isFinite(clip.viewportScale)?Math.max(3.2,Math.min(24,clip.viewportScale!)):['care','magic','skill','transform'].includes(clip.kind)?8:3.2;
export function drawingUnion(bounds:readonly DrawingBounds[]):DrawingBounds|null{
 const valid=bounds.filter(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0);
 if(!valid.length)return null;
 const x=Math.min(...valid.map(b=>b.x)),y=Math.min(...valid.map(b=>b.y));
 return {x,y,width:Math.max(...valid.map(b=>b.x+b.width))-x,height:Math.max(...valid.map(b=>b.y+b.height))-y};
}
const drawingEvent='ram-drawing-bounds';
type DrawingUpdate={token:string;bounds:DrawingBounds|null};
const noFit=()=>{};
const readyToPaint=()=>true;
type DesktopDrawingArea=DrawingBounds|{workArea:DrawingBounds;scale:number};

export function visibleDesktopDrawingArea(native:DesktopDrawingArea,viewport:DrawingBounds):DrawingBounds{
 // Resolve the current window origin at paint time. Closing a panel can move
 // the native window before its new placement reaches React.
 const area='workArea' in native?{
  x:(native.workArea.x-viewport.x)/native.scale,y:(native.workArea.y-viewport.y)/native.scale,
  width:native.workArea.width/native.scale,height:native.workArea.height/native.scale,
 }:native;
 const x=Math.max(0,area.x),y=Math.max(0,area.y);
 return {x,y,width:Math.max(0,Math.min(viewport.width,area.x+area.width)-x),height:Math.max(0,Math.min(viewport.height,area.y+area.height)-y)};
}

function desktopDrawingArea(layout:HTMLElement):DrawingBounds{
 const width=window.innerWidth,height=window.innerHeight;
 const value=layout.dataset.petPaintArea;
 return value?visibleDesktopDrawingArea(JSON.parse(value),{x:window.screenX,y:window.screenY,width,height}):{x:0,y:0,width,height};
}

/** Keep the ordinary anchor whenever the art fits there. Oversized room
 * effects get one uniform scale so the whole composition remains visible. */
export function fitRoomDrawing(bounds:DrawingBounds,anchor:{x:number;y:number},area:{width:number;height:number}){
 const margin=Math.min(4,area.width/4,area.height/4);
 const scale=Math.min(1,(area.width-2*margin)/bounds.width,(area.height-2*margin)/bounds.height);
 const x=Math.max(margin-bounds.x*scale,Math.min(anchor.x,area.width-margin-(bounds.x+bounds.width)*scale));
 const y=Math.max(margin-bounds.y*scale,Math.min(anchor.y,area.height-margin-(bounds.y+bounds.height)*scale));
 return {x,y,scale};
}

/** Fit the painted part of a surface, leaving its ordinary anchor alone if it fits. */
export function fitDrawingSurface(surface:DrawingBounds,paint:DrawingBounds,area:DrawingBounds){
 const x=paint.x-surface.x,y=paint.y-surface.y;
 const target=fitRoomDrawing({x,y,width:paint.width,height:paint.height},{x:surface.x-area.x,y:surface.y-area.y},area);
 return {x:target.x+area.x-surface.x,y:target.y+area.y-surface.y,scale:target.scale};
}

export function useNativeDrawingBounds(room?:RefObject<HTMLElement|null>){
 const [bounds,setBounds]=useState<DrawingBounds|null>(null);
 useLayoutEffect(()=>{const target=room?room.current:window;if(!target)return;
 const sources=new Map<string,DrawingBounds>();const receive=(event:Event)=>{
  const value=(event as CustomEvent<DrawingUpdate>).detail;
  if(!value?.token)return;if(value.bounds)sources.set(value.token,value.bounds);else sources.delete(value.token);
  const next=drawingUnion([...sources.values()]);setBounds(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
 };target.addEventListener(drawingEvent,receive);return()=>target.removeEventListener(drawingEvent,receive)},[room]);
 return bounds;
}

/** Reserve space using the unmodified source coordinates, then fit the drawing
 * into the available viewport. A SWF reports the artwork inside its padding. */
export function useDrawingSurface(ref:RefObject<HTMLElement|null>,sourceKey:string,sourceContent?:DrawingBounds|null,fitDesktop=true){
 const token=useId(),content=useRef(sourceContent),refresh=useRef(noFit),firstPaintReady=useRef(readyToPaint);
 content.current=sourceContent;
 useLayoutEffect(()=>{
  const node=ref.current;
  if(!node)return;
  const portrait=node.closest<HTMLElement>('.room-pet-portrait');
  const desktop=node.closest<HTMLElement>('.desktop-character')?.closest('.compact-pet');
  const room=node.closest<HTMLElement>('.scene-character')?.closest<HTMLElement>('.room-pet-position');
  const base=desktop??room,target=desktop?window:room?.closest('.room-walker');
  const layout=fitDesktop?desktop?.closest<HTMLElement>('.companion-layout'):null;
  if(!portrait&&!target)return;
  const clearFit=()=>{node.style.removeProperty('translate');node.style.removeProperty('scale');node.style.removeProperty('transform-origin');};
  let frame=0,last:DrawingBounds|null=null,awaitingLayoutSince:number|undefined;
  const publish=(bounds:DrawingBounds|null)=>{
   if(!target||JSON.stringify(bounds)===JSON.stringify(last))return;
   last=bounds;target.dispatchEvent(new CustomEvent<DrawingUpdate>(drawingEvent,{detail:{token,bounds}}));
  };
  const measure=(reserve=true)=>{
   if(layout||portrait)clearFit();
   const part=content.current;
   if(part===null){publish(null);return true;}
   const {left,top,width,height}=node.getBoundingClientRect();
   const surface={x:left,y:top,width,height};
   if(!surface.width||!surface.height){publish(null);return true;}
   const paint={x:left+(part?.x??0)*width,y:top+(part?.y??0)*height,width:(part?.width??1)*width,height:(part?.height??1)*height};
   if(base&&reserve){
    const origin=base.getBoundingClientRect(),scale=Number(room?.dataset.ramDrawingScale)||1;
    const x=(paint.x-origin.left)/scale,y=(paint.y-origin.top)/scale;
    const nearX=Math.floor(x+.01),nearY=Math.floor(y+.01);
    publish({x:nearX,y:nearY,width:Math.ceil(x+paint.width/scale-.01)-nearX,height:Math.ceil(y+paint.height/scale-.01)-nearY});
   }
   if(!portrait&&(!layout||layout.classList.contains('is-edge-docked')))return true;
   const area=portrait?.getBoundingClientRect()??desktopDrawingArea(layout!);
   if(!area.width||!area.height)return false;
   const fit=fitDrawingSurface(surface,paint,area);
   if(fit.x||fit.y)node.style.translate=`${fit.x*node.offsetWidth/width}px ${fit.y*node.offsetHeight/height}px`;
   if(fit.scale<1){
    node.style.transformOrigin='0 0';
    node.style.scale=String(fit.scale);
   }
   return fit.scale===1;
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>measure());};
  const updatePlacement=()=>{measure(false);schedule();};
  refresh.current=updatePlacement;
  firstPaintReady.current=()=>{
   const fits=measure(false);
   if(fits||!layout||!window.desktop?.isElectron)return true;
   // Keep frame one while native artwork bounds and a closing panel settle.
   // A small display can always use the fitted drawing after this grace period.
   const now=performance.now();
   awaitingLayoutSince??=now;
   return now-awaitingLayoutSince>=180;
  };
  const observer=new ResizeObserver(updatePlacement);observer.observe(node);
  if(base)observer.observe(base);
  if(portrait)observer.observe(portrait);
  const placement=layout?new MutationObserver(updatePlacement):null;
  if(layout){observer.observe(document.documentElement);placement?.observe(layout,{attributes:true,attributeFilter:['style','class','data-pet-paint-area']});}
  measure(false);schedule();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();placement?.disconnect();if(layout||portrait)clearFit();publish(null);refresh.current=noFit;firstPaintReady.current=readyToPaint;};
 },[ref,sourceKey,token,fitDesktop]);
 useLayoutEffect(()=>refresh.current(),[sourceContent]);
 return firstPaintReady;
}

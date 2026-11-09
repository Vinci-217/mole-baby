import {useEffect,useState} from 'react';
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
/** Only native players inside the actual desktop character publish bounds.
 * They publish once per mounted source, avoiding resizing on every frame. */
export function useNativeDrawingBounds(){
 const [bounds,setBounds]=useState<DrawingBounds|null>(null);
 useEffect(()=>{const sources=new Map<string,DrawingBounds>();const receive=(event:Event)=>{
  const value=(event as CustomEvent<{token:string;bounds:DrawingBounds|null}>).detail;
  if(!value?.token)return;if(value.bounds)sources.set(value.token,value.bounds);else sources.delete(value.token);
  const next=drawingUnion([...sources.values()]);setBounds(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
 };window.addEventListener('ram-native-drawing-bounds',receive);return()=>window.removeEventListener('ram-native-drawing-bounds',receive)},[]);
 return bounds;
}

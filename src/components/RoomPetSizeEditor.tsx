import {useRef,type PointerEvent} from 'react';
import {draggedRoomPetScale,ROOM_PET_BASE} from '../room-pet-size';
import './RoomPetSizeEditor.css';

export default function RoomPetSizeEditor({scale,maxScale,onChange}:{scale:number;maxScale:number;onChange:(scale:number)=>void}){
 const drag=useRef<{pointer:number;x:number;y:number;scale:number;corner:string}|null>(null);
 function down(event:PointerEvent<HTMLButtonElement>,corner:string){
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,scale,corner};
 }
 function move(event:PointerEvent<HTMLButtonElement>){
  const start=drag.current;if(!start||start.pointer!==event.pointerId)return;
  onChange(draggedRoomPetScale(start.scale,event.clientX-start.x,event.clientY-start.y,start.corner,maxScale));
 }
 return <>
  <div className="room-pet-size-frame" style={{width:ROOM_PET_BASE.width*scale,height:ROOM_PET_BASE.height*scale,left:-ROOM_PET_BASE.width*scale/2,bottom:ROOM_PET_BASE.nameOffset}} role="group" aria-label="拖动边角调整小屋拉姆大小">
   {(['nw','ne','sw','se'] as const).map(corner=><button key={corner} type="button" className={`room-pet-size-handle handle-${corner}`} aria-label={`调整小屋拉姆大小 ${corner}`} onPointerDown={event=>down(event,corner)} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}} onKeyDown={event=>{const delta=event.key==='ArrowUp'||event.key==='ArrowRight' ? .05 : event.key==='ArrowDown'||event.key==='ArrowLeft' ? -.05 : 0;if(delta){event.preventDefault();onChange(Math.min(maxScale,Math.max(.5,scale+delta)))}}}/>)}
  </div>
 </>;
}

export function RoomPetSizeActions({scale,onDefault,onFinish}:{scale:number;onDefault:()=>void;onFinish:(commit:boolean)=>void}){
 return <div className="room-pet-size-actions" role="toolbar" aria-label="小屋拉姆大小设置" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onFinish(false)}}}>
  <span>拖动拉姆边角</span><output aria-label="小屋拉姆缩放比例">{Math.round(scale*100)}%</output>
  <button type="button" onClick={onDefault}>默认</button><button type="button" onClick={()=>onFinish(false)}>取消</button><button type="button" onClick={()=>onFinish(true)}>完成</button>
 </div>;
}

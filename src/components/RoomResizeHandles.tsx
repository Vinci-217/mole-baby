import {useEffect,useRef} from 'react';
import './RoomResizeHandles.css';
const edges=[['n','上边'],['ne','右上角'],['e','右边'],['se','右下角'],['s','下边'],['sw','左下角'],['w','左边'],['nw','左上角']] as const;
export default function RoomResizeHandles(){
 const pointer=useRef<number|null>(null);
 useEffect(()=>()=>{void window.desktop?.endRoomResize().catch(()=>{})},[]);
 const stop=()=>{pointer.current=null;void window.desktop?.endRoomResize().catch(()=>{})};
 return <div className="room-resize-handles">{edges.map(([edge,label])=><button key={edge} type="button" className={`room-resize-edge edge-${edge}`} aria-label={`调整小屋${label}大小`} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);void window.desktop?.startRoomResize(edge).then(ok=>{if(ok&&pointer.current===null)stop()}).catch(stop)}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onKeyDown={e=>{const delta=e.shiftKey?64:16;const dx=e.key==='ArrowRight'?delta:e.key==='ArrowLeft'?-delta:0,dy=e.key==='ArrowDown'?delta:e.key==='ArrowUp'?-delta:0;if(!dx&&!dy)return;e.preventDefault();void window.desktop?.adjustRoomSize(dx,dy).catch(()=>{})}}/>)}</div>;
}

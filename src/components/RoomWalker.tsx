import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {KeyboardEvent,PointerEvent,ReactNode} from 'react'
import type {Stage,Evolution} from '../game'
import visibility from '../../electron/edge-visibility.json'
import {ramForm} from '../original-actions'
import {roomWalkArea,roomWalkTarget,stepRoomWalk,type RoomPoint} from '../room-walk'
import './RoomWalker.css'

export default function RoomWalker({stage,evolution,blocked,children}:{stage:Stage;evolution?:Evolution;blocked:boolean;children:(action:string|null)=>ReactNode}) {
 const root=useRef<HTMLDivElement>(null),point=useRef<RoomPoint>({x:0,y:0}),placedByUser=useRef(false)
 const [area,setArea]=useState(()=>roomWalkArea(1000,750)),[position,setPosition]=useState<RoomPoint|null>(null)
 const [target,setTarget]=useState<RoomPoint|null>(null),[moving,setMoving]=useState(false),[direction,setDirection]=useState('walk-right')
 useLayoutEffect(()=>{
  const element=root.current;if(!element)return
  const measure=()=>{
   const box=element.getBoundingClientRect(),dock=element.parentElement?.querySelector('.room-dock')?.getBoundingClientRect()
   const next=roomWalkArea(box.width,box.height,dock?dock.top-box.top:undefined);setArea(next)
   point.current=roomWalkTarget(placedByUser.current?point.current:{x:box.width/2,y:next.bottom-25},next)
   setPosition(point.current);setTarget(t=>t?roomWalkTarget(t,next):null)
  }
  const observer=new ResizeObserver(measure);observer.observe(element)
  const dock=element.parentElement?.querySelector('.room-dock');if(dock)observer.observe(dock)
  measure();return()=>observer.disconnect()
 },[])
 useEffect(()=>{
  if(blocked||!target){setMoving(false);if(blocked)setTarget(null);return}
  const media=window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame=0,last=0,cancelled=false
  const finish=()=>{point.current=target;setPosition(target);setMoving(false);setTarget(null)}
  const tick=(now:number)=>{
   if(cancelled)return
   if(media.matches){finish();return}
   const delta=last&&!document.hidden?now-last:0;last=now
   const result=stepRoomWalk(point.current,target,delta,stage>=3?105:125)
   if(result.finished){finish();return}
   point.current=result.point;setPosition(result.point);setMoving(true);frame=requestAnimationFrame(tick)
  }
  setDirection(target.x<point.current.x?'walk-left':'walk-right')
  frame=requestAnimationFrame(tick)
  return()=>{cancelled=true;cancelAnimationFrame(frame)}
 },[target,blocked,stage])
 const go=(next:RoomPoint)=>{if(!blocked){placedByUser.current=true;setTarget(roomWalkTarget(next,area))}}
 const down=(e:PointerEvent<HTMLButtonElement>)=>{
  if(e.button!==0)return
  const box=root.current?.getBoundingClientRect();if(box)go({x:e.clientX-box.left,y:e.clientY-box.top})
 }
 const key=(e:KeyboardEvent<HTMLButtonElement>)=>{
  const delta=({ArrowLeft:[-50,0],ArrowRight:[50,0],ArrowUp:[0,-30],ArrowDown:[0,30]} as Record<string,number[]>)[e.key]
  if(delta){e.preventDefault();go({x:point.current.x+delta[0],y:point.current.y+delta[1]})}
 }
 const motion=(!blocked&&moving)?stage===0?'waiting':direction:null
 // Match the measured original body baseline, rather than the name label.
 // Room CSS fixes the character at 150x163, 20px above its name anchor.
 const footOffset=183-visibility.forms[ramForm(stage,evolution)].body[3]*1.5
 return <div ref={root} className={`room-walker ${moving&&!blocked?'is-moving':''}`} data-stage={stage} data-moving={moving&&!blocked}>
  <button className="room-walk-surface" aria-label="小屋地面，点击让拉姆走过去" disabled={blocked} onPointerDown={down} onKeyDown={key}
   style={{left:area.left,top:area.top,width:area.right-area.left,height:area.bottom-area.top}}/>
  {!blocked&&target&&<span className="room-walk-target" aria-hidden="true" style={{left:target.x,top:target.y}}/>}
  <div className="room-pet-position" style={{left:position?.x??'50%',top:position?position.y+footOffset:'72%'}} data-speech-side={(position?.x??area.width/2)>area.width/2?'left':'right'} data-x={position?.x.toFixed(2)} data-y={position?.y.toFixed(2)}>{children(motion)}</div>
 </div>
}

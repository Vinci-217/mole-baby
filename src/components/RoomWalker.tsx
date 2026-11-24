import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {CSSProperties,KeyboardEvent,PointerEvent,ReactNode} from 'react'
import type {Stage,Evolution} from '../game'
import visibility from '../../electron/edge-visibility.json'
import {ramForm} from '../original-actions'
import {roomWalkLayout,roomWalkClickTop,roomWalkTarget,stepRoomWalk,type RoomPoint} from '../room-walk'
import {fitRoomDrawing,useNativeDrawingBounds} from '../original-viewport'
import {MIDDLE_WALK_RISE} from '../frame-registration'
import './RoomWalker.css'
import {ROOM_PET_BASE} from '../room-pet-size'
import RoomPetSizeEditor,{RoomPetSizeActions} from './RoomPetSizeEditor'

export default function RoomWalker({stage,evolution,blocked:interactionBlocked,randomWalk=true,scale=1,sizing=false,onScale,onSizeFinish,furnitureSeat,onDismount,onWalkingChange,children}:{stage:Stage;evolution?:Evolution;blocked:boolean;randomWalk?:boolean;scale?:number;sizing?:boolean;onScale?:(scale:number)=>void;onSizeFinish?:(commit:boolean)=>void;furnitureSeat?:RoomPoint;onDismount?:()=>void;onWalkingChange?:(walking:boolean)=>void;children:(action:string|null)=>ReactNode}) {
 const blocked=interactionBlocked||stage===0||sizing
 const walkingBlocked=blocked||Boolean(furnitureSeat)
 const root=useRef<HTMLDivElement>(null),petAnchor=useRef<HTMLDivElement>(null)
 const point=useRef<RoomPoint>({x:0,y:0}),positioned=useRef(false)
 const paintPosition=useRef<(point:RoomPoint)=>void>(()=>{})
 const drawing=useNativeDrawingBounds(root)
 const headroom=stage===2?MIDDLE_WALK_RISE*ROOM_PET_BASE.height:0
 const [{area,scale:effectiveScale,maxScale},setLayout]=useState(()=>roomWalkLayout(1000,750,undefined,scale,headroom))
 const [drawingArea,setDrawingArea]=useState({top:0,width:1000,height:750})
 const [target,setTarget]=useState<RoomPoint|null>(null),[walkAction,setWalkAction]=useState<string|null>(null)
 // Keep the original body baseline registered independently of the name label.
 const footOffset=ROOM_PET_BASE.nameOffset+(ROOM_PET_BASE.height-visibility.forms[ramForm(stage,evolution)].body[3]*1.5)*effectiveScale
 useLayoutEffect(()=>{
  const element=root.current;if(!element)return
  const room=element.parentElement;
  const header=room?.querySelector('.cottage-top'),dock=room?.querySelector('.room-dock');
  const tools=room?.querySelector('.room-side-tools'),footer=room?.querySelector('.classic-footer');
  const measure=()=>{
   const box=element.getBoundingClientRect(),dockRect=dock?.getBoundingClientRect();
   const top=Math.max(0,(header?.getBoundingClientRect().bottom??box.top)-box.top);
   const bottom=Math.min(dockRect?.top??box.bottom,footer?.getBoundingClientRect().top??box.bottom)-box.top;
   const width=Math.max(1,(tools?.getBoundingClientRect().left??box.right)-box.left);
   setDrawingArea({top,width,height:Math.max(1,bottom-top-28)});
   const layout=roomWalkLayout(box.width,box.height,dockRect?dockRect.top-box.top:undefined,scale,headroom),next=layout.area
   setLayout(layout)
   point.current=roomWalkTarget(positioned.current?point.current:{x:box.width/2,y:next.bottom-25},next);positioned.current=true
   setTarget(t=>t?roomWalkTarget(t,next):null)
  }
  const observer=new ResizeObserver(measure);observer.observe(element)
  for(const chrome of [header,dock,tools,footer])if(chrome)observer.observe(chrome);
  measure();return()=>observer.disconnect()
 },[scale,headroom])
 useLayoutEffect(()=>{
  const element=petAnchor.current;if(!element)return
  const paint=(position:RoomPoint)=>{
   const anchor={x:position.x,y:position.y+footOffset}
   const fit=drawing&&drawingArea.width>1&&drawingArea.height>1
    ?fitRoomDrawing(drawing,{x:anchor.x,y:anchor.y-drawingArea.top},drawingArea):null
   const x=fit?.x??anchor.x,y=fit?fit.y+drawingArea.top:anchor.y;
   const scale=fit?.scale??1
   element.style.transform=`translate(${x}px,${y}px)${scale<1?` scale(${scale})`:''}`
   if(fit)element.dataset.ramDrawingScale=String(scale)
   else if(element.hasAttribute('data-ram-drawing-scale'))delete element.dataset.ramDrawingScale
   if(drawing)element.style.setProperty('--room-performance-caption',`${Math.max(8,drawing.y+drawing.height+5)}px`);
   else element.style.removeProperty('--room-performance-caption');
   const side=position.x>area.width/2?'left':'right'
   if(element.dataset.speechSide!==side)element.dataset.speechSide=side
   element.dataset.x=position.x.toFixed(2)
   element.dataset.y=position.y.toFixed(2)
  }
  paintPosition.current=paint
  if(positioned.current)paint(point.current)
 },[area,drawing,drawingArea,footOffset])
 useLayoutEffect(()=>{
  if(!furnitureSeat)return
  // Furniture positions are percentages of the room. Start the next walk
  // beside the current piece, even after resizing or moving the furniture.
  point.current=roomWalkTarget({x:furnitureSeat.x*area.width/100,y:furnitureSeat.y*area.height/100},area)
  paintPosition.current(point.current)
 },[furnitureSeat,area])
 useEffect(()=>()=>onWalkingChange?.(false),[onWalkingChange])
 useEffect(()=>{
  if(walkingBlocked||!target){setWalkAction(null);if(walkingBlocked)setTarget(null);onWalkingChange?.(false);return}
  const media=window.matchMedia('(prefers-reduced-motion: reduce)')
  const direction=target.x<point.current.x?'walk-left':'walk-right'
  let frame=0,last=0,started=false
  const finish=()=>{point.current=target;paintPosition.current(target);setWalkAction(null);setTarget(null)}
  const tick=(now:number)=>{
   if(media.matches){finish();return}
   const delta=last&&!document.hidden?now-last:0;last=now
   const result=stepRoomWalk(point.current,target,delta,stage>=3?105:125)
   if(result.finished){finish();return}
   point.current=result.point;paintPosition.current(result.point)
   if(!started){started=true;setWalkAction(direction)}
   frame=requestAnimationFrame(tick)
  }
  frame=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(frame)
 },[target,walkingBlocked,stage,onWalkingChange])
 useEffect(()=>{
  if(!randomWalk||walkingBlocked||target||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const timer=window.setInterval(()=>{
   if(document.hidden)return;
   onWalkingChange?.(true);
   setTarget(roomWalkTarget({x:area.left+Math.random()*(area.right-area.left),y:area.top+Math.random()*(area.bottom-area.top)},area));
  },10000+Math.random()*8000);
  return()=>window.clearInterval(timer);
 },[randomWalk,walkingBlocked,target,stage,area,onWalkingChange]);
 const go=(next:RoomPoint,manual=false)=>{
  if(blocked||(!furnitureSeat&&manual&&next.y<roomWalkClickTop(area)))return
  onWalkingChange?.(true)
  if(furnitureSeat)onDismount?.()
  setTarget(roomWalkTarget(next,area))
 }
 useEffect(()=>{
  const element=root.current;if(!element)return
  const redirect=(event:Event)=>{
   const detail=(event as CustomEvent<{clientX:number;clientY:number}>).detail,box=element.getBoundingClientRect();if(!detail)return
   // The pet's transparent padding must yield to a visible furniture control
   // underneath it before treating the point as a floor destination.
   const furniture=document.elementsFromPoint(detail.clientX,detail.clientY).map(node=>node.closest<HTMLButtonElement>('[data-room-interactive="true"]')).find(Boolean)
   if(furniture){furniture.click();return}
   go({x:detail.clientX-box.left,y:detail.clientY-box.top},true)
  }
  element.addEventListener('room-walk-redirect',redirect);return()=>element.removeEventListener('room-walk-redirect',redirect)
 },[area,blocked,furnitureSeat,onDismount,onWalkingChange])
 const down=(e:PointerEvent<HTMLButtonElement>)=>{
  if(e.button!==0)return
  const box=root.current?.getBoundingClientRect();if(box)go({x:e.clientX-box.left,y:e.clientY-box.top},true)
 }
 const key=(e:KeyboardEvent<HTMLButtonElement>)=>{
  const delta=({ArrowLeft:[-50,0],ArrowRight:[50,0],ArrowUp:[0,-30],ArrowDown:[0,30]} as Record<string,number[]>)[e.key]
  if(delta){e.preventDefault();go({x:point.current.x+delta[0],y:point.current.y+delta[1]})}
 }
 const motion=walkingBlocked?null:walkAction
 return <div ref={root} className={`room-walker ${motion?'is-moving':''} ${sizing?'is-sizing':''}`} data-stage={stage} data-moving={Boolean(motion)} data-pet-scale={effectiveScale}
  style={{'--room-pet-width':`${ROOM_PET_BASE.width*effectiveScale}px`,'--room-pet-height':`${ROOM_PET_BASE.height*effectiveScale}px`,'--room-pet-foot-offset':`${footOffset}px`} as CSSProperties}>
  <button className="room-walk-surface" aria-label="小屋地面，点击让拉姆走过去" disabled={blocked} onPointerDown={down} onKeyDown={key}
  style={furnitureSeat?{left:0,top:0,width:area.width,height:area.height}:{left:area.left,top:roomWalkClickTop(area),width:area.right-area.left,height:area.bottom-roomWalkClickTop(area)}}/>
  {!walkingBlocked&&target&&<span className="room-walk-target" aria-hidden="true" style={{left:target.x,top:target.y}}/>}
  <div ref={petAnchor} className="room-pet-position">{children(motion)}{sizing&&onScale&&onSizeFinish&&<RoomPetSizeEditor scale={effectiveScale} maxScale={maxScale} onChange={onScale}/>}</div>
  {sizing&&onScale&&onSizeFinish&&<RoomPetSizeActions scale={effectiveScale} onDefault={()=>onScale(1)} onFinish={onSizeFinish}/>}
 </div>
}

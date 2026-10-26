import {useRef,useState} from 'react'
import type {CSSProperties,PointerEvent} from 'react'
import type {GameState} from '../game'
import type {RoomMediaController} from '../room-media'
import {COURSES,learned} from '../pet-school'
import {FURNITURE,furnitureById,furnitureImage,canOwn,hasRoomWall,type Placement} from '../room-furnishings'
import './RoomFurnishings.css'

export function RoomFurnishingLayer({pet,edit=false,hasWall=true,onPlace}:{pet:GameState;edit?:boolean;hasWall?:boolean;onPlace?:(id:string,x:number,y:number)=>void}){
 const root=useRef<HTMLDivElement>(null),drag=useRef<{id:string;pointer:number;dx:number;dy:number}|null>(null),[moving,setMoving]=useState<Placement|null>(null)
 function down(e:PointerEvent<HTMLButtonElement>,p:Placement){const r=root.current?.getBoundingClientRect();if(!edit||e.button!==0||!r)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:p.id,pointer:e.pointerId,dx:(e.clientX-r.x)/r.width*100-p.x,dy:(e.clientY-r.y)/r.height*100-p.y};setMoving(p)}
 function move(e:PointerEvent<HTMLButtonElement>){const d=drag.current,r=root.current?.getBoundingClientRect();if(!d||!r||d.pointer!==e.pointerId)return;const f=furnitureById(d.id)!;setMoving({id:d.id,x:Math.max(10,Math.min(90,(e.clientX-r.x)/r.width*100-d.dx)),y:Math.max(f.surface==='wall'?20:66,Math.min(f.surface==='wall'?40:81,(e.clientY-r.y)/r.height*100-d.dy))})}
 function up(e:PointerEvent<HTMLButtonElement>){if(drag.current?.pointer!==e.pointerId)return;if(moving&&e.type!=='pointercancel')onPlace?.(moving.id,moving.x,moving.y);drag.current=null;setMoving(null)}
 return <div ref={root} className={`room-furnishing-layer ${edit?'is-editing':''}`} aria-label={edit?'拖动摆设，墙饰放墙面，家具放地面':'小屋摆设'}>{edit&&<>{hasWall&&<span className="furnishing-wall-zone">墙面</span>}<span className="furnishing-floor-zone">地面</span></>}{(pet.room?.placed??[]).filter(p=>canOwn(pet,p.id)&&(hasWall||furnitureById(p.id)?.surface!=='wall')).map(saved=>{
  const p=moving?.id===saved.id?moving:saved,f=furnitureById(p.id)!;return <button key={p.id} className={`room-placed-item on-${f.surface}`} data-furniture={p.id} data-surface={f.surface} aria-label={f.name} tabIndex={edit?0:-1} style={{left:`${p.x}%`,top:`${p.y}%`,width:`${f.width}%`,zIndex:f.surface==='wall'?1:Math.round(p.y)} as CSSProperties} onPointerDown={e=>down(e,p)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><img src={furnitureImage(p.id)} alt="" draggable={false}/>{p.id.startsWith('certificate-')&&<span>{f.name.replace('结业证书','')}</span>}</button>
 })}</div>
}
export function RoomFurnishingEditor({pet,media,onBuy,onPlace,onRemove}:{pet:GameState;media:RoomMediaController;onBuy:(id:string)=>void;onPlace:(id:string,x:number,y:number)=>void;onRemove:(id:string)=>void}){
 const canvas=useRef<HTMLDivElement>(null),[selectedSurface,setSurface]=useState<'wall'|'floor'>('floor'),hasWall=hasRoomWall(media.background.id),surface=hasWall?selectedSurface:'floor',certs=COURSES.filter(c=>learned(pet,c.id)).map(c=>furnitureById(`certificate-${c.id}`)!),items=[...FURNITURE,...certs].filter(f=>f.surface===surface)
 function put(id:string,surface:string){onPlace(id,50,surface==='wall'?32:75);canvas.current?.scrollIntoView({block:'center',behavior:'auto'})}
 const sheet={x:media.phase==='noon'||media.phase==='night'?'100%':'0%',y:media.phase==='dusk'||media.phase==='night'?'100%':'0%'}
 return <section className="furnishing-editor" aria-label="小屋家具布置"><header><h3>把小屋布置成喜欢的样子</h3><span>{pet.coins} 摩尔豆</span></header><div ref={canvas} className="furnishing-canvas"><div className={`furnishing-background ${media.background.phaseSheet?'is-sheet':''}`} style={{backgroundImage:`url("${media.background.src}")`,'--scene-x':sheet.x,'--scene-y':sheet.y} as CSSProperties}/><RoomFurnishingLayer pet={pet} edit hasWall={hasWall} onPlace={onPlace}/></div><div className="furnishing-tools" role="group" aria-label="摆设位置"><button aria-pressed={surface==='floor'} onClick={()=>setSurface('floor')}>地面家具</button><button disabled={!hasWall} aria-pressed={surface==='wall'} onClick={()=>setSurface('wall')}>墙饰与证书</button><span>{hasWall?'拖动调整位置 · 自动保存':'露天场景没有墙面，回室内再挂墙饰'}</span></div><div className="furnishing-catalogue">{items.map(f=>{
  const owned=canOwn(pet,f.id),placed=pet.room?.placed.some(p=>p.id===f.id)
  return <article key={f.id}><img alt="" src={furnitureImage(f.id)}/><strong>{f.name}</strong><span>{f.id.startsWith('certificate-')?'结业获得':owned?'已拥有':`${f.price} 豆`}</span><button className="game-button small" disabled={!owned&&pet.coins<f.price} onClick={()=>!owned?onBuy(f.id):placed?onRemove(f.id):put(f.id,f.surface)}>{!owned?'购买':placed?'收回箱子':'放进小屋'}</button></article>
 })}</div>{surface==='wall'&&!certs.length&&<p>学完一门课程，结业证书就会出现在这里。</p>}</section>
}

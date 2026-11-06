import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CSSProperties,PointerEvent} from 'react';
import type {GameState} from '../game';
import type {RoomMediaController} from '../room-media';
import {COURSES,learned} from '../pet-school';
import {FURNITURE,furnitureById,furnitureImage,furniturePixelWidth,canOwn,placementKey,furnitureScale,MAX_PLACED_FURNITURE,type Placement} from '../room-furnishings';
import {furnitureArt,furnitureHit} from '../furniture-art';
import './RoomFurnishings.css';

type Place=(id:string,x:number,y:number,instanceId?:string,scale?:number,order?:number)=>void;
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
interface PieceDrag{kind:'move'|'resize';pointer:number;piece:Placement;latest:Placement;start:{x:number;y:number};rect:DOMRect;root:DOMRect;corner?:string}
function FurnitureImage({id}:{id:string}){
 const a=furnitureArt(id);
 return <span className="furniture-art-crop"><img src={furnitureImage(id)} alt="" draggable={false} style={{position:'absolute',left:`${-a.left/a.width*100}%`,top:`${-a.top/a.height*100}%`,width:`${a.imageWidth/a.width*100}%`,height:`${a.imageHeight/a.height*100}%`}}/>{id.startsWith('certificate-')&&<span>{furnitureById(id)!.name.replace('结业证书','')}</span>}</span>;
}
export function RoomFurnishingLayer({pet,edit=false,onPlace,onRemove,onActivate}:{pet:GameState;edit?:boolean;hasWall?:boolean;onPlace?:Place;onRemove?:(key:string)=>void;onActivate?:(id:string)=>void}){
 const controls=useRef<HTMLElement>(null),[controlSize,setControlSize]=useState({width:282,height:110});
 const root=useRef<HTMLDivElement>(null),drag=useRef<PieceDrag|null>(null),[moving,setMoving]=useState<Placement|null>(null),[selected,setSelected]=useState<string|null>(null),[roomSize,setRoomSize]=useState({width:760,height:480,scale:1});
 const pieces=(pet.room?.placed??[]).filter(p=>canOwn(pet,p.id)),chosen=pieces.find(p=>placementKey(p)===selected),active=moving??chosen;
 useEffect(()=>{if(!edit){setSelected(null);setMoving(null);drag.current=null}else if(selected&&!chosen)setSelected(null)},[edit,selected,chosen]);
 useLayoutEffect(()=>{
  const layer=root.current;if(!layer)return;
  const update=()=>{const r=layer.getBoundingClientRect();setRoomSize({width:r.width,height:r.height,scale:layer.closest('.furnishing-canvas')?Math.min(1,r.width/760,r.height/480):Math.min(1,Math.max(.75,r.width/760))})};
  update();const observer=new ResizeObserver(update);observer.observe(layer);return()=>observer.disconnect();
 },[]);
 useLayoutEffect(()=>{
  const panel=controls.current;if(!panel)return;
  const observer=new ResizeObserver(([entry])=>setControlSize({width:entry.borderBoxSize?.[0]?.inlineSize??panel.offsetWidth,height:entry.borderBoxSize?.[0]?.blockSize??panel.offsetHeight}));observer.observe(panel);return()=>observer.disconnect();
 },[edit,selected]);
 let controlsTop=82;
 if(active){
  const art=furnitureArt(active.id),width=Math.min(furniturePixelWidth(active.id)*roomSize.scale*furnitureScale(active),roomSize.width-8,(roomSize.height-8)*art.width/art.height),height=width*art.height/art.width;
  const bottom=clamp(active.y/100*roomSize.height,height+4,roomSize.height-4),top=bottom-height,minimumTop=Math.min(82,Math.max(50,roomSize.height*.15)),above=top-controlSize.height-14;
  controlsTop=above>=minimumTop?above:bottom+14+controlSize.height<roomSize.height-95?bottom+14:minimumTop;
 }
 const commit=(p:Placement)=>onPlace?.(p.id,p.x,p.y,placementKey(p),p.scale,p.order);
 function start(e:PointerEvent<HTMLElement>,piece:Placement,rect:DOMRect,kind:PieceDrag['kind'],corner?:string){
  const area=root.current?.getBoundingClientRect();if(!area||e.button!==0)return;
  e.preventDefault();setSelected(placementKey(piece));root.current!.setPointerCapture(e.pointerId);drag.current={kind,pointer:e.pointerId,piece,latest:piece,start:{x:e.clientX,y:e.clientY},rect,root:area,corner};setMoving(piece);
 }
 function down(e:PointerEvent<HTMLDivElement>){
  if(!edit||e.button!==0||(e.target as Element).closest('.furniture-controls,.furniture-handle'))return;
  // A transparent hit must not let the browser focus the top rectangular
  // button afterward and undo the alpha-based selection below.
  e.preventDefault();
  // Pick by original alpha, from front to back, including overlapped copies.
  const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('.room-placed-item')].reverse().sort((a,b)=>Number(b.parentElement!.style.zIndex)-Number(a.parentElement!.style.zIndex));
  for(const button of buttons){const rect=button.getBoundingClientRect(),piece=pieces.find(p=>placementKey(p)===button.dataset.instance)!;if(furnitureHit(piece.id,(e.clientX-rect.x)/rect.width,(e.clientY-rect.y)/rect.height)){start(e,piece,rect,'move');return}}
  setSelected(null);
 }
 function move(e:PointerEvent<HTMLDivElement>){
  const d=drag.current;if(!d||d.pointer!==e.pointerId)return;
  const dx=e.clientX-d.start.x,dy=e.clientY-d.start.y;
  let next:Placement;
  if(d.kind==='move')next={...d.piece,x:clamp((d.rect.x+d.rect.width/2+dx-d.root.x)/d.root.width*100),y:clamp((d.rect.bottom+dy-d.root.y)/d.root.height*100)};
  else{
   const sx=d.corner!.includes('e')?1:-1,sy=d.corner!.includes('s')?1:-1;
   const scale=clamp(furnitureScale(d.piece)*(1+(dx*sx*d.rect.width+dy*sy*d.rect.height)/(d.rect.width**2+d.rect.height**2)),.25,3),factor=scale/furnitureScale(d.piece),width=d.rect.width*factor,height=d.rect.height*factor;
   const left=(sx===1?d.rect.left:d.rect.right)-(sx===1?0:width),top=(sy===1?d.rect.top:d.rect.bottom)-(sy===1?0:height);
   next={...d.piece,scale:Math.round(scale*100)/100,x:clamp((left+width/2-d.root.x)/d.root.width*100),y:clamp((top+height-d.root.y)/d.root.height*100)};
  }
  d.latest=next;setMoving(next);
 }
 function up(e:PointerEvent<HTMLDivElement>){
  const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;
  if(e.type!=='pointercancel')commit(d.latest);setMoving(null);
  if(root.current?.hasPointerCapture(e.pointerId))root.current.releasePointerCapture(e.pointerId);
 }
 function drop(e:React.DragEvent<HTMLDivElement>){
  if(!edit)return;e.preventDefault();const id=e.dataTransfer.getData('text/furniture'),r=root.current?.getBoundingClientRect();if(!r||!furnitureById(id)||!canOwn(pet,id))return;
  onPlace?.(id,clamp((e.clientX-r.x)/r.width*100),clamp((e.clientY-r.y)/r.height*100));
 }
 function key(e:React.KeyboardEvent<HTMLButtonElement>,p:Placement){
  if(!edit)return;const step=e.shiftKey?3:.6;
  const delta:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  if(delta[e.key]){e.preventDefault();commit({...p,x:clamp(p.x+delta[e.key][0]),y:clamp(p.y+delta[e.key][1])})}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();onRemove?.(placementKey(p))}
 }
 return <div ref={root} className={`room-furnishing-layer ${edit?'is-editing':''}`} aria-label={edit?'拖动或缩放家具，可在小屋任意位置摆放':'小屋摆设'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDragOver={e=>{if(edit)e.preventDefault()}} onDrop={drop}>
  {edit&&!chosen&&<span className="furnishing-free-hint">从仓库拖入家具 · 选中后拖动、缩放或复制</span>}
  {pieces.map((saved,index)=>{
   const p=moving&&placementKey(moving)===placementKey(saved)?moving:saved,f=furnitureById(p.id)!,a=furnitureArt(p.id),width=Math.min(furniturePixelWidth(p.id)*roomSize.scale*furnitureScale(p),roomSize.width-8,(roomSize.height-8)*a.width/a.height),height=width*a.height/a.width,selectedPiece=edit&&selected===placementKey(p);
   return <div className={`room-piece ${selectedPiece?'is-selected':''}`} key={placementKey(p)} style={{left:`clamp(${width/2+4}px,${p.x}%,calc(100% - ${width/2+4}px))`,top:`clamp(${height+4}px,${p.y}%,calc(100% - 4px))`,width,height,zIndex:p.order!==undefined?100+p.order:Math.round(p.y)+2} as CSSProperties}>
    <button className="room-placed-item" data-furniture={p.id} data-room-interactive={!edit&&p.id==='message-board'?'true':undefined} data-instance={placementKey(p)} data-surface={f.surface} aria-label={pieces.findIndex(item=>item.id===p.id)===index?f.name:`${f.name} ${index+1}`} aria-pressed={edit?selectedPiece:undefined} tabIndex={edit||p.id==='message-board'?0:-1} onFocus={()=>{if(edit)setSelected(placementKey(p))}} onKeyDown={e=>key(e,p)} onClick={()=>{if(!edit)onActivate?.(p.id)}}><FurnitureImage id={p.id}/></button>
    {selectedPiece&&(['nw','ne','sw','se'] as const).map(corner=><button key={corner} className={`furniture-handle handle-${corner}`} aria-label={`缩放${f.name} ${corner}`} onPointerDown={e=>{e.stopPropagation();const rect=e.currentTarget.parentElement!.querySelector('.room-placed-item')!.getBoundingClientRect();start(e,p,rect,'resize',corner)}}/>)}
   </div>;
  })}
  {edit&&active&&root.current?.parentElement&&createPortal(<section ref={controls} className="furniture-controls" style={{top:controlsTop,bottom:'auto'}} aria-label="选中家具设置" onPointerDown={e=>e.stopPropagation()}>
   <header><strong>{furnitureById(active.id)!.name}</strong><button aria-label="取消家具选择" onClick={()=>setSelected(null)}>×</button></header>
   <label><span>大小</span><input type="range" min="25" max="300" step="1" aria-label="家具大小" value={Math.round(furnitureScale(active)*100)} onChange={e=>commit({...active,scale:Number(e.target.value)/100})}/><output>{Math.round(furnitureScale(active)*100)}%</output></label>
   <div><button onClick={()=>commit({...active,scale:1})}>默认大小</button><button disabled={pieces.length>=MAX_PLACED_FURNITURE} onClick={()=>onPlace?.(active.id,clamp(active.x+6),clamp(active.y+4),undefined,furnitureScale(active))}>复制一件</button><button onClick={()=>commit({...active,order:Math.min(10000,Math.max(0,...pieces.map(p=>p.order??0))+1)})}>移到前面</button><button onClick={()=>onRemove?.(placementKey(active))}>收回</button></div>
  </section>,root.current.parentElement)}
 </div>;
}

export function RoomFurnishingEditor({pet,media,onBuy,onPlace,onRemove,inline=false}:{pet:GameState;media:RoomMediaController;onBuy:(id:string)=>void;onPlace:Place;onRemove:(key:string)=>void;inline?:boolean}){
 const canvas=useRef<HTMLDivElement>(null),[query,setQuery]=useState(''),[ownedOnly,setOwnedOnly]=useState(false),certs=COURSES.filter(c=>learned(pet,c.id)).map(c=>furnitureById(`certificate-${c.id}`)!),items=[...FURNITURE,...certs].filter(f=>f.name.includes(query.trim())&&(!ownedOnly||canOwn(pet,f.id))).sort((a,b)=>Number(Boolean(b.dragOnly))-Number(Boolean(a.dragOnly)));
 const touchDrag=useRef<{id:string;pointer:number;x:number;y:number}|null>(null),[preview,setPreview]=useState<{id:string;x:number;y:number}|null>(null);
 function startTouch(e:PointerEvent<HTMLElement>,id:string){
  if(e.pointerType==='mouse'||e.button!==0||!canOwn(pet,id)||(e.target as Element).closest('button')||id!=='message-board'&&!(e.target as Element).closest('img'))return;
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touchDrag.current={id,pointer:e.pointerId,x:e.clientX,y:e.clientY};
 }
 function moveTouch(e:PointerEvent<HTMLElement>){const d=touchDrag.current;if(d&&d.pointer===e.pointerId&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>5)setPreview({id:d.id,x:e.clientX,y:e.clientY})}
 function endTouch(e:PointerEvent<HTMLElement>){
  const d=touchDrag.current;if(!d||d.pointer!==e.pointerId)return;
  touchDrag.current=null;setPreview(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  if(e.type==='pointercancel'||Math.hypot(e.clientX-d.x,e.clientY-d.y)<=5)return;
  const layer=document.elementFromPoint(e.clientX,e.clientY)?.closest('.room-furnishing-layer.is-editing'),r=layer?.getBoundingClientRect();if(r)onPlace(d.id,clamp((e.clientX-r.x)/r.width*100),clamp((e.clientY-r.y)/r.height*100));
 }
 function put(id:string){const count=pet.room?.placed.length??0;onPlace(id,38+count%4*8,60+Math.floor(count/4)%3*7);canvas.current?.scrollIntoView({block:'center',behavior:'auto'})}
 const sheet={x:media.phase==='noon'||media.phase==='night'?'100%':'0%',y:media.phase==='dusk'||media.phase==='night'?'100%':'0%'};
 return <section className="furnishing-editor" aria-label="小屋家具布置"><header><h3>家具仓库</h3><span>{pet.coins} 摩尔豆</span></header>{!inline&&<div ref={canvas} className="furnishing-canvas"><div className={`furnishing-background ${media.background.phaseSheet?'is-sheet':''}`} style={{backgroundImage:`url("${media.background.src}")`,'--scene-x':sheet.x,'--scene-y':sheet.y} as CSSProperties}/><RoomFurnishingLayer pet={pet} edit onPlace={onPlace} onRemove={onRemove}/></div>}
  <div className="furnishing-tools"><input type="search" aria-label="查找家具" placeholder="查找家具" value={query} onChange={e=>setQuery(e.target.value)}/><label><input type="checkbox" checked={ownedOnly} onChange={e=>setOwnedOnly(e.target.checked)}/>已拥有</label><span>可重复摆放 · 任意位置 · 选中后拖角缩放</span></div>
  <div className="furnishing-catalogue">{items.map(f=>{const owned=canOwn(pet,f.id),count=pet.room?.placed.filter(p=>p.id===f.id).length??0;return <article key={f.id} className={f.dragOnly?'warehouse-drag-card':''} draggable={owned} onDragStart={e=>{if(owned)e.dataTransfer.setData('text/furniture',f.id)}} onPointerDown={e=>startTouch(e,f.id)} onPointerMove={moveTouch} onPointerUp={endTouch} onPointerCancel={endTouch}>
   <img alt="" draggable={false} src={furnitureImage(f.id)}/><strong>{f.name}</strong><span>{owned?`已拥有 · 已摆 ${count} 件`:`${f.price} 豆`}</span>{f.dragOnly?<small className="warehouse-drag-hint">按住拖进小屋使用</small>:<button className="game-button small" disabled={owned?(pet.room?.placed.length??0)>=MAX_PLACED_FURNITURE:pet.coins<f.price} onClick={()=>owned?put(f.id):onBuy(f.id)}>{!owned?'购买':count?'再放一件':'放进小屋'}</button>}
  </article>})}</div>{!items.length&&<p>没有找到这件家具，试试其他名称。</p>}{preview&&<img className="warehouse-drag-preview" alt="" src={furnitureImage(preview.id)} style={{left:preview.x,top:preview.y}}/>}
 </section>;
}

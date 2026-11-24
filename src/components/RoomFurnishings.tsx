import {memo,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Copy, Move, X} from 'lucide-react';
import type {CSSProperties,PointerEvent} from 'react';
import type {GameState} from '../game';
import type {RoomMediaController} from '../room-media';
import {COURSES,learned} from '../pet-school';
import {canOwn,placementKey,furnitureScale,frontFurnitureOrder,MAX_PLACED_FURNITURE,isRoomInteractiveFurniture,MUSIC_BOX_ID,MUSIC_BOX_HOME_POSITION,type Placement} from '../room-furnishings';
import {FURNITURE,furnitureById,furnitureImage,furniturePixelWidth} from '../furniture-catalog';
import {READING_SHELF_ID,SHELF_PAGE_COUNT,normalizeShelfPage,shelfBooks,type RamBookId} from '../reading-books';
import {ReadingShelfArt,ReadingShelfSpines} from './ReadingShelf';
import RoomSettings from './RoomSettings';
import {furnitureArt,furnitureHit} from '../furniture-art';
import {roomFurnitureAction,type RoomFurniturePlayback} from '../room-furniture-actions';
import FrameClipPlayer from './FrameClipPlayer';
import './RoomFurnishings.css';

type Place=(id:string,x:number,y:number,instanceId?:string,scale?:number,order?:number)=>void;
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
interface PieceDrag{kind:'move'|'resize';pointer:number;piece:Placement;latest:Placement;start:{x:number;y:number};rect:DOMRect;root:DOMRect;corner?:string}
const FurnitureImage=memo(function FurnitureImage({id,shelfPage=0,interactiveShelf=false}:{id:string;shelfPage?:number;interactiveShelf?:boolean}){
 if(id===READING_SHELF_ID)return <ReadingShelfArt page={shelfPage} showBooks={!interactiveShelf}/>;
 const a=furnitureArt(id);
 return <span className="furniture-art-crop"><img src={furnitureImage(id)} alt="" draggable={false} style={{position:'absolute',left:`${-a.left/a.width*100}%`,top:`${-a.top/a.height*100}%`,width:`${a.imageWidth/a.width*100}%`,height:`${a.imageHeight/a.height*100}%`}}/>{id.startsWith('certificate-')&&<span>{furnitureById(id)!.name.replace('结业证书','')}</span>}</span>;
});
export function RoomFurnishingLayer({pet,edit=false,bookShelfAvailable=true,onPlace,onDuplicate,onRemove,onActivate,onReadBook,onShelfPage,playback,onMotionReady,onMotionEnd}:{
 pet:GameState;edit?:boolean;hasWall?:boolean;bookShelfAvailable?:boolean;onPlace?:Place;onRemove?:(key:string)=>void;
 onDuplicate?:(key:string)=>string|undefined;
 onActivate?:(piece:Placement)=>void;onReadBook?:(id:RamBookId)=>void;onShelfPage?:(key:string,page:number)=>void;
 playback?:RoomFurniturePlayback|null;onMotionReady?:(serial:number)=>void;onMotionEnd?:(serial:number,success?:boolean)=>void;
}){
 const root=useRef<HTMLDivElement>(null),drag=useRef<PieceDrag|null>(null),[moving,setMoving]=useState<Placement|null>(null),[selected,setSelected]=useState<string|null>(null),[roomSize,setRoomSize]=useState({width:760,height:480,scale:1,header:0});
 const focusCopy=useRef<string|undefined>(undefined);
 const pieces=(pet.room?.placed??[]).filter(p=>canOwn(pet,p.id)),chosen=pieces.find(p=>placementKey(p)===selected);
 useEffect(()=>{if(!edit){setSelected(null);setMoving(null);drag.current=null}else if(selected&&!chosen)setSelected(null)},[edit,selected,chosen]);
 useLayoutEffect(()=>{
  const layer=root.current;if(!layer)return;
  const header=edit?layer.parentElement?.querySelector('.cottage-top'):null;
  const update=()=>{
   const r=layer.getBoundingClientRect();
   setRoomSize({width:r.width,height:r.height,scale:Math.min(1,Math.max(.75,r.width/760)),
    header:header?header.getBoundingClientRect().bottom-r.top:0});
  };
  update();const observer=new ResizeObserver(update);observer.observe(layer);if(header)observer.observe(header);
  return()=>observer.disconnect();
 },[edit]);
 useLayoutEffect(()=>{
  if(!selected||focusCopy.current!==selected)return;
  focusCopy.current=undefined;
  root.current?.querySelector<HTMLButtonElement>(`.room-placed-item[data-instance="${CSS.escape(selected)}"]`)?.focus({preventScroll:true});
 },[selected]);
 const commit=(p:Placement)=>onPlace?.(p.id,p.x,p.y,placementKey(p),p.scale,p.order);
 function start(e:PointerEvent<HTMLElement>,piece:Placement,rect:DOMRect,kind:PieceDrag['kind'],corner?:string){
  const area=root.current?.getBoundingClientRect();if(!area||e.button!==0||!e.isPrimary||drag.current)return;
  e.preventDefault();setSelected(placementKey(piece));root.current!.setPointerCapture(e.pointerId);drag.current={kind,pointer:e.pointerId,piece,latest:piece,start:{x:e.clientX,y:e.clientY},rect,root:area,corner};setMoving(piece);
 }
 function down(e:PointerEvent<HTMLDivElement>){
  if(!edit||e.button!==0||!e.isPrimary||(e.target as Element).closest('.furniture-quick-actions,.furniture-handle'))return;
  // A transparent hit must not let the browser focus the top rectangular
  // button afterward and undo the alpha-based selection below.
  e.preventDefault();
  // Pick by original alpha, from front to back, including overlapped copies.
  const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>('.room-placed-item')].reverse().sort((a,b)=>Number(b.parentElement!.style.zIndex)-Number(a.parentElement!.style.zIndex));
  const placements=new Map(pieces.map(piece=>[placementKey(piece),piece]));
  for(const button of buttons){const rect=button.getBoundingClientRect(),piece=placements.get(button.dataset.instance??'');if(piece&&furnitureHit(piece.id,(e.clientX-rect.x)/rect.width,(e.clientY-rect.y)/rect.height)){start(e,piece,rect,'move');return}}
  // A finger can land just beside an open or narrow part of the sprite.
  // Prefer the actual artwork first, then use the touched item's hit box.
  if(e.pointerType==='touch'){
   const hit=(e.target as Element).closest<HTMLButtonElement>('.room-placed-item');
   const piece=hit&&placements.get(hit.dataset.instance??'');
   if(piece&&hit){start(e,piece,hit.getBoundingClientRect(),'move');return;}
  }
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
  if(e.type==='lostpointercapture'&&e.target!==e.currentTarget)return;
  const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;
  if(e.type==='pointerup')commit(d.latest);setMoving(null);
  if(root.current?.hasPointerCapture(e.pointerId))root.current.releasePointerCapture(e.pointerId);
 }
 function drop(e:React.DragEvent<HTMLDivElement>){
  if(!edit)return;e.preventDefault();const id=e.dataTransfer.getData('text/furniture'),r=root.current?.getBoundingClientRect();if(!r||!furnitureById(id)||!canOwn(pet,id))return;
  onPlace?.(id,clamp((e.clientX-r.x)/r.width*100),clamp((e.clientY-r.y)/r.height*100));
 }
 function key(e:React.KeyboardEvent<HTMLButtonElement>,p:Placement){
  if(!edit)return;const step=e.shiftKey?3:.6;
  const delta:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  if(e.altKey&&e.key==='ArrowUp'){e.preventDefault();commit({...p,order:frontFurnitureOrder(pieces)});}
  else if(e.key==='+'||e.key==='='||e.key==='-'||e.key==='0'){
   e.preventDefault();
   const change=e.key==='-'?-.05:.05;
   const scale=e.key==='0'?1:clamp(Math.round((furnitureScale(p)+change)*100)/100,.25,3);
   commit({...p,scale});
  }
  else if(delta[e.key]){e.preventDefault();commit({...p,x:clamp(p.x+delta[e.key][0]),y:clamp(p.y+delta[e.key][1])})}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();onRemove?.(placementKey(p))}
 }
 const labelled=new Set<string>();
 return <div ref={root} className={`room-furnishing-layer ${edit?'is-editing':''}`} aria-label={edit?'拖动或缩放家具，可在小屋任意位置摆放':'小屋摆设'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onDragOver={e=>{if(edit)e.preventDefault()}} onDrop={drop}>
  {pieces.map((saved,index)=>{
   const p=moving&&placementKey(moving)===placementKey(saved)?moving:saved,f=furnitureById(p.id)!,a=furnitureArt(p.id),width=Math.min(furniturePixelWidth(p.id)*roomSize.scale*furnitureScale(p),roomSize.width-8,(roomSize.height-8)*a.width/a.height),height=width*a.height/a.width,selectedPiece=edit&&selected===placementKey(p),shelfPage=normalizeShelfPage(p.shelfPage);
   const books=p.id===READING_SHELF_ID?shelfBooks(shelfPage):null;
   const interactiveShelf=!edit&&books!==null&&Boolean(onReadBook);
   const motion=roomFurnitureAction(p.id);
   const playing=motion&&!edit&&playback?.key===placementKey(p)?playback:undefined;
   const idleArt=<FurnitureImage id={p.id} shelfPage={shelfPage} interactiveShelf={interactiveShelf}/>;
   const label=labelled.has(p.id)?`${f.name} ${index+1}`:f.name;
   labelled.add(p.id);
   const center=clamp(p.x/100*roomSize.width,width/2+4,roomSize.width-width/2-4);
   const bottom=clamp(p.y/100*roomSize.height,height+4,roomSize.height-4),top=bottom-height;
   // Keep the two buttons reachable on small pieces placed against an edge.
   const toolsPosition={right:Math.min(0,center+width/2-90),
    ...(top-roomSize.header<50?{top:Math.max(5,roomSize.header-top+5),bottom:'auto'}:{})};
   return <div className={`room-piece ${selectedPiece?'is-selected':''}`} key={placementKey(p)} style={{left:center,top:bottom,width,height,zIndex:selectedPiece?10200:p.order!==undefined?100+p.order:Math.round(p.y)+2,...(p.id===READING_SHELF_ID?{'--spine-font-size':`${width/36}px`}:{})} as CSSProperties}>
    <button className="room-placed-item" data-furniture={p.id} data-room-interactive={!edit&&isRoomInteractiveFurniture(p.id)?'true':undefined} data-instance={placementKey(p)} data-surface={f.surface}
     data-ram-furniture={motion?'true':undefined} aria-label={label}
     title={!edit&&isRoomInteractiveFurniture(p.id)?motion?(playing?'结束互动':`让拉姆${motion.label}`):f.name:undefined}
     aria-pressed={edit?selectedPiece:motion?Boolean(playing):undefined} tabIndex={edit||isRoomInteractiveFurniture(p.id)?0:-1}
     onFocus={()=>{if(edit)setSelected(placementKey(p))}} onKeyDown={e=>key(e,p)} onClick={()=>{if(!edit){if(books&&onReadBook)onReadBook((books.find(book=>book.id===pet.reading?.lastBook)??books[0]).id);else onActivate?.(p)}}}>
     {motion&&playing?<FrameClipPlayer key={playing.serial} spec={motion} form="middle" color={pet.color} sound={false}
      placement={motion.placement} loop playInReducedMotion fallback={idleArt}
      onFirstPaint={()=>onMotionReady?.(playing.serial)} onEnd={success=>onMotionEnd?.(playing.serial,success)}/>:idleArt}
    </button>
    {interactiveShelf&&books&&<>
     <ReadingShelfSpines books={books} onRead={onReadBook}/>
     {SHELF_PAGE_COUNT>1&&<div className="room-shelf-pages" data-room-interactive="true" aria-label={`书架第 ${shelfPage+1} 页，共 ${SHELF_PAGE_COUNT} 页`}>
      <button type="button" data-room-interactive="true" aria-label="书架上一页" disabled={shelfPage===0} onClick={()=>onShelfPage?.(placementKey(p),shelfPage-1)}>‹</button>
      <select aria-label="跳到书架页" value={shelfPage} onChange={event=>onShelfPage?.(placementKey(p),Number(event.currentTarget.value))}>
       {Array.from({length:SHELF_PAGE_COUNT},(_,index)=><option key={index} value={index}>{index+1}/{SHELF_PAGE_COUNT}</option>)}
      </select>
      <button type="button" data-room-interactive="true" aria-label="书架下一页" disabled={shelfPage===SHELF_PAGE_COUNT-1} onClick={()=>onShelfPage?.(placementKey(p),shelfPage+1)}>›</button>
     </div>}
    </>}
    {selectedPiece&&(['nw','ne','sw','se'] as const).map(corner=><button key={corner} className={`furniture-handle handle-${corner}`} aria-label={`缩放${f.name} ${corner}`} onPointerDown={e=>{e.stopPropagation();const rect=e.currentTarget.parentElement!.querySelector('.room-placed-item')!.getBoundingClientRect();start(e,p,rect,'resize',corner)}}/>)}
    {selectedPiece&&!moving&&<div className="furniture-quick-actions" role="group" aria-label={`${f.name}的摆放操作`} style={toolsPosition}>
     {onDuplicate&&<button type="button" aria-label="复制一件" title="复制一件" disabled={(pet.room?.placed.length??0)>=MAX_PLACED_FURNITURE||p.id===READING_SHELF_ID&&!bookShelfAvailable}
      onClick={event=>{const key=onDuplicate(placementKey(p));if(key){if(event.detail===0)focusCopy.current=key;setSelected(key);}}}><Copy aria-hidden="true"/></button>}
     {onRemove&&<button type="button" aria-label="收回仓库" title="收回仓库" onClick={()=>{setSelected(null);onRemove(placementKey(p));}}><X aria-hidden="true"/></button>}
    </div>}
   </div>;
  })}
 </div>;
}

const decorationTabs = [
  {id: 'all', label: '全部家具', text: '全部'},
  {id: 'owned', label: '已拥有', text: '已拥有'},
  {id: 'floor', label: '地面', text: '地面'},
  {id: 'wall', label: '墙饰', text: '墙饰'},
  {id: 'ram', label: '拉姆互动', text: '互动'},
  {id: 'garden', label: '家园家具', text: '家园'},
  {id: 'scenery', label: '小屋风景', text: '风景'},
] as const;
type DecorationTab = typeof decorationTabs[number]['id'];
const FURNITURE_PAGE_SIZE = 36;

interface WarehouseDrag {
  id: string;
  pointer: number;
  x: number;
  y: number;
  moved: boolean;
}

export function RoomFurnishingEditor({pet, media, onBuy, onPlace, bookShelfAvailable=true, onDownloadBooks}: {
  pet: GameState;
  media: RoomMediaController;
  onBuy: (id: string) => string | undefined;
  onPlace: Place;
  bookShelfAvailable?:boolean;
  onDownloadBooks?:()=>void;
}) {
  const tabId = useId();
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<WarehouseDrag | null>(null);
  const [preview, setPreview] = useState<{id: string; x: number; y: number} | null>(null);
  const [category, setCategory] = useState<DecorationTab>('all');
  const [query, setQuery] = useState('');
  const [cataloguePage, setCataloguePage] = useState(0);
  const [purchaseError, setPurchaseError] = useState<string>();
  const [scroll, setScroll] = useState({previous: false, next: false});

  const placed = pet.room?.placed ?? [];
  const full = placed.length >= MAX_PLACED_FURNITURE;
  const search = query.trim().toLowerCase();
  const room=pet.room,education=pet.education;
  const matches = useMemo(() => {
    if(category==='scenery')return [];
    const ownership={room,education};
    const certificates=COURSES.filter(course=>learned(ownership,course.id)).map(course=>furnitureById(`certificate-${course.id}`)!);
    return [...FURNITURE,...certificates].filter(item=>
      (item.name.toLowerCase().includes(search)||item.sourceId?.includes(search))&&(
        category==='all'||category===item.surface||category==='owned'&&canOwn(ownership,item.id)||
        category==='ram'&&roomFurnitureAction(item.id)||category==='garden'&&item.originalArea==='garden'
      ));
  },[category,search,room,education]);
  const pageCount = Math.max(1, Math.ceil(matches.length / FURNITURE_PAGE_SIZE));
  const activePage = Math.min(cataloguePage, pageCount - 1);
  const items = matches.slice(activePage * FURNITURE_PAGE_SIZE, (activePage + 1) * FURNITURE_PAGE_SIZE);

  function chooseCategory(next: DecorationTab) {
    setCategory(next);
    setCataloguePage(0);
    setPurchaseError(undefined);
  }

  useLayoutEffect(() => {
    const list = rail.current;
    if (!list) return;
    list.scrollLeft = 0;
    const update = () => {
      const previous=list.scrollLeft>1,next=list.scrollLeft+list.clientWidth<list.scrollWidth-1;
      setScroll(current=>current.previous===previous&&current.next===next?current:{previous,next});
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || list.scrollWidth <= list.clientWidth) return;
      event.preventDefault();
      list.scrollLeft += event.deltaY * (event.deltaMode ? 24 : 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    list.addEventListener('scroll', update, {passive: true});
    list.addEventListener('wheel', wheel, {passive: false});
    return () => {
      observer.disconnect();
      list.removeEventListener('scroll', update);
      list.removeEventListener('wheel', wheel);
    };
  }, [activePage, category, items.length, query]);

  function beginDrag(event: PointerEvent<HTMLElement>, id: string) {
    if(id===READING_SHELF_ID&&!bookShelfAvailable)return;
    if (!event.isPrimary || event.button !== 0 || drag.current || full || !canOwn(pet, id) || (event.target as Element).closest('button')) return;
    if (event.pointerType === 'touch' && !(event.target as Element).closest('.furnishing-tile-art,.furnishing-drag-mark')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {id, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false};
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    current.moved ||= Math.hypot(event.clientX - current.x, event.clientY - current.y) > 6;
    if (current.moved) setPreview({id: current.id, x: event.clientX, y: event.clientY});
  }

  function finishDrag(event: PointerEvent<HTMLElement>) {
    if (event.type === 'lostpointercapture' && event.target !== event.currentTarget) return;
    const current = drag.current;
    if (current?.pointer !== event.pointerId) return;
    drag.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current.moved || event.type !== 'pointerup') return;
    const layer = document.elementFromPoint(event.clientX, event.clientY)?.closest('.room-furnishing-layer.is-editing');
    const room = layer?.getBoundingClientRect();
    if (room) {
      onPlace(current.id, clamp((event.clientX - room.x) / room.width * 100), clamp((event.clientY - room.y) / room.height * 100));
    }
  }

  function put(id: string) {
    if (id === MUSIC_BOX_ID && !placed.some(piece => piece.id === id)) {
      onPlace(id, MUSIC_BOX_HOME_POSITION.x, MUSIC_BOX_HOME_POSITION.y);
      return;
    }
    const count = placed.length;
    onPlace(id, 38 + count % 4 * 8, 58 + Math.floor(count / 4) % 3 * 6);
  }

  function scrollItems(direction: -1 | 1) {
    const list = rail.current;
    if (list) list.scrollBy({left: direction * list.clientWidth * .8,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }

  const previewArt = preview && furnitureArt(preview.id);
  return <aside className="room-decoration-dock" aria-label="小屋布置工具">
    <div className="furnishing-content">
      <div className="furnishing-toolbar">
        <div className="furnishing-tabs" role="tablist" aria-label="布置分类" onKeyDown={event => {
          const index = decorationTabs.findIndex(tab => tab.id === category);
          const last = decorationTabs.length - 1;
          const keys: Record<string, number> = {ArrowLeft: index === 0 ? last : index - 1, ArrowRight: index === last ? 0 : index + 1, Home: 0, End: last};
          const next = keys[event.key];
          if (next === undefined) return;
          event.preventDefault();
          chooseCategory(decorationTabs[next].id);
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>
          {decorationTabs.map(tab => <button key={tab.id} type="button" role="tab" id={`${tabId}-${tab.id}`} aria-label={tab.label}
            aria-selected={category === tab.id} aria-controls={`${tabId}-panel`} tabIndex={category === tab.id ? 0 : -1}
            onClick={() => chooseCategory(tab.id)}>{tab.text}</button>)}
        </div>
        {category !== 'scenery' && <>
          <input type="search" aria-label="查找家具" placeholder="查找家具"
            value={query} onChange={event => { setQuery(event.target.value); setCataloguePage(0); setPurchaseError(undefined); }}/>
          {pageCount > 1 && <select className="furnishing-page" aria-label="跳到家具页" value={activePage}
            onChange={event => { setCataloguePage(Number(event.target.value)); setPurchaseError(undefined); }}>
            {Array.from({length: pageCount}, (_, index) => <option key={index} value={index}>{index + 1}/{pageCount}</option>)}
          </select>}
        </>}
      </div>
      <div id={`${tabId}-panel`} role="tabpanel" aria-labelledby={`${tabId}-${category}`}>
        {category === 'scenery' ? <RoomSettings media={media}/> : <>
          {items.length > 0 ? <div className="furnishing-browse">
            <button type="button" className="furnishing-scroll" aria-label="向左浏览家具" disabled={!scroll.previous}
              onClick={() => scrollItems(-1)}>‹</button>
            <div ref={rail} className="furnishing-catalogue" aria-label="家具仓库">
              {items.map(item => {
                const owned = canOwn(pet, item.id);
                const locked=item.id===READING_SHELF_ID&&!bookShelfAvailable;
                const draggable = !locked&&owned&&!full;
                return <article key={item.id} className={item.dragOnly ? 'warehouse-drag-card' : undefined}
                  data-furniture-item={item.id} data-can-drag={draggable}
                  onPointerDown={event => beginDrag(event, item.id)} onPointerMove={moveDrag}
                  onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
                  <div className="furnishing-tile-art">
                    {item.id === READING_SHELF_ID ? <div className="warehouse-reading-art"><ReadingShelfArt/></div>
                      : <img alt="" draggable={false} loading="lazy" decoding="async" src={furnitureImage(item.id)}/>}
                  </div>
                  <strong title={item.name}>{item.name}</strong>
                  {locked ? <button className="furnishing-item-action" type="button" onClick={onDownloadBooks}>下载图书素材</button>
                  : item.dragOnly ? <span className="furnishing-drag-mark" role="img" aria-label="拖入小屋" title="拖入小屋"><Move aria-hidden="true"/></span> : <button
                    className="furnishing-item-action" type="button" aria-label={owned ? '放进小屋' : '购买'}
                    title={owned ? '放进小屋' : pet.coins < item.price ? '摩尔豆不足' : `购买 · ${item.price} 摩尔豆`}
                    disabled={owned ? full : pet.coins < item.price}
                    onClick={() => owned ? put(item.id) : setPurchaseError(onBuy(item.id))}>
                    {owned ? '放置' : <><img src="./assets/original/room-icons/mole-bean.png" alt="" draggable={false}/>{item.price.toLocaleString()}</>}
                  </button>}
                </article>;
              })}
            </div>
            <button type="button" className="furnishing-scroll" aria-label="向右浏览家具" disabled={!scroll.next}
              onClick={() => scrollItems(1)}>›</button>
          </div> : <p className="furnishing-empty">{search ? '没有找到符合的家具。' : '这里还没有家具。'}</p>}
          {full && <p className="furnishing-feedback" role="status">小屋已放满，收回一件后可继续摆放。</p>}
          {purchaseError && <p className="furnishing-feedback" role="alert">{purchaseError}</p>}
        </>}
      </div>
    </div>
    {preview && previewArt && createPortal(<div className="warehouse-drag-preview"
      style={{left: preview.x, top: preview.y, aspectRatio: previewArt.width / previewArt.height, width: Math.min(110, furniturePixelWidth(preview.id))}}>
      <FurnitureImage id={preview.id}/>
    </div>, document.body)}
  </aside>;
}

import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import art from '../restaurant-classic-art.json';
import {RECIPES,recipeById,dishStars,restaurantLevel,type RestaurantState,type Stove} from '../restaurant';
import type {RestaurantCommand} from '../restaurant';
import './RestaurantClassic.css';
const ROOT='./assets/original/restaurant/classic/';
type Rect={x:number;y:number;w:number;h:number};
type Spec=Rect&{frames:number;sprite:number;sheet?:boolean};
type Placement={x:number;y:number;sx:number;sy:number;rect:Rect;sprite:number;text?:Rect&{font:number}};
const specs=art.specs as Record<string,Spec>;
export const nativeLayout=(id:number)=>(art.layouts as unknown as Record<string,Record<string,Placement>>)[id];
export const nativeRectStyle=({x,y,w,h}:Rect):CSSProperties=>({left:`${x/9.6}%`,top:`${y/5.6}%`,width:`${w/9.6}%`,height:`${h/5.6}%`});
export function NativeSprite({asset,frame=0,x=0,y=0,className=''}:{asset:string;frame?:number;x?:number;y?:number;className?:string}){
 const s=specs[asset];if(!s)return null;
 if(s.sheet)return <span aria-hidden="true" className={`native-art ${className}`} style={{...nativeRectStyle({...s,x:x+s.x,y:y+s.y}),backgroundImage:`url(${ROOT}${asset}/sheet.webp)`,backgroundSize:`${s.frames*100}% 100%`,backgroundPosition:`${s.frames>1?Math.max(0,Math.min(s.frames-1,frame))/(s.frames-1)*100:0}% 0`}}/>;
 return <img className={`native-art ${className}`} alt="" draggable={false} style={nativeRectStyle({...s,x:x+s.x,y:y+s.y})} src={`${ROOT}${asset}/${Math.max(0,Math.min(s.frames-1,frame))}.webp`}/>;
}
const minutes=(ms:number)=>{const n=Math.ceil(ms/60000);return n<60?`${n}分钟`:`${Math.floor(n/60)}小时${n%60?`${n%60}分钟`:''}`};
export const stoveLabel=(i:number,s:Stove|null|undefined)=>`灶台 ${i+1}${s?' '+recipeById(s.dish)!.name+' '+({pot:'放入食材',ingredients:'开始制作',cooking:'烹饪中',ready:'已做好',burnt:'已烧糊'}[s.state]):' 空闲'}`;
export function NativeStove({index,stove,room,onSelect,onCommand}:{index:number;stove?:Stove|null;room:number;onSelect:()=>void;onCommand:(c:RestaurantCommand)=>void}){
 const layout=nativeLayout(room),hit=layout[`zaoBtn${index+1}`],anchor=layout[`foodTable${index+1}`],pointer=layout[`shuo${index+1}`];
 const preparing=Boolean(stove?.prep),[frame,setFrame]=useState(2),[hover,setHover]=useState(false),prepClock=useRef({left:stove?.prep??0,at:performance.now()});if(prepClock.current.left!==(stove?.prep??0))prepClock.current={left:stove?.prep??0,at:performance.now()};
 useEffect(()=>{
  if(!preparing)return;let id=0;
  const animate=()=>{const elapsed=Math.max(0,2000-prepClock.current.left+Math.min(250,performance.now()-prepClock.current.at));setFrame(Math.min(49,2+Math.floor(elapsed/1000*24)));id=requestAnimationFrame(animate)};
  id=requestAnimationFrame(animate);return()=>cancelAnimationFrame(id);
 },[preparing]);
 const rect={x:hit.x+hit.rect.x*hit.sx,y:hit.y+hit.rect.y*hit.sy,w:hit.rect.w*Math.abs(hit.sx),h:hit.rect.h*Math.abs(hit.sy)};
 const stateFrame=stove?({pot:0,ingredients:1,cooking:2,ready:3,burnt:4}[stove.state]):0;
 function click(){if(preparing)return;if(!stove)onSelect();else if(stove.state==='pot'||stove.state==='ingredients')onCommand({kind:'prepare',stove:index});else if(stove.state==='ready')onCommand({kind:'collect',stove:index});else onCommand({kind:'discard',stove:index});}
 const foodX=anchor.x-anchor.rect.w,foodY=anchor.y-anchor.rect.h;
 const recipe=stove&&recipeById(stove.dish)!;
 return <>
  {!stove&&pointer&&<NativeSprite asset="pointer" x={pointer.x} y={pointer.y}/>}
  {stove&&<NativeSprite asset={`states/${stove.dish}`} frame={stateFrame} x={foodX} y={foodY}/>}
  {stove&&!preparing&&stove.state==='cooking'&&<NativeSprite asset="clock-steps" frame={Math.floor((1-stove.remaining/recipe!.cookMs)*36)} x={hit.x-41} y={hit.y-42}/>}
  {stove&&!preparing&&stove.state==='ready'&&<NativeSprite asset="clock" frame={1} x={hit.x} y={hit.y}/>}
  {stove&&!preparing&&['pot','ingredients'].includes(stove.state)&&!hover&&<><NativeSprite asset="thought" x={hit.x} y={hit.y}/><img className="native-thought-dish" alt="" src={`./assets/original/restaurant/icons/${stove.dish}.webp`} style={nativeRectStyle({x:hit.x-25,y:hit.y-53,w:34,h:28})}/></>}
  {preparing&&<NativeSprite asset="prepare" frame={frame} x={hit.x-41} y={hit.y-14.7}/>}
  <button className="native-hit native-stove-hit" style={nativeRectStyle(rect)} aria-label={stoveLabel(index,stove)} disabled={preparing} onClick={click} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocus={()=>setHover(true)} onBlur={()=>setHover(false)}/>
  {hover&&!preparing&&<div className="native-stove-tip" role="tooltip" style={{left:`${(hit.x+30)/9.6}%`,top:`${(hit.y-8)/5.6}%`}}><b>{!stove?'点击灶台':stove.state==='pot'||stove.state==='ingredients'?'点击灶台':recipe!.name}</b><span>{!stove?'选择菜谱':stove.state==='pot'?'放入食材':stove.state==='ingredients'?'开始制作':stove.state==='cooking'?`${minutes(stove.remaining)}后做好`:stove.state==='ready'?`${minutes(stove.fresh)}后变坏 · 点击端菜`:'食物已经做坏了'}</span></div>}
 </>;
}
export function NativeCounter({dish,room,index,onClick}:{dish:number;room:number;index:number;onClick:()=>void}){
 const p=nativeLayout(room)[`foodTable${51+index}`],hit=nativeLayout(room)[`taiBtn${51+index}`];if(!p||!hit)return null;
 return <><NativeSprite asset={`states/${dish}`} frame={5} x={p.x-p.rect.w} y={p.y-p.rect.h}/><button className="native-hit" aria-label={`餐台 ${index+1} ${recipeById(dish)!.name}`} style={nativeRectStyle({x:hit.x+hit.rect.x*hit.sx,y:hit.y+hit.rect.y*hit.sy,w:hit.rect.w*Math.abs(hit.sx),h:hit.rect.h*Math.abs(hit.sy)})} onClick={onClick}/></>;
}
export function NativeMenu({restaurant,coins,stove,onChoose,onClose}:{restaurant:RestaurantState;coins:number;stove:number;onChoose:(id:number)=>void;onClose:()=>void}){
 const [page,setPage]=useState(0),[hover,setHover]=useState<number|null>(null);const total=Math.ceil(RECIPES.length/6),book=specs['menu-clean-frame'],level=restaurantLevel(restaurant.xp);
 const recipe=hover===null?null:recipeById(hover);const pages=Array.from({length:Math.min(5,total-Math.floor(page/5)*5)},(_,i)=>Math.floor(page/5)*5+i);
 const relative=(r:Rect):CSSProperties=>({left:`${r.x/book.w*100}%`,top:`${r.y/book.h*100}%`,width:`${r.w/book.w*100}%`,height:`${r.h/book.h*100}%`});
 return <div className="native-modal-shade"><section className="native-menu" role="dialog" aria-modal="true" aria-label={`原版菜谱 · 灶台 ${stove+1}`} style={nativeRectStyle({x:231+book.x,y:85+book.y,w:book.w,h:book.h})}>
  <img className="native-menu-background" src={ROOT+'menu-clean-frame/0.webp'} alt=""/>
  <button autoFocus className="native-hit" style={relative({x:762,y:44,w:36,h:38})} aria-label="关闭菜谱" onClick={onClose}/>
  {RECIPES.slice(page*6,page*6+6).map((r,i)=>{const locked=r.level>level;return <button key={r.id} className={`native-menu-card ${locked?'is-locked':''}`} aria-label={`备菜 ${r.name} ${r.cost} 摩尔豆`} title={locked?`餐厅 ${r.level} 级解锁`:coins<r.cost?'摩尔豆不足':r.name} aria-disabled={locked||coins<r.cost} style={relative({x:208.3+(i%3)*191,y:85.05+Math.floor(i/3)*142,w:187.8,h:173.15})} onMouseEnter={()=>setHover(r.id)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(r.id)} onBlur={()=>setHover(null)} onClick={()=>{if(!locked&&coins>=r.cost)onChoose(r.id)}}>
   <img src={`${ROOT}menu-icons/${r.id}.webp`} alt=""/><b>{r.name}</b><span>{locked?`${r.level}级解锁`:`花费${r.cost}摩尔豆`}</span>{dishStars(restaurant,r.id)>0&&<small>{'★'.repeat(dishStars(restaurant,r.id))}</small>}
  </button>})}
  <button className="native-hit" style={relative({x:18,y:425,w:58,h:48})} aria-label="菜谱上一页" disabled={page===0} onClick={()=>setPage(p=>p-1)}/>
  <button className="native-hit" style={relative({x:741,y:425,w:63,h:48})} aria-label="菜谱下一页" disabled={page===total-1} onClick={()=>setPage(p=>p+1)}/>
  {pages.map((p,i)=><button className="native-page-number" aria-label={`菜谱第 ${p+1} 页`} aria-current={page===p?'page':undefined} key={p} style={relative({x:267+i*61,y:427,w:50,h:37})} onClick={()=>setPage(p)}>{p+1}</button>)}
  <span className="native-menu-wallet" style={relative({x:73,y:368,w:110,h:27})}>{coins}</span>
  {recipe&&<div className="native-menu-info" style={{...relative({x:35.05+specs['menu-tooltip'].x,y:120.7+specs['menu-tooltip'].y,w:specs['menu-tooltip'].w,h:specs['menu-tooltip'].h}),backgroundImage:`url(${ROOT}menu-tooltip/1.webp)`}}><b>{recipe.name}</b><p>完成时间：{minutes(recipe.cookMs)}</p><p>烧糊时间：{minutes(recipe.freshMs)}</p><p>单次烹饪：{recipe.servings}份</p><p>每份售价：{recipe.sell}摩尔豆</p><p>备菜花费：{recipe.cost}摩尔豆</p><span>{level<recipe.level?`餐厅${recipe.level}级解锁`:'点击右侧菜品开始制作'}</span></div>}
 </section></div>;
}
const hudPoints:Record<string,{x:number;y:number}>={cmdBtn:{x:897+46.2,y:198.6+70.05},menuBtn:{x:897-25.95,y:198.6+110.7},goBtn:{x:897-.35,y:198.6+193.7},bookBtn:{x:897-10.25,y:198.6-3.85},activeBtn:{x:897-21.25,y:198.6-69.6}};
export function NativeHud({coins,level,favor,onMenu,onStaff,onHelp,onLedger,onClose}:{coins:number;level:number;favor:number;onMenu:()=>void;onStaff:()=>void;onHelp:()=>void;onLedger:()=>void;onClose:()=>void}){
 const actions:Record<string,{name:string;run:()=>void}>={cmdBtn:{name:'管理员工与装修',run:onStaff},menuBtn:{name:'查看餐厅菜谱',run:onMenu},goBtn:{name:'离开餐厅',run:onClose},bookBtn:{name:'餐厅玩法',run:onHelp},activeBtn:{name:'经营账本与荣誉',run:onLedger}};
 return <><NativeSprite asset="hud"/>{Object.entries(actions).map(([id,{name,run}])=>{const spec=specs['hud-hit/'+id],p=hudPoints[id];return <button key={id} className="native-hit native-hud-hit" title={name} aria-label={name} style={nativeRectStyle({...spec,x:p.x+spec.x,y:p.y+spec.y})} onClick={run}/>})}<span className="native-wallet-number" aria-label={`钱包 ${coins} 摩尔豆`}>{coins}</span><span className="native-favor-number">{favor}</span><NativeSprite asset="level-numbers" frame={level-1} x={43.1} y={105.05}/></>;
}

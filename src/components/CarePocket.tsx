import {useEffect,useId,useMemo,useState} from 'react';
import {getStage,getItem} from '../game';
import type {Action,GameState,ItemCategory,PetItem} from '../game';
import './CarePocket.css';
import {inventoryItems} from '../catalog';
import {petColorName} from '../pet-color';
export type PocketCategory=ItemCategory;
export function itemEffectLine(item:PetItem){if(item.changesColor)return `变为${petColorName(item.changesColor)}`;return ([['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],['happiness','心情'],['health','健康']] as const).filter(([key])=>item[key]>0).map(([key,label])=>`${label} +${item[key]}`).join(' · ')}
export interface CarePocketProps{pet:GameState;initialCategory?:PocketCategory;visit?:number;onCare:(action:Action,id?:string)=>void;onVisitShop?:()=>void;busy?:boolean;busyItemId?:string;compact?:boolean;onClose?:()=>void}
const categories=[['food','食物'],['drink','饮品'],['clean','清洁'],['medicine','药水']] as const;
export default function CarePocket({pet,initialCategory='food',visit,onCare,onVisitShop,busy: _busy=false,busyItemId,compact=false,onClose}:CarePocketProps){
 const[category,setCategory]=useState(initialCategory),[page,setPage]=useState(0);
 const hintId=useId(),[hovered,setHovered]=useState<string|null>(null),[focused,setFocused]=useState<string|null>(null);
 const clearHint=()=>{setHovered(null);setFocused(null)};
 // Keep consumed slots in place during this visit, but change the category and
 // its contents together. A passive-effect refresh briefly showed an empty tab.
 const slots=useMemo(()=>inventoryItems(pet.inventory).filter(item=>item.category===category&&(pet.inventory[item.id]??0)>0).map(item=>item.id),[category,visit,pet.createdAt]);
 useEffect(()=>{setCategory(initialCategory);setPage(0)},[initialCategory,visit]);
 const owned=slots.map(id=>getItem(id)!).filter(item=>item&&item.category===category),pages=Math.max(1,Math.ceil(owned.length/16)),currentPage=Math.min(page,pages-1),visible=owned.slice(currentPage*16,currentPage*16+16),stage=getStage(pet.growth,pet.evolution);
 const reasonFor=(item:PetItem)=>!(pet.inventory[item.id]??0)?'已经用完':pet.sleeping?'先叫醒拉姆':stage<item.minStage?'长大一点再用':item.changesColor===pet.color?'已经是这个颜色':undefined;
 const describe=(item:PetItem)=>`${item.name} ×${pet.inventory[item.id]??0} · ${reasonFor(item)??itemEffectLine(item)}`;
 const hintItem=visible.find(item=>item.id===(hovered??focused));
 useEffect(clearHint,[category,currentPage,visit,pet.createdAt,compact,pet.inventory]);
 return <section className={`care-pocket ${compact?'pocket-compact':''}`} aria-label="拉姆用品背包" aria-busy={Boolean(busyItemId)}>
  <header className="pocket-heading"><b>背包</b><span className="pocket-heading-actions">{onClose?<button className="pocket-close" aria-label="关闭小窗" onClick={onClose}>×</button>:<span>{pet.coins} 豆</span>}</span></header>
  <div className="pocket-categories" role="tablist" aria-label="物品分类">{categories.map(([id,label],index)=><button type="button" key={id} role="tab" id={`${hintId}-${id}`} data-category={id} aria-controls={`${hintId}-items`} aria-selected={category===id} tabIndex={category===id?0:-1} onClick={()=>{setCategory(id);setPage(0)}} onKeyDown={e=>{const next=e.key==='ArrowRight'?(index+1)%categories.length:e.key==='ArrowLeft'?(index+categories.length-1)%categories.length:e.key==='Home'?0:e.key==='End'?categories.length-1:null;if(next===null)return;e.preventDefault();setCategory(categories[next][0]);setPage(0);e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-category="${categories[next][0]}"]`)?.focus()}}>{label}</button>)}</div>
  <div className="pocket-items" id={`${hintId}-items`} role="tabpanel" aria-labelledby={`${hintId}-${category}`} aria-label="用品十六格">{Array.from({length:16},(_,index)=>{const item=visible[index];if(!item)return <div key={`empty-${index}`} className="pocket-slot pocket-slot-blank" aria-hidden="true"/>;
   const count=pet.inventory[item.id]??0,reason=reasonFor(item);
   return <button className="pocket-slot" key={item.id} data-item-id={item.id} data-count={count} disabled={Boolean(reason)} aria-label={`使用${item.name}，剩余${count}份`} aria-description={describe(item)} aria-describedby={hintItem?.id===item.id?hintId:undefined} onPointerEnter={()=>setHovered(item.id)} onPointerLeave={()=>setHovered(id=>id===item.id?null:id)} onFocus={()=>setFocused(item.id)} onBlur={()=>setFocused(id=>id===item.id?null:id)} onClick={()=>{clearHint();onCare(item.category==='food'?'feed':item.category==='drink'?'drink':item.category==='clean'?'wash':'use',item.id)}}><img src={item.image} alt="" draggable={false}/>{item.changesColor&&<i className="potion-colour-dot" style={{background:item.changesColor.startsWith('#')?item.changesColor:undefined}} aria-hidden="true"/>}<span className="pocket-slot-count">{count}</span>{item.id===busyItemId&&<i className="pocket-using" aria-label="正在使用"/>}</button>})}</div>
  {hintItem&&<div id={hintId} className="pocket-item-hint" role="tooltip">{describe(hintItem)}</div>}
  <footer className="pocket-pages"><button aria-label="背包上一页" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>‹</button><span>{currentPage+1}/{pages}</span><button aria-label="背包下一页" disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>›</button>{pet.sleeping?<button className="pocket-link" onClick={()=>onCare('sleep')}>叫醒</button>:onVisitShop&&<button className="pocket-link" onClick={onVisitShop}>{owned.length?'去补充':'小屋买用品'}</button>}</footer>
 </section>
}

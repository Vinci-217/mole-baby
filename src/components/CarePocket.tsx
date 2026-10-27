import {useEffect,useId,useState} from 'react';
import {ITEMS,getStage,getItem,COLORS} from '../game';
import type {Action,GameState,ItemCategory,PetItem} from '../game';
import './CarePocket.css';
export function itemEffectLine(item:PetItem){if(item.changesColor)return `变为${COLORS.find(c=>c.id===item.changesColor)!.name}`;return ([['hunger','饱食'],['thirst','水分'],['cleanliness','清洁'],['happiness','心情'],['health','健康']] as const).filter(([key])=>item[key]>0).map(([key,label])=>`${label} +${item[key]}`).join(' · ')}
export interface CarePocketProps{pet:GameState;initialCategory?:ItemCategory;visit?:number;onCare:(action:Action,id?:string)=>void;onVisitShop?:()=>void;busy?:boolean;busyItemId?:string;compact?:boolean;onClose?:()=>void}
const categories=[['food','食物'],['drink','饮品'],['clean','清洁'],['medicine','药水']] as const;
export default function CarePocket({pet,initialCategory='food',visit,onCare,onVisitShop,busy: _busy=false,busyItemId,compact=false,onClose}:CarePocketProps){
 const[category,setCategory]=useState(initialCategory),[page,setPage]=useState(0);
 const hintId=useId(),[hovered,setHovered]=useState<string|null>(null),[focused,setFocused]=useState<string|null>(null);
 const clearHint=()=>{setHovered(null);setFocused(null)};
 const[slots,setSlots]=useState(()=>ITEMS.filter(item=>item.category===initialCategory&&(pet.inventory[item.id]??0)>0).map(item=>item.id));
 useEffect(()=>{setSlots(ITEMS.filter(item=>item.category===category&&(pet.inventory[item.id]??0)>0).map(item=>item.id));setPage(0)},[category,visit,pet.createdAt]);
 useEffect(()=>{setCategory(initialCategory);setPage(0)},[initialCategory,visit]);
 const owned=slots.map(id=>getItem(id)!).filter(item=>item&&item.category===category),pages=Math.max(1,Math.ceil(owned.length/16)),currentPage=Math.min(page,pages-1),visible=owned.slice(currentPage*16,currentPage*16+16),stage=getStage(pet.growth,pet.evolution);
 const reasonFor=(item:PetItem)=>!(pet.inventory[item.id]??0)?'已经用完':pet.sleeping?'先叫醒拉姆':stage<item.minStage?'长大一点再用':item.changesColor===pet.color?'已经是这个颜色':undefined;
 const describe=(item:PetItem)=>`${item.name} ×${pet.inventory[item.id]??0} · ${reasonFor(item)??itemEffectLine(item)}`;
 const hintItem=compact?visible.find(item=>item.id===(hovered??focused)):undefined;
 useEffect(clearHint,[category,currentPage,visit,pet.createdAt,compact,pet.inventory]);
 return <section className={`care-pocket ${compact?'pocket-compact':''}`} aria-label="拉姆用品背包" aria-busy={Boolean(busyItemId)}>
  <header className="pocket-heading"><b>背包</b><select aria-label="物品分类" value={category} onChange={e=>{setCategory(e.target.value as ItemCategory);setPage(0)}}>{categories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>{onClose?<button className="pocket-close" aria-label="关闭小窗" onClick={onClose}>×</button>:<span>{pet.coins} 豆</span>}</header>
  <div className="pocket-items" aria-label="用品十六格">{Array.from({length:16},(_,index)=>{const item=visible[index];if(!item)return <div key={`empty-${index}`} className="pocket-slot pocket-slot-blank" aria-hidden="true"/>;
   const count=pet.inventory[item.id]??0,reason=reasonFor(item);
   return <button className="pocket-slot" key={item.id} data-item-id={item.id} data-count={count} disabled={Boolean(reason)} aria-label={`使用${item.name}，剩余${count}份`} title={compact?undefined:`${item.name} ×${count}\n${reason??itemEffectLine(item)}`} aria-description={compact?describe(item):undefined} aria-describedby={compact&&hintItem?.id===item.id?hintId:undefined} onPointerEnter={()=>setHovered(item.id)} onPointerLeave={()=>setHovered(id=>id===item.id?null:id)} onFocus={()=>setFocused(item.id)} onBlur={()=>setFocused(id=>id===item.id?null:id)} onClick={()=>{clearHint();onCare(item.category==='food'?'feed':item.category==='drink'?'drink':item.category==='clean'?'wash':'use',item.id)}}><img src={item.image} alt="" draggable={false}/><span className="pocket-slot-count">{count}</span>{item.id===busyItemId&&<i className="pocket-using" aria-label="正在使用"/>}</button>})}</div>
  {hintItem&&<div id={hintId} className="pocket-item-hint" role="tooltip">{describe(hintItem)}</div>}
  <footer className="pocket-pages"><button aria-label="背包上一页" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>‹</button><span>{currentPage+1}/{pages}</span><button aria-label="背包下一页" disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>›</button>{pet.sleeping?<button className="pocket-link" onClick={()=>onCare('sleep')}>叫醒</button>:onVisitShop&&<button className="pocket-link" onClick={onVisitShop}>{owned.length?'去补充':'小屋买用品'}</button>}</footer>
 </section>
}

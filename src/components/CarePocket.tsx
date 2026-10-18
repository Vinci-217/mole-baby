import { useState } from 'react';
import { ITEMS, getStage } from '../game';
import type { Action, GameState, ItemCategory } from '../game';
import './CarePocket.css';

const categories: { id: ItemCategory; name: string; icon: string }[] = [
  { id: 'food', name: '食物', icon: '180001' }, { id: 'drink', name: '饮品', icon: '180002' },
  { id: 'clean', name: '清洁', icon: '180003' }, { id: 'medicine', name: '药水', icon: '180005' },
];
export default function CarePocket({ pet, initialCategory = 'food', onCare, onBuy }: {
  pet: GameState; initialCategory?: ItemCategory;
  onCare: (action: Action, id?: string) => void; onBuy: (id: string) => void;
}) {
  const [mode, setMode] = useState<'bag' | 'shop'>('bag');
  const [category, setCategory] = useState<ItemCategory>(initialCategory);
  const stage = getStage(pet.growth);
  const items = ITEMS.filter(item => item.category === category);
  return <div className="care-pocket">
    <div className="pocket-mode" aria-label="物品位置"><button aria-pressed={mode === 'bag'} onClick={() => setMode('bag')}>我的背包</button><button aria-pressed={mode === 'shop'} onClick={() => setMode('shop')}>拉姆商店</button><span>{pet.coins} 摩尔豆</span></div>
    <nav className="pocket-categories" aria-label="物品分类">{categories.map(c => <button key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}><img alt="" src={`./assets/original/items/${c.icon}.png`}/>{c.name}</button>)}</nav>
    <p className="pocket-hint">{mode === 'shop' ? '用摩尔豆买下后，物品会放进背包。' : pet.sleeping ? '它正闭着眼睛睡觉，叫醒后再照料吧。' : '选择背包里的用品照料拉姆；没有了就去商店补充。'}</p>
    <div className="pocket-items">{items.map(item => {
      const count = pet.inventory[item.id] ?? 0;
      const locked = stage < item.minStage;
      const effect = [['饱食', item.hunger], ['水分', item.thirst], ['清洁', item.cleanliness], ['心情', item.happiness], ['健康', item.health]].filter(([, value]) => Number(value) > 0).map(([name, value]) => `${name} +${value}`).join(' · ');
      return <article className="pocket-item" key={item.id} data-item-id={item.id}>
        <img src={item.image} alt="" draggable={false}/><div><b>{item.name}</b><small>{effect}</small><span>背包 × {count}{locked ? ` · ${['种子期', '初级', '中级', '高级'][item.minStage]}可用` : ''}</span></div>
        {mode === 'shop' ? <button aria-label={`购买${item.name}`} disabled={pet.coins < item.price} onClick={() => onBuy(item.id)}>{item.price} 豆<br/><span>购买</span></button>
          : <button aria-label={`使用${item.name}`} disabled={!count || pet.sleeping || locked} onClick={() => onCare(item.category === 'clean' ? 'wash' : item.category === 'drink' ? 'drink' : item.category === 'food' ? 'feed' : 'use', item.id)}>{item.category === 'food' ? '喂一份' : item.category === 'drink' ? '喝一份' : '用一份'}</button>}
      </article>;
    })}</div>
    {mode === 'bag' && items.every(i => !pet.inventory[i.id]) && <div className="pocket-empty">这个口袋还是空的。<button onClick={() => setMode('shop')}>去商店挑选 ›</button></div>}
    <p className="pocket-footnote">物品名称与图案来自原页游。活动物品的本地售价按桌宠玩法调整。</p>
  </div>;
}

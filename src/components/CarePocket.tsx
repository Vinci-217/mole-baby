import { useState } from 'react';
import { ITEMS, getStage } from '../game';
import type { Action, GameState, ItemCategory, PetItem } from '../game';
import './CarePocket.css';

const PAGE_SIZE = 16;
const categories: { id: ItemCategory; name: string; icon: string }[] = [
  { id: 'food', name: '食物', icon: '180001' }, { id: 'drink', name: '饮品', icon: '180002' },
  { id: 'clean', name: '清洁', icon: '180003' }, { id: 'medicine', name: '药水', icon: '180005' },
];

/** Group equal values so the selected item's effect fits in one readable line. */
export function itemEffectLine(item: PetItem): string {
  if (item.category === 'medicine' && item.health >= 100) return '恢复健康 · 四项照料 +20';
  const labels = { hunger: '饱食', thirst: '水分', cleanliness: '清洁', happiness: '心情', health: '健康' } as const;
  const groups = new Map<number, string[]>();
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    if (item[key] > 0) groups.set(item[key], [...(groups.get(item[key]) ?? []), labels[key]]);
  }
  return Array.from(groups, ([amount, names]) => `${names.join('、')} +${amount}`).join(' · ');
}

export interface CarePocketProps {
  pet: GameState;
  initialCategory?: ItemCategory;
  onCare: (action: Action, id?: string) => void;
  /** Retained for callers of the old component. Purchases belong to ShopBook. */
  onBuy?: (id: string) => void;
  allowShop?: boolean;
  onVisitShop?: () => void;
  busy?: boolean;
}

export default function CarePocket({ pet, initialCategory = 'food', onCare, allowShop = false, onVisitShop, busy = false }: CarePocketProps) {
  const [category, setCategory] = useState<ItemCategory>(initialCategory);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stage = getStage(pet.growth, pet.evolution);
  const items = ITEMS.filter(item => item.category === category);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const visible = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selected = visible.find(item => item.id === selectedId)
    ?? visible.find(item => (pet.inventory[item.id] ?? 0) > 0) ?? visible[0];
  const count = selected ? pet.inventory[selected.id] ?? 0 : 0;
  const locked = selected ? stage < selected.minStage : false;
  const action: Action = category === 'food' ? 'feed' : category === 'drink' ? 'drink' : category === 'clean' ? 'wash' : 'use';
  const buttonLabel = pet.sleeping ? '先叫醒拉姆' : busy ? '正在照料…' : locked ? `${['种子期', '初级', '中级', '高级'][selected.minStage]}可用`
    : !count ? '背包里没有' : category === 'food' ? '喂一份' : category === 'drink' ? '喝一份' : '用一份';

  function changeCategory(next: ItemCategory) { setCategory(next); setPage(0); setSelectedId(null); }
  function turnPage(next: number) { setPage(Math.max(0, Math.min(pages - 1, next))); setSelectedId(null); }

  return <section className="care-pocket" aria-label="拉姆背包">
    <header className="pocket-heading"><b>我的背包</b><span>{pet.coins} 摩尔豆</span></header>
    <nav className="pocket-categories" aria-label="物品分类">{categories.map(c => <button type="button" key={c.id} aria-pressed={category === c.id} onClick={() => changeCategory(c.id)}><img alt="" src={`./assets/original/items/${c.icon}.png`} draggable={false}/><span>{c.name}</span></button>)}</nav>
    <div className="pocket-items" aria-label={`${categories.find(c => c.id === category)!.name}十六格`}>
      {Array.from({ length: PAGE_SIZE }, (_, index) => {
        const item = visible[index];
        if (!item) return <div className="pocket-slot pocket-slot-blank" key={`blank-${index}`} aria-hidden="true"/>;
        const amount = pet.inventory[item.id] ?? 0;
        return <button type="button" className={`pocket-slot${amount ? '' : ' pocket-slot-empty'}`} key={item.id} data-item-id={item.id} data-count={amount} aria-label={`选择${item.name}，背包${amount}份`} aria-pressed={selected?.id === item.id} title={`${item.name} × ${amount}`} onClick={() => setSelectedId(item.id)}>
          <img src={item.image} alt="" draggable={false}/><span className="pocket-slot-count">×{amount}</span>
        </button>;
      })}
    </div>
    <nav className="pocket-pages" aria-label="背包翻页"><button type="button" aria-label="背包上一页" disabled={page === 0} onClick={() => turnPage(page - 1)}>‹</button><span>{page + 1} / {pages}</span><button type="button" aria-label="背包下一页" disabled={page + 1 >= pages} onClick={() => turnPage(page + 1)}>›</button></nav>
    {selected && <div className="pocket-selection" data-selected-item={selected.id}>
      <img src={selected.image} alt="" draggable={false}/><div><b>{selected.name}</b><p title={itemEffectLine(selected)}>{itemEffectLine(selected)}</p></div>
      <button type="button" className="pocket-use" aria-label={`使用${selected.name}`} disabled={!count || pet.sleeping || locked || busy} onClick={() => onCare(action, selected.id)}>{buttonLabel}</button>
    </div>}
    {onVisitShop && <button type="button" className="pocket-visit-shop" onClick={onVisitShop}>{allowShop ? '去商店补充' : '到小屋补充'} <span aria-hidden="true">›</span></button>}
  </section>;
}

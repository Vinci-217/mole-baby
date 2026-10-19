import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ITEMS, getStage } from '../game';
import type { GameState, ItemCategory } from '../game';
import { itemEffectLine } from './CarePocket';
import './ShopBook.css';

const BOOK_PAGE_SIZE = 9;
const books: { id: ItemCategory; title: string; short: string; color: string; icon: string }[] = [
  { id: 'food', title: '美味食谱', short: '食物', color: '#e8942b', icon: '180017' },
  { id: 'drink', title: '咕嘟饮品', short: '饮品', color: '#67b3c4', icon: '180002' },
  { id: 'clean', title: '香香手册', short: '清洁', color: '#93b454', icon: '180003' },
  { id: 'medicine', title: '健康宝典', short: '药水', color: '#cf88a5', icon: '180005' },
];

export interface ShopBookProps { pet: GameState; onBuy: (id: string) => void; initialCategory?: ItemCategory }

/** This shop is mounted by the room only. The bag never performs a purchase. */
export default function ShopBook({ pet, onBuy, initialCategory = 'food' }: ShopBookProps) {
  const [category, setCategory] = useState<ItemCategory>(initialCategory);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const book = books.find(value => value.id === category)!;
  const items = ITEMS.filter(item => item.category === category);
  const pages = Math.max(1, Math.ceil(items.length / BOOK_PAGE_SIZE));
  const visible = items.slice(page * BOOK_PAGE_SIZE, (page + 1) * BOOK_PAGE_SIZE);
  const selected = visible.find(item => item.id === selectedId) ?? visible[0];
  const count = selected ? pet.inventory[selected.id] ?? 0 : 0;
  const full = count >= 9_999;
  const enough = selected && pet.coins >= selected.price;
  const locked = selected && getStage(pet.growth) < selected.minStage;

  function changeBook(next: ItemCategory) { setCategory(next); setPage(0); setSelectedId(null); }
  function turnPage(next: number) { setPage(Math.max(0, Math.min(pages - 1, next))); setSelectedId(null); }

  return <section className="shop-book" aria-label="拉姆用品商店" style={{ '--book-color': book.color } as CSSProperties}>
    <header className="bookshop-heading"><div><img src="./assets/original/ui/icon-book-large.png" alt="" draggable={false}/><h3>拉姆用品商店</h3></div><span>{pet.coins} 摩尔豆</span></header>
    <nav className="bookshop-shelf" aria-label="商店图书分类">{books.map(value => <button type="button" key={value.id} className="bookshop-cover" style={{ '--cover-color': value.color } as CSSProperties} aria-label={`翻开${value.short}商品书`} aria-pressed={category === value.id} onClick={() => changeBook(value.id)}><span className="bookshop-cover-spine" aria-hidden="true"/><img src={`./assets/original/items/${value.icon}.png`} alt="" draggable={false}/><span>{value.title}</span></button>)}</nav>
    <div className="open-shop-book" key={`${category}-${page}`}>
      <div className="book-left-page">
        <h4>{book.title}</h4>
        <div className="book-products" aria-label={`${book.short}商品九宫格`}>{Array.from({ length: BOOK_PAGE_SIZE }, (_, index) => {
          const item = visible[index];
          if (!item) return <div key={`blank-${index}`} className="book-product book-product-blank" aria-hidden="true"/>;
          return <button type="button" key={item.id} className="book-product" data-item-id={item.id} aria-label={`选择${item.name}，${item.price}摩尔豆`} aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}><img src={item.image} alt="" draggable={false}/><b>{item.name}</b><span>{item.price} 豆</span></button>;
        })}</div>
        <nav className="bookshop-pages" aria-label="商店翻页"><button type="button" aria-label="商店上一页" disabled={page === 0} onClick={() => turnPage(page - 1)}>‹</button><span>{page + 1} / {pages}</span><button type="button" aria-label="商店下一页" disabled={page + 1 >= pages} onClick={() => turnPage(page + 1)}>›</button></nav>
      </div>
      <div className="book-right-page">
        {selected && <article className="book-item-detail" data-selected-item={selected.id}>
          <span className="book-item-category">{book.short}</span>
          <div className="book-item-portrait"><img src={selected.image} alt={selected.name} draggable={false}/></div>
          <h4>{selected.name}</h4>
          <p className="book-item-effects">{itemEffectLine(selected)}</p>
          <p className="book-item-owned">背包里有 <b>{count}</b> 份</p>
          {locked && <p className="book-item-stage">{['种子期', '初级', '中级', '高级'][selected.minStage]}时使用，可以先收好。</p>}
          <button type="button" className="book-buy" aria-label={`购买${selected.name}`} disabled={!enough || full} onClick={() => onBuy(selected.id)}><b>{selected.price} 摩尔豆</b><span>{full ? '背包已满' : enough ? '买一份' : '摩尔豆不足'}</span></button>
        </article>}
        <div className="book-page-number" aria-hidden="true">— {page * 2 + 2} —</div>
      </div>
    </div>
  </section>;
}

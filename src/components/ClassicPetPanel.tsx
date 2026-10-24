import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { EVOLUTIONS, GROWTH_MAX, STAGES, getItem, getPetCondition, getStage } from '../game';
import type { Action, GameState, ItemCategory, PetColor } from '../game';
import { getDiary, type CompanionMemory } from '../companion-memory';
import { OUTFITS, getOutfit } from '../wardrobe';
import { CLASSIC_PAGE_SIZE, categoryAction, itemUseReason, pocketItems } from '../classic-pocket';
import { itemEffectLine } from './CarePocket';
import Ram from './Ram';
import CareFeedback from './CareFeedback';
import type { CareFeedbackData } from '../care-feedback';
import './ClassicPetPanel.css';

export type ClassicGame = 'fruit'|'memory'|'rhythm'|'orchard'|'puzzle'|'treasure';
type Tab = 'items'|'wardrobe'|'growth'|'games'|'memories'|'play';
const tabs: {id:Tab;label:string}[] = [{id:'items',label:'用品'},{id:'wardrobe',label:'装扮'},{id:'growth',label:'成长'},{id:'games',label:'游戏'},{id:'memories',label:'回忆'},{id:'play',label:'玩耍'}];
const games: {id:ClassicGame;name:string;icon:string}[] = [{id:'fruit',name:'接果子',icon:'180027'},{id:'memory',name:'翻翻乐',icon:'180017'},{id:'rhythm',name:'拍拍乐',icon:'180004'},{id:'orchard',name:'草地采果',icon:'180028'},{id:'puzzle',name:'小屋拼图',icon:'180070'},{id:'treasure',name:'小屋寻宝',icon:'180001'}];
const art = (name:string) => `./assets/original/classic-book/${name}.png`;
const ui = (name:string) => `./assets/original/ui/${name}.png`;
const itemArt = (name:string) => `./assets/original/items/${name}.png`;
const DRAG_TYPE = 'application/x-mole-baby-item';
interface Props {
  pet:GameState; memory:CompanionMemory;
  careFeedback:CareFeedbackData|null;
  action:string; actionId:number; itemId?:string; fromColor?:PetColor;
  initialCategory?:ItemCategory; visit?:number; busy:boolean;
  moodLabel:string; timerRunning:boolean; reminders:boolean;
  onCare:(action:Action,id?:string)=>void; onClose:()=>void;
  onRename:(name:string)=>void; onWear:(id?:string)=>void;
  onShop:()=>void; onWardrobe:()=>void; onGrowth:()=>void;
  onGame:(kind:ClassicGame)=>void; onFocus:()=>void; onMood:()=>void;
  onPresence:()=>void; onCurious:()=>void;
  onActionEnd?:()=>void;
  onFoldChange?:(folded:boolean)=>void;
  nativeGeometry?:DesktopState['panelGeometry'];
  modal?:boolean;
}

/** Original frame/slots/buttons, raster exports from petUI.swf sprite182.
 * All values and interaction are live; there are no screenshot placeholders. */
export default function ClassicPetPanel(p:Props) {
  const [tab,setTab]=useState<Tab>('items'),[page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
  const [folded,setFolded]=useState(false),[scale,setScale]=useState(5/6),[editing,setEditing]=useState(false),[name,setName]=useState(p.pet.name);
  const [dropOver,setDropOver]=useState(false),[notice,setNotice]=useState('');
  const root=useRef<HTMLDivElement>(null),nameInput=useRef<HTMLInputElement>(null),closeRef=useRef(p.onClose);closeRef.current=p.onClose;
  const stage=getStage(p.pet.growth,p.pet.evolution),condition=getPetCondition(p.pet);
  const items=pocketItems(p.pet,selected??p.itemId);
  const owned=OUTFITS.filter(outfit=>p.pet.wardrobe?.includes(outfit.id));
  const diary=getDiary(p.memory).reverse();
  const pages=Math.max(1,Math.ceil((tab==='items'?items.length:tab==='memories'?diary.length:tab==='wardrobe'?owned.length:1)/(tab==='memories'?1:CLASSIC_PAGE_SIZE)));
  const currentPage=Math.min(page,pages-1);
  const selectedItem=getItem(selected??undefined),selectedOutfit=getOutfit(selected??undefined);
  const width=folded?520:1100;
  useLayoutEffect(()=>{
    const measure=()=>setScale(p.nativeGeometry?.scale??Math.min(5/6,(innerWidth-24)/1100,(innerHeight-24)/688));
    measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);
  },[p.nativeGeometry]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;root.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape') { if(nameInput.current===document.activeElement)return;closeRef.current(); }
      if(e.key==='Tab') {
        const nodes=root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]');
        if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
  },[]);
  useEffect(()=>{setName(p.pet.name);},[p.pet.name]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(editing){nameInput.current?.focus();nameInput.current?.select();}},[editing]);
  useEffect(()=>{
    setTab('items');setSelected(null);setNotice('');
    if(folded){setFolded(false);p.onFoldChange?.(false);}
    const index=pocketItems(p.pet).findIndex(item=>item.category===p.initialCategory);
    setPage(Math.max(0,Math.floor(index/CLASSIC_PAGE_SIZE)));
    // A toolbar visit chooses the requested supply page; live inventory changes
    // must not reset the user's selection while a care animation is running.
  },[p.initialCategory,p.visit]);
  const changeTab=(next:Tab)=>{setTab(next);setPage(0);setSelected(null);setNotice('');};
  const turnPage=(next:number)=>{setPage(Math.max(0,Math.min(pages-1,next)));setSelected(null);setNotice('');};
  const fold=()=>{setFolded(value=>!value);p.onFoldChange?.(!folded);};
  const useItem=(id:string)=>{const item=getItem(id);if(!item)return;const reason=itemUseReason(p.pet,item,p.busy);if(reason){setNotice(reason);return;}setSelected(id);p.onCare(categoryAction(item.category),id);};
  const wear=(id:string,toggle=true)=>{if(!p.pet.wardrobe?.includes(id as typeof owned[number]['id']))return;p.onWear(toggle&&p.pet.wearing===id?undefined:id);};
  const finishDrag=()=>{setNotice(value=>value==='拖到左边的拉姆身上'?'':value);setDropOver(false);};
  const startDrag=(e:DragEvent,id:string,kind:'item'|'outfit')=>{e.dataTransfer.setData(DRAG_TYPE,JSON.stringify({kind,id,pet:p.pet.createdAt}));e.dataTransfer.effectAllowed=kind==='item'?'copy':'link';setNotice('拖到左边的拉姆身上');};
  const drop=(e:DragEvent)=>{
    e.preventDefault();setDropOver(false);setNotice('');
    try{const value=JSON.parse(e.dataTransfer.getData(DRAG_TYPE));if(value.pet!==p.pet.createdAt)return;if(value.kind==='item')useItem(value.id);else if(value.kind==='outfit')wear(value.id,false);}catch{/* Ignore files, text and drags from other applications. */}
  };
  const stats=[
    {id:'growth',label:'成长值',value:p.pet.growth,max:GROWTH_MAX,text:`${Math.floor(p.pet.growth)} / ${GROWTH_MAX}`},
    {id:'evolution',label:'变身值',value:p.pet.evolution?1:0,max:1,text:p.pet.evolution?EVOLUTIONS.find(e=>e.id===p.pet.evolution)!.name.replace('拉姆',''):stage===4?'等待选择':'尚未进化'},
    ...([['hunger','饥饿值'],['thirst','口渴值'],['cleanliness','清洁值'],['happiness','心情值']] as const).map(([id,label])=>({id,label,value:p.pet.stats[id],max:100,text:`${Math.round(p.pet.stats[id])} / 100`}))
  ];
  const profileAction=p.itemId?p.action:p.pet.sleeping?'sleep':p.action;
  const style={width:width*scale,height:688*scale,...(p.nativeGeometry?{left:p.nativeGeometry.panelX,top:p.nativeGeometry.panelY}:{}),'--book-scale':scale} as CSSProperties;
  const avatar=<Ram costume={p.pet.wearing} color={p.pet.color} stage={stage} evolution={p.pet.evolution} action={profileAction} actionId={p.actionId} itemId={p.itemId} fromColor={p.fromColor} sleeping={p.pet.sleeping}/>;
  const selectedReason=selectedItem?itemUseReason(p.pet,selectedItem,p.busy):null;
  const birthday=new Date(p.pet.createdAt);
  const owner=[...p.memory.facts].reverse().find(f=>f.kind==='nickname')?.value??'你';
  return <div ref={root} tabIndex={-1} role="dialog" aria-modal={p.modal||undefined} aria-label="拉姆背包与状态" data-testid="companion-panel" className={`classic-pet-book ${folded?'is-folded':''} ${p.nativeGeometry?'is-native-book':''}`} style={style}>
    <div className="classic-book-canvas" style={{transform:`scale(${scale})`}}>
      <img className="classic-book-frame" src={art('frame')} alt="" draggable={false}/>
      {!folded&&<img className="classic-extra-tab" src={art('tab-extension')} alt="" draggable={false}/>}
      <button className="classic-book-close" aria-label={p.modal?"关闭面板":"关闭小窗"} onClick={p.onClose}><img src={art('close-normal')} alt=""/><img className="hover" src={art('close-hover')} alt=""/></button>
      <div className={`classic-book-portrait ${dropOver?'drop-over':''}`} data-testid="classic-drop-target" onDragOver={e=>{if(e.dataTransfer.types.includes(DRAG_TYPE)){e.preventDefault();setDropOver(true);}}} onDragLeave={()=>setDropOver(false)} onDrop={drop}>
        <CareFeedback feedback={p.careFeedback}/>
        <button aria-label={p.pet.sleeping?'叫醒拉姆':'摸摸拉姆'} title={p.pet.sleeping?'轻轻叫醒':'把用品拖到这里，或点我摸摸'} onClick={()=>p.onCare(p.pet.sleeping?'sleep':'pet')}>{avatar}</button>
      </div>
      {editing?<form className="classic-name-form" onSubmit={e=>{e.preventDefault();if(!name.trim())return;p.onRename(name);setEditing(false);}}><input ref={nameInput} aria-label="拉姆新名字" maxLength={16} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setName(p.pet.name);setEditing(false);}}}/><button aria-label="保存名字" type="submit">✓</button></form>:<button className="classic-book-name" title="给拉姆改名" aria-label={`给${p.pet.name}改名`} onClick={()=>setEditing(true)}>{p.pet.name}</button>}
      <button className="classic-book-pencil" aria-label="编辑拉姆名字" title="改名字" onClick={()=>setEditing(true)}/>
      <span className="classic-book-owner" title={owner}>{owner}</span>
      <time className="classic-book-birthday" dateTime={birthday.toISOString()} title={birthday.toLocaleDateString('zh-CN')}>{String(birthday.getMonth()+1).padStart(2,'0')}.{String(birthday.getDate()).padStart(2,'0')}</time>
      <button className="classic-book-condition" title={`${condition.description} 健康${Math.round(p.pet.stats.health)} · 精力${Math.round(p.pet.stats.energy)}`} aria-label={p.pet.sleeping?"轻轻叫醒":"回应拉姆的心情"} aria-description={`${condition.label}，${p.moodLabel}，健康${Math.round(p.pet.stats.health)}，精力${Math.round(p.pet.stats.energy)}`} onClick={()=>p.pet.sleeping?p.onCare('sleep'):p.onMood()} disabled={!p.pet.sleeping&&p.busy}><img src={ui(p.pet.sleeping?'status-sleep':p.pet.stats.health<35?'status-sick':'status-health')} alt={condition.label}/></button>
      <div className="classic-book-stats">{stats.map(stat=><div key={stat.id} className="classic-book-stat" role="progressbar" aria-label={stat.label} aria-valuemin={0} aria-valuemax={stat.max} aria-valuenow={Math.round(stat.value)} aria-valuetext={stat.text} title={stat.id==='evolution'?'桌宠按成长选择进化形态，没有额外变身经验值。':stat.label}><div><i style={{width:`${Math.min(100,100*stat.value/stat.max)}%`}}/></div><b>{stat.text}</b></div>)}</div>
      <button className="classic-book-heal" aria-label={p.pet.sleeping?'轻轻叫醒':'查看治疗用品'} title={p.pet.sleeping?'轻轻叫醒':'打开背包里的药水，用品在小屋商店补充'} onClick={()=>{
        if(p.pet.sleeping){p.onCare('sleep');return;}
        if(folded){setFolded(false);p.onFoldChange?.(false);}changeTab('items');const index=items.findIndex(item=>item.category==='medicine');setPage(index<0?0:Math.floor(index/12));setSelected(index<0?null:items[index].id);if(index<0)setNotice('没有药水啦，到小屋商店补充吧。');
      }}><img src={art('heal-normal')} alt=""/>{p.pet.sleeping&&<span>轻轻叫醒</span>}</button>
      <button className="classic-book-fold" aria-label={folded?'展开背包':'收起背包页'} title={folded?'展开背包':'收起背包页'} onClick={fold}/>
      {!folded&&<>
        <button className="classic-book-fold-right" aria-label="收起物品页" title="收起物品页" onClick={fold}/>
        <nav className="classic-book-tabs" role="tablist" aria-label="拉姆手册分类" onKeyDown={e=>{const index=tabs.findIndex(t=>t.id===tab);const next=e.key==='ArrowDown'||e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowUp'||e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;if(next<0)return;e.preventDefault();changeTab(tabs[next].id);document.getElementById(`book-tab-${tabs[next].id}`)?.focus();}}>{tabs.map((t,index)=><button key={t.id} role="tab" id={`book-tab-${t.id}`} tabIndex={tab===t.id?0:-1} aria-controls="classic-book-page" aria-selected={tab===t.id} aria-label={t.label} title={t.label} className={`classic-type type-${t.id}`} style={{top:49+100*index}} onClick={()=>changeTab(t.id)}><img src={t.id==='play'?itemArt('180004'):art(`${t.id}-normal`)} alt=""/>{t.id!=='play'&&<><img className="state-hover" src={art(`${t.id}-hover`)} alt=""/><img className="state-pressed" src={art(`${t.id}-pressed`)} alt=""/></>}<span>{t.label}</span></button>)}</nav>
        <section id="classic-book-page" role="tabpanel" aria-labelledby={`book-tab-${tab}`} className={`classic-book-page page-${tab}`}>
          {tab==='items'&&<div className="care-pocket" aria-label="拉姆用品背包" aria-busy={Boolean(p.itemId)}><div className="pocket-items" aria-label="用品十二格">{Array.from({length:12},(_,index)=>{
            const item=items.slice(currentPage*12,(currentPage+1)*12)[index];if(!item)return <button key={index} className="pocket-slot pocket-slot-blank" aria-label="空物品格" onClick={()=>{setSelected(null);setNotice('背包里的用品用完啦？去小屋补充吧。');}}/>;
            const amount=p.pet.inventory[item.id]??0;
            return <button key={item.id} type="button" className={`pocket-slot ${item.id===p.itemId?'is-using':''}`} data-item-id={item.id} data-count={amount} data-using={item.id===p.itemId||undefined} aria-label={`选择${item.name}，背包${amount}份`} aria-pressed={selected===item.id} title={`${item.name} ×${amount}，双击使用，也可以拖到拉姆身上`} draggable={amount>0} onDragStart={e=>startDrag(e,item.id,'item')} onDragEnd={finishDrag} onClick={()=>{setSelected(item.id);setNotice('');}} onDoubleClick={()=>useItem(item.id)}><img src={item.image} alt="" draggable={false}/><span className="pocket-slot-count">×{amount}</span>{item.id===p.itemId&&<img className="pocket-using-icon" src={ui('icon-clock')} alt="正在使用"/>}</button>;
          })}</div></div>}
          {tab==='wardrobe'&&<div className="classic-card-grid">{owned.map(outfit=><button className="classic-card" key={outfit.id} data-outfit-id={outfit.id} aria-label={`${p.pet.wearing===outfit.id?'收起':'穿戴'}${outfit.name}`} aria-pressed={p.pet.wearing===outfit.id} draggable onDragStart={e=>startDrag(e,outfit.id,'outfit')} onDragEnd={finishDrag} onClick={()=>setSelected(outfit.id)} onDoubleClick={()=>wear(outfit.id)}><img src={`./assets/original/wardrobe/${outfit.id}.png`} alt=""/><span>{outfit.name}</span>{p.pet.wearing===outfit.id&&<b className="classic-worn">✓</b>}</button>)}</div>}
          {tab==='games'&&<div className="classic-card-grid">{games.map(game=><button className="classic-card" key={game.id} disabled={p.pet.sleeping||(game.id==='fruit'&&stage===0)} title={game.id==='fruit'&&stage===0?'初级拉姆起可以接果子':'进入小屋开始游戏'} onClick={()=>p.onGame(game.id)}><img src={itemArt(game.icon)} alt=""/><span>{game.name}</span></button>)}</div>}
          {tab==='play'&&<div className="classic-card-grid">{[
            {name:'一起玩球',image:itemArt('180004'),run:()=>p.onCare('play'),disabled:p.pet.sleeping||p.busy},
            {name:'摸摸拉姆',image:ui('icon-happy'),run:()=>p.onCare('pet'),disabled:p.pet.sleeping||p.busy},
            {name:p.timerRunning?'结束专注':'陪我专注',image:ui('icon-clock'),run:p.onFocus,disabled:!p.reminders},
            {name:'听你说话',image:ui('toolbar-talk-normal'),run:p.onPresence,disabled:p.pet.sleeping},
            {name:'看看蝴蝶',image:'./assets/generated/v15-butterfly.png',run:p.onCurious,disabled:p.pet.sleeping||p.busy},
            {name:'回应心情',image:ui('status-health'),run:p.onMood,disabled:p.pet.sleeping||p.busy},
          ].map(play=><button className="classic-card" key={play.name} disabled={play.disabled} onClick={play.run}><img src={play.image} alt=""/><span>{play.name}</span></button>)}</div>}
          {tab==='growth'&&<div className="classic-book-sheet"><h2>一起长大</h2><ol className="classic-growth-list">{STAGES.map((s,index)=><li key={s.name} className={stage===index?'current':''}><div><Ram color={p.pet.color} stage={index as 0|1|2|3|4} evolution={index===4?p.pet.evolution??'super':undefined}/></div><span>{s.name}<small>{stage===index?'现在的我':p.pet.growth>=s.threshold?'已经长到过啦':`${s.threshold} 成长值`}</small></span></li>)}</ol><button className="classic-text-link" onClick={p.onGrowth}>看看成长手册 ›</button></div>}
          {tab==='memories'&&<div className="classic-book-sheet"><h2>我们的回忆</h2>{diary[currentPage]?<><time>{diary[currentPage].day}</time><ul className="classic-diary">{diary[currentPage].moments.map((moment,index)=><li key={index}>{moment}</li>)}</ul></>:<p className="classic-empty-story">一起吃饭、玩耍、说说话，<br/>我会把我们的小事记下来。</p>}</div>}
        </section>
        <nav className="classic-book-pages" aria-label="背包翻页"><button aria-label="背包上一页" disabled={currentPage===0} onClick={()=>turnPage(currentPage-1)}><img src={ui('page-arrow')} alt=""/></button><span aria-live="polite">{currentPage+1}/{pages}</span><button aria-label="背包下一页" disabled={currentPage+1>=pages} onClick={()=>turnPage(currentPage+1)}><img src={ui('page-arrow')} alt=""/></button></nav>
        {tab==='items'&&selectedItem&&<div className="classic-item-popup pocket-selection" data-selected-item={selectedItem.id} style={{left:Math.min(756,574+((items.findIndex(item=>item.id===selectedItem.id)%12)%3)*140),top:Math.min(455,180+Math.floor((Math.max(0,items.findIndex(item=>item.id===selectedItem.id))%12)/3)*135)}}><button className="classic-popup-close" aria-label="收起物品说明" onClick={()=>setSelected(null)}>×</button><b>{selectedItem.name}</b><p>{itemEffectLine(selectedItem)}</p><button className="classic-use-button pocket-use" aria-label={`使用${selectedItem.name}`} disabled={Boolean(selectedReason)} onClick={()=>useItem(selectedItem.id)}>{selectedReason??(selectedItem.category==='food'?'喂一份':selectedItem.category==='drink'?'喝一份':'用一份')}</button>{selectedReason==='先叫醒拉姆'&&<button className="classic-text-link" onClick={()=>p.onCare('sleep')}>轻轻叫醒</button>}</div>}
        {tab==='wardrobe'&&selectedOutfit&&<div className="classic-item-popup" style={{left:650,top:182}}><button className="classic-popup-close" aria-label="收起装扮说明" onClick={()=>setSelected(null)}>×</button><b>{selectedOutfit.name}</b><button className="classic-use-button" onClick={()=>wear(selectedOutfit.id)}>{p.pet.wearing===selectedOutfit.id?'收好装扮':'戴上看看'}</button></div>}
        {notice&&<div className="classic-book-notice" role="status">{notice}{!dropOver&&/补充|没有/.test(notice)&&<button className="classic-text-link" onClick={p.onShop}>到小屋补充 ›</button>}</div>}
        {tab==='wardrobe'&&!owned.length&&<div className="classic-book-notice">衣橱还是空的，去小屋挑一件吧。<button className="classic-text-link" onClick={p.onWardrobe}>逛逛小衣橱 ›</button></div>}
      </>}
    </div>
  </div>;
}

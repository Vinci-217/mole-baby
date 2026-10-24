import {useState} from 'react'
import type {GameState} from '../game'
import {getStage} from '../game'
import {OUTFITS,getOutfit} from '../wardrobe'
import Ram from './Ram'
import './Wardrobe.css'

export default function Wardrobe({pet,onBuy,onWear}:{pet:GameState;onBuy:(id:string)=>void;onWear:(id?:string)=>void}) {
  const [selected,setSelected]=useState<string>(pet.wearing??'')
  const [page,setPage]=useState(0),[action,setAction]=useState('idle'),[actionId,setActionId]=useState(0)
  const outfit=getOutfit(selected),owned=outfit?pet.wardrobe?.includes(outfit.id)??false:true
  const pages=Math.ceil((OUTFITS.length+1)/9),cards=[null,...OUTFITS].slice(page*9,(page+1)*9)
  return <section className="wardrobe" aria-label="拉姆小衣橱">
    <div className="wardrobe-preview"><div className="wardrobe-mirror"><Ram companionId={pet.createdAt} color={pet.color} stage={getStage(pet.growth,pet.evolution)} evolution={pet.evolution} costume={outfit?.id} action={action} actionId={actionId} onActionEnd={()=>setAction('idle')}/></div><h3>{pet.name}的小衣橱</h3><span>{pet.coins} 摩尔豆</span>
      <nav className="wardrobe-actions" aria-label="试戴动作">{[['mood-joy','开心','icon-happy'],['mood-grumpy','不高兴','status-sick'],['eat-bear-biscuit','吃东西','icon-food'],['play','玩球','icon-clock'],['walk-left','左走','sprout'],['walk-right','右走','sprout'],['sleep','睡觉','icon-clock'],['pet','摸摸','icon-happy']].map(([id,label,icon])=><button key={id} aria-label={`预览${label}动作`} aria-pressed={action===id} title={label} onClick={()=>{setActionId(n=>n+1);setAction(id)}}><img src={id==='play'?'./assets/original/items/180004.png':`./assets/original/ui/${icon}.png`} alt=""/></button>)}</nav>
      <button className="game-button small" disabled={!pet.wearing} onClick={()=>{onWear();setSelected('')}}>收好装扮</button></div>
    <div className="wardrobe-collection"><div className="wardrobe-grid" aria-label="装扮选择">{cards.map(item=>item?<button key={item.id} aria-label={`试戴${item.name}`} aria-pressed={outfit?.id===item.id} onClick={()=>setSelected(item.id)}><img src={`./assets/original/wardrobe/${item.id}.png`} alt="" draggable={false}/><b>{item.name}</b><span>{pet.wearing===item.id?'穿戴中':pet.wardrobe?.includes(item.id)?'已拥有':`${item.price} 豆`}</span></button>:<button key="plain" aria-label="试戴原来的样子" aria-pressed={!outfit} onClick={()=>setSelected('')}><img src="./assets/original/ui/icon-happy.png" alt=""/><b>原来的样子</b><span>{pet.wearing?'随时换回':'现在的我'}</span></button>)}</div>
      <nav className="wardrobe-pages" aria-label="衣橱翻页"><button aria-label="衣橱上一页" disabled={page===0} onClick={()=>setPage(v=>v-1)}>◀</button><span>{page+1}/{pages}</span><button aria-label="衣橱下一页" disabled={page+1===pages} onClick={()=>setPage(v=>v+1)}>▶</button></nav>
      <div className="wardrobe-choice"><h3>{outfit?.name??'原来的样子'}</h3><button className="game-button" disabled={outfit?owned?pet.wearing===outfit.id:pet.coins<outfit.price:!pet.wearing} onClick={()=>outfit&&!owned?onBuy(outfit.id):onWear(outfit?.id)}>{outfit?owned?pet.wearing===outfit.id?'已经戴好啦':'给拉姆戴上':`买下 · ${outfit.price} 摩尔豆`:pet.wearing?'恢复原样':'就是现在的我'}</button><p>{owned?'可随时换回原来的样子。':'先试戴，喜欢再买下。'}</p></div>
    </div>
  </section>
}

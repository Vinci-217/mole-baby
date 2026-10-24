import {useState} from 'react'
import type {GameState} from '../game'
import {getStage} from '../game'
import {OUTFITS,getOutfit} from '../wardrobe'
import Ram from './Ram'
import './Wardrobe.css'

export default function Wardrobe({pet,onBuy,onWear}:{pet:GameState;onBuy:(id:string)=>void;onWear:(id?:string)=>void}) {
  const [selected,setSelected]=useState<string>(pet.wearing??'')
  const outfit=getOutfit(selected),owned=outfit?pet.wardrobe?.includes(outfit.id)??false:true
  return <section className="wardrobe" aria-label="拉姆小衣橱">
    <div className="wardrobe-preview"><div className="wardrobe-mirror"><Ram color={pet.color} stage={getStage(pet.growth,pet.evolution)} evolution={pet.evolution} costume={outfit?.id} action="idle"/></div><h3>{pet.name}的小衣橱</h3><span>{pet.coins} 摩尔豆</span><button className="game-button small" disabled={!pet.wearing} onClick={()=>{onWear();setSelected('')}}>收好装扮</button></div>
    <div className="wardrobe-collection"><div className="wardrobe-grid" aria-label="装扮选择"><button aria-label="试戴原来的样子" aria-pressed={!outfit} onClick={()=>setSelected('')}><img src="./assets/original/ui/icon-happy.png" alt=""/><b>原来的样子</b><span>{pet.wearing?'随时换回':'现在的我'}</span></button>{OUTFITS.map(item=><button key={item.id} aria-label={`试戴${item.name}`} aria-pressed={outfit?.id===item.id} onClick={()=>setSelected(item.id)}><img src={`./assets/original/wardrobe/${item.id}.png`} alt="" draggable={false}/><b>{item.name}</b><span>{pet.wearing===item.id?'穿戴中':pet.wardrobe?.includes(item.id)?'已拥有':`${item.price} 豆`}</span></button>)}</div>
      <div className="wardrobe-choice"><h3>{outfit?.name??'原来的样子'}</h3><button className="game-button" disabled={outfit?owned?pet.wearing===outfit.id:pet.coins<outfit.price:!pet.wearing} onClick={()=>outfit&&!owned?onBuy(outfit.id):onWear(outfit?.id)}>{outfit?owned?pet.wearing===outfit.id?'已经戴好啦':'给拉姆戴上':`买下 · ${outfit.price} 摩尔豆`:pet.wearing?'恢复原样':'就是现在的我'}</button><p>{owned?'可随时换回原来的样子。':'先试戴，喜欢再买下。'}</p></div>
    </div>
  </section>
}

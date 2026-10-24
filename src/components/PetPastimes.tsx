import type {GameState} from '../game'
import {getStage} from '../game'
import {PASTIMES,PASTIME_LABELS,mayPlay} from '../pet-pastimes'
import type {Pastime} from '../pet-pastimes'

export default function PetPastimes({pet,busy,onPlay,onOuting,onRecall}:{pet:GameState;busy:boolean;onPlay:(kind:Pastime)=>void;onOuting:()=>void;onRecall:()=>void}) {
  const icons=['./assets/generated/v9-study-book.png','./assets/original/items/180004.png','./assets/original/wardrobe/star-wand.png','./assets/original/wardrobe/magic-book.png']
  return <section className="pet-pastimes" aria-label="拉姆的小日常"><header><h3>拉姆的小日常</h3><span>玩一会儿，随时回来</span></header><div>{PASTIMES.map((kind,i)=><button className="pastime-card" key={kind} disabled={busy||!mayPlay(pet)||(kind==='spell'&&getStage(pet.growth,pet.evolution)<2)} onClick={()=>onPlay(kind)} aria-label={`一起${PASTIME_LABELS[kind]}`}><img src={icons[i]} alt=""/><b>{PASTIME_LABELS[kind]}</b></button>)}<button className="pastime-card" disabled={!pet.outing&&(busy||!mayPlay(pet)||getStage(pet.growth,pet.evolution)===0)} onClick={pet.outing?onRecall:onOuting}><img src="./assets/original/ui/toolbar-home-normal.png" alt=""/><b>{pet.outing?'叫拉姆回来':'出门逛逛'}</b></button></div>{pet.outing&&<p role="status">去了{pet.outing.place} · {new Date(pet.outing.returnsAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 回来</p>}</section>
}

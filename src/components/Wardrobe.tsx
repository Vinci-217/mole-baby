import {useRef,useState} from 'react'
import {useElasticDrag} from '../use-elastic-drag'
import type {GameState} from '../game'
import {getStage} from '../game'
import {ALL_OUTFITS as OUTFITS,getOutfit,outfitAnimation,costumeAppearance} from '../wardrobe'
import {MAGIC_WAND_ID} from '../course-rewards'
import {officialOutfitForm} from '../official-clips'
import {ramForm} from '../original-actions'
import Ram from './Ram'
import './Wardrobe.css'

export default function Wardrobe({pet,onBuy,onWear}:{pet:GameState;onBuy:(id:string)=>void;onWear:(id?:string)=>void}) {
  const mirror=useRef<HTMLDivElement>(null),[dragging,setDragging]=useState(false)
  const [selected,setSelected]=useState<string>(pet.wearing??'')
  const [page,setPage]=useState(()=>Math.floor((OUTFITS.findIndex(item=>item.id===pet.wearing)+1)/9)),[action,setAction]=useState('idle'),[actionId,setActionId]=useState(0)
  const outfit=getOutfit(selected),owned=outfit?pet.wardrobe?.includes(outfit.id)??false:true
  const reward=outfit?.id===MAGIC_WAND_ID
  const seed=getStage(pet.growth,pet.evolution)===0
  const clip=outfitAnimation(outfit?.id),actualForm=ramForm(getStage(pet.growth,pet.evolution),pet.evolution)
  const suitable=!clip||Boolean(officialOutfitForm(clip,actualForm))
  const onlyClassic=clip?.forms.length===1&&clip.forms[0]==='level101'
  const juniorAppearance=!seed&&costumeAppearance(getStage(pet.growth,pet.evolution),pet.evolution,outfit?.id).form!==actualForm
  const previewStage=costumeAppearance(getStage(pet.growth,pet.evolution),pet.evolution,outfit?.id).stage
  const drag=useElasticDrag(mirror,previewStage,false,()=>{})
  const release=()=>{drag.release();setDragging(false)}
  const pages=Math.ceil((OUTFITS.length+1)/9),cards=[null,...OUTFITS].slice(page*9,(page+1)*9)
  return <section className="wardrobe" aria-label="拉姆小衣橱">
    <div className="wardrobe-preview"><div ref={mirror} className="wardrobe-mirror" data-dragging={dragging} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);const rect=event.currentTarget.getBoundingClientRect();setAction('idle');setDragging(true);drag.start({x:event.clientX,y:event.clientY,at:performance.now()},(event.clientX-rect.x)/rect.width*100,(event.clientY-rect.y)/rect.height*100)}} onPointerMove={event=>{if(dragging)drag.sample({x:event.clientX,y:event.clientY,at:performance.now()})}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><Ram dragging={dragging} companionId={pet.createdAt} color={pet.color} stage={getStage(pet.growth,pet.evolution)} evolution={pet.evolution} costume={outfit?.id} action={action} actionId={actionId} onActionEnd={()=>setAction('idle')}/></div><h3>{pet.name}的小衣橱</h3><span>{pet.coins} 摩尔豆</span>
      <nav className="wardrobe-actions" aria-label="试戴动作">{[['mood-joy','开心','icon-happy'],['mood-grumpy','不高兴','status-sick'],['eat-bear-biscuit','吃东西','icon-food'],['play','玩球','icon-clock'],['walk-left','左走','sprout'],['walk-right','右走','sprout'],['sleep','睡觉','icon-clock'],['pet','摸摸','icon-happy']].map(([id,label,icon])=><button key={id} aria-label={`预览${label}动作`} aria-pressed={action===id} onClick={()=>{setActionId(n=>n+1);setAction(id)}}><img src={id==='play'?'./assets/original/items/180004.png':`./assets/original/ui/${icon}.png`} alt=""/></button>)}</nav>
      <button className="game-button small" disabled={!pet.wearing} onClick={()=>{onWear();setSelected('')}}>收好装扮</button></div>
    <div className="wardrobe-collection"><div className="wardrobe-grid" aria-label="装扮选择">{Array.from({length:9},(_,index)=>{const item=cards[index];return item===undefined?<span key={`empty-${index}`} className="wardrobe-empty" aria-hidden="true"/>:item?<button key={item.id} aria-label={`试戴${item.name}`} aria-pressed={outfit?.id===item.id} onClick={()=>setSelected(item.id)}><img src={item.id.startsWith('original-')?(item.iconPath??'./assets/original/ui/icon-happy.png'):`./assets/original/wardrobe/${item.id}.png`} alt="" draggable={false}/><b>{item.name}</b><span>{!seed&&pet.wearing===item.id?'穿戴中':pet.wardrobe?.includes(item.id)?'已拥有':item.id===MAGIC_WAND_ID?'魔法课结业奖励':`${item.price} 豆`}</span></button>:<button key="plain" aria-label="试戴原来的样子" aria-pressed={!outfit} onClick={()=>setSelected('')}><img src="./assets/original/ui/icon-happy.png" alt=""/><b>原来的样子</b><span>{pet.wearing?'随时换回':'现在的我'}</span></button>})}</div>
      <nav className="wardrobe-pages" aria-label="衣橱翻页"><button aria-label="衣橱上一页" disabled={page===0} onClick={()=>setPage(v=>v-1)}>◀</button><span>{page+1}/{pages}</span><button aria-label="衣橱下一页" disabled={page+1===pages} onClick={()=>setPage(v=>v+1)}>▶</button></nav>
      <div className="wardrobe-choice"><h3>{outfit?.name??'原来的样子'}</h3><button className="game-button" disabled={Boolean(outfit&&seed)||Boolean(outfit&&owned&&!suitable)||(outfit?owned?pet.wearing===outfit.id:reward||pet.coins<outfit.price:!pet.wearing)} onClick={()=>outfit&&!owned?(!reward&&onBuy(outfit.id)):onWear(outfit?.id)}>{seed&&outfit?'长大后才能穿戴':outfit&&owned&&!suitable?onlyClassic?'经典超级拉姆专用':'当前形态暂不适用':outfit?owned?pet.wearing===outfit.id?'已经戴好啦':'给拉姆戴上':reward?'魔法课结业获得':`买下 · ${outfit.price} 摩尔豆`:pet.wearing?'恢复原样':'就是现在的我'}</button><p>{seed?'种子期不能试穿或穿戴，已有装扮会保留在衣橱里。':outfit&&!suitable?onlyClassic?'这件装扮仅有经典超级拉姆的原版动作，可以切换到经典超级拉姆后穿戴。':'这件装扮暂无当前形态可用的原版动作。':onlyClassic?'这件服装使用经典超级拉姆的原版外观；脱下恢复原形，成长进度保留。':juniorAppearance?'这件衣服没有当前形态的原片，穿上后显示初级外观和走法；脱下恢复原形，成长进度保留。':owned?'使用对应形态的原版动作，可随时换回原来的样子。':reward?'完成魔法课，自动收进衣橱，不出售。':'先试戴，喜欢再买下。'}</p></div>
    </div>
  </section>
}

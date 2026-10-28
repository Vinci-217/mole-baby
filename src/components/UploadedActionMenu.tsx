import type {GameState} from '../game'
import {getStage} from '../game'
import {ramForm} from '../original-actions'
import {playBlockReason} from '../pet-pastimes'
import {UPLOADED_TOYS,uploadedSpec} from '../uploaded-actions'
import './UploadedActionMenu.css'

export default function UploadedActionMenu({pet,busy,onPlay,onStop,playing}:{pet:GameState;busy:boolean;onPlay:(id:string)=>void;onStop?:()=>void;playing?:boolean}){
 const form=ramForm(getStage(pet.growth,pet.evolution),pet.evolution),supported=['junior','middle','senior','classic'].includes(form),reason=playBlockReason(pet)
 return <section className="uploaded-actions-menu" aria-label="原版拉姆动作"><header><h3>拉姆一起玩耍</h3>{playing&&onStop&&<button onClick={onStop}>结束动作</button>}</header>
 {!supported&&<p>{form==='seed'?'长到初级后，可以玩这些原版动作。':'这套原片适用于普通拉姆和经典三叶超拉，可在成长中切换。'}</p>}
 <div>{UPLOADED_TOYS.map(toy=>{const clip=uploadedSpec(form,toy.id);return <button key={toy.id} disabled={busy||Boolean(reason)||!clip} onClick={()=>onPlay(toy.id)} aria-label={toy.name}><img alt="" src={clip?`./assets/original/uploaded-actions/${clip.assetKey}/poster.png`:'./assets/original/ui/icon-medal.png'} draggable={false}/><span>{toy.name}</span></button>})}</div></section>
}

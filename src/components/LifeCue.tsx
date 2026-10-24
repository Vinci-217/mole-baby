import {useEffect} from 'react'
import type {Stage} from '../game'
import {createPetSoundClock} from '../pet-audio'
import type {SoundScore} from '../pet-sound-score'

export default function LifeCue({action,stage,sound}:{action?:string;stage:Stage;sound:boolean}) {
  useEffect(()=>{
    if(action!=='spell'&&action!=='balance')return
    const score:SoundScore={cues:action==='spell'?[{at:1100,kind:'magic',strength:.55},{at:6100,kind:'sparkle',strength:.45}]:[{at:1700,kind:'page',strength:.25},{at:5100,kind:'voice',strength:.3}]}
    const audio=createPetSoundClock(score,sound),started=performance.now();let frame=0
    const tick=(now:number)=>{audio.tick(now-started);if(now-started<8100)frame=requestAnimationFrame(tick)}
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);audio.stop()}
  },[action,sound])
  if(action==='spell')return <span className="ram-life-cue life-spell-cue" aria-hidden="true"><img className="life-wand" src="./assets/original/wardrobe/star-wand.png" alt=""/>{[0,1,2].map(i=><img className={`life-magic-star star-${i}`} key={i} src="./assets/generated/v12-dizzy-star.png" alt=""/>)}</span>
  if(action==='balance')return <span className={`ram-life-cue life-balance-cue balance-stage-${stage}`} aria-hidden="true"><img className="life-balance-book" src="./assets/generated/v9-study-book.png" alt=""/></span>
  return null
}

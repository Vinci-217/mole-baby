import {useEffect,useRef,useState} from 'react'
import type {CareResult,GameState} from '../game'
import {getStage} from '../game'
import {colourRecipe,mixColour,type ColourRecipe} from '../color-mixing'
import {playGameSound,stopGameSounds} from '../pet-audio'
import Ram from './Ram'
import './ColorMixerGame.css'

const channels=[{id:'red',name:'红色',tint:'#f65451'},{id:'green',name:'绿色',tint:'#69ae50'},{id:'blue',name:'蓝色',tint:'#54aee7'}]as const
type Result=Pick<CareResult,'ok'|'message'>
export default function ColorMixerGame({pet,sound,onBrew,onClose,onBackpack}:{pet:GameState;sound:boolean;onBrew:(color:`#${string}`)=>Result;onClose:()=>void;onBackpack:()=>void}){
 const[recipe,setRecipe]=useState<ColourRecipe>([112,204,170]),[phase,setPhase]=useState<'mix'|'brewing'|'bottled'>('mix'),[message,setMessage]=useState(''),[progress,setProgress]=useState(0)
 const color=mixColour(recipe),busy=phase==='brewing',dialog=useRef<HTMLElement>(null),lock=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
 const callbacks=useRef({onBrew,onClose});callbacks.current={onBrew,onClose}
 useEffect(()=>{
  const before=document.activeElement as HTMLElement|null;dialog.current?.focus()
  const key=(event:KeyboardEvent)=>{
   const dialogs=document.querySelectorAll('[role=dialog]');if(dialogs[dialogs.length-1]!==dialog.current)return
   if(event.key==='Escape'){event.preventDefault();callbacks.current.onClose()}
   if(event.key==='Tab'){
    const items=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');if(!items?.length)return
    const first=items[0],last=items[items.length-1]
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   }
  };document.addEventListener('keydown',key)
  return()=>{clearTimeout(timer.current);document.removeEventListener('keydown',key);before?.focus();stopGameSounds()}
 },[])
 useEffect(()=>{if(!busy)return;const began=performance.now(),id=setInterval(()=>setProgress(Math.min(1200,performance.now()-began)),40);return()=>clearInterval(id)},[busy])
 const change=(next:ColourRecipe)=>{if(lock.current)return;setRecipe(next);setMessage('');setPhase('mix')}
 const add=(index:number)=>{if(lock.current)return;change(recipe.map((n,i)=>i===index?Math.min(255,n+26):n)as unknown as ColourRecipe);playGameSound('move',sound)}
 const brew=()=>{
  if(lock.current)return;lock.current=true;setMessage('');setProgress(0);setPhase('brewing');playGameSound('start',sound)
  timer.current=setTimeout(()=>{const result=callbacks.current.onBrew(color);lock.current=false;setPhase(result.ok?'bottled':'mix');setMessage(result.message);if(result.ok)playGameSound('reward',sound)},1200)
 }
 return <div className="color-mixer-backdrop"><section role="dialog" aria-modal="true" aria-label="拉姆换色游戏" ref={dialog} tabIndex={-1} className="color-mixer-game">
  <header><div><h2>拉姆换色游戏</h2><p>调一点红，添一点蓝，收藏自己的颜色。</p></div><button aria-label="关闭换色游戏" className="round-close" onClick={onClose}>×</button></header>
  <div className="color-mixer-stage">
   <div className={`mixing-cauldron ${busy?'is-brewing':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const value=e.dataTransfer.getData('text/plain'),index=channels.findIndex(c=>c.id===value);if(index>=0)add(index)}} aria-label="调色锅，可拖入颜色瓶">
    <img src="./assets/original/color-mixer/crock-still.png" alt="原版调色锅" draggable={false}/><span className="mixing-water" style={{backgroundColor:color}}/>
    {busy&&<OriginalMixingFrames/>}
   </div>
   <div className="mixing-preview"><Ram color={color} stage={getStage(pet.growth,pet.evolution)} evolution={pet.evolution} action="still"/><span>试试看这个颜色</span><output aria-label="调配颜色">{color.toUpperCase()}</output></div>
  </div>
  <div className="mixing-colours">{channels.map((channel,index)=><div key={channel.id}>
   <button aria-label={`添加${channel.name}`} disabled={busy} draggable={!busy} onDragStart={e=>e.dataTransfer.setData('text/plain',channel.id)} onClick={()=>add(index)}><img src={`./assets/original/color-mixer/${channel.id}-still.png`} alt="" draggable={false}/><b>{channel.name}</b></button>
   <label><span className="sr-only">{channel.name}用量</span><input aria-label={`${channel.name}用量`} type="range" min="0" max="255" value={recipe[index]} disabled={busy} style={{accentColor:channel.tint}} onChange={e=>change(recipe.map((n,i)=>i===index?Number(e.target.value):n)as unknown as ColourRecipe)}/><output>{recipe[index]}</output></label>
  </div>)}</div>
  <div className="mixing-controls"><label className="mixing-colour-picker">挑个颜色<input type="color" aria-label="自定义调配颜色" value={color} disabled={busy} onChange={e=>{const next=colourRecipe(e.target.value);if(next)change(next)}}/></label><button className="game-button small" disabled={busy} onClick={()=>change([0,0,0])}>清空调色</button><button className="game-button green" disabled={busy} onClick={brew}>{busy?'正在装瓶…':'装成换色药水'}</button></div>
  {busy&&<progress aria-label="药水装瓶进度" value={progress} max={1200}/>}
  {message&&<div className="mixing-result" role="status"><p>{message}</p>{phase==='bottled'&&<button className="game-button small" onClick={onBackpack}>打开药水背包</button>}</div>}
  <p className="mixing-note">装瓶后从背包使用，拉姆才会换色。</p>
 </section></div>
}

function OriginalMixingFrames(){
 const ref=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{let live=true,frame=0;const image=new Image();image.src='./assets/original/color-mixer/crock.png';void image.decode().then(()=>{const began=performance.now(),paint=(now:number)=>{if(!live)return;const canvas=ref.current,ctx=canvas?.getContext('2d');if(ctx){ctx.clearRect(0,0,320,280);ctx.drawImage(image,Math.floor((now-began)*24/1000)%7*320,0,320,280,0,0,320,280)}frame=requestAnimationFrame(paint)};frame=requestAnimationFrame(paint)}).catch(()=>{});return()=>{live=false;cancelAnimationFrame(frame)}},[])
 return <canvas ref={ref} width={320} height={280} className="mixing-source-frames" data-frames="7" aria-hidden="true"/>
}

import {useEffect,useRef,type RefObject} from 'react'
import type {Stage} from './game'
import {createElasticDrag,pullElasticDrag,releaseElasticDrag,stepElasticDrag,elasticDragEnergy,type DragPoint} from './drag-motion'
export function useElasticDrag(root:RefObject<HTMLElement|null>,stage:Stage,native:boolean,onReaction:(reaction:'turn'|'dizzy')=>void){
 const state=useRef(createElasticDrag()),latest=useRef({stage,onReaction});latest.current={stage,onReaction}
 const grip=useRef({x:50,y:40}),wake=useRef<()=>void>(()=>{})
 function sample(point:DragPoint){const reaction=pullElasticDrag(state.current,point,latest.current.stage);if(reaction)latest.current.onReaction(reaction)}
 useEffect(()=>{
  let raf=0,previous=performance.now(),polling=false,lastPoll=0,stopped=false
  const media=matchMedia('(prefers-reduced-motion: reduce)')
  const paint=(now:number)=>{
   if(stopped)return
   raf=0
   stepElasticDrag(state.current,now-previous,media.matches);previous=now
   const sprite=root.current?.querySelector<HTMLElement>('.ram-sprite'),s=state.current
   const moving=elasticDragEnergy(s)>.002
   if(sprite){
    const young=latest.current.stage===1||latest.current.stage===2
    sprite.style.setProperty('--pull-x',`${s.x.toFixed(3)}%`)
    sprite.style.setProperty('--pull-y',`${s.y.toFixed(3)}%`)
    sprite.style.setProperty('--pull-angle',`${(young?Math.max(-3.5,Math.min(3.5,s.angle)):s.angle).toFixed(3)}deg`)
    sprite.style.setProperty('--pull-sx',String(1+s.stretch*(young ? .18 : 1)))
    sprite.style.setProperty('--pull-sy',String(1/(1+s.stretch*(young ? .18 : 1))))
    sprite.style.setProperty('--pull-skew',`${(young?s.skew*.2:s.skew).toFixed(3)}deg`)
    sprite.style.setProperty('--pull-leaf',s.fringe.toFixed(3))
    sprite.style.setProperty('--pull-grip',`${grip.current.x}% ${grip.current.y}%`)
    sprite.style.setProperty('--drag-view',s.view.toFixed(4))
    sprite.style.setProperty('--drag-distance',s.phaseDistance.toFixed(3))
    sprite.style.setProperty('--drag-horizontal-speed',s.horizontalSpeed.toFixed(3))
    sprite.dataset.pullPhase=s.held?s.turnPulse?'turn':'pull':moving?'release':'idle'
    // Publish the pose after its inputs. Independent body RAF registration
    // must not leave one form sampling the previous drag frame.
    if(young&&(s.held||moving))sprite.dispatchEvent(new Event('ram-drag-motion'))
   }
   // A moving native window changes local pointer coordinates. Read the real
   // desktop cursor instead, without touching the window's drag geometry.
   if(native&&s.held&&!polling&&now-lastPoll>=32){polling=true;lastPoll=now;void window.desktop?.getState().then(d=>{if(!stopped&&state.current.held&&d.dragPoint)sample(d.dragPoint)}).catch(()=>{}).finally(()=>{polling=false})}
   if(s.held||moving)raf=requestAnimationFrame(paint)
  };wake.current=()=>{if(!stopped&&!raf){previous=performance.now();raf=requestAnimationFrame(paint)}};wake.current()
  return()=>{stopped=true;cancelAnimationFrame(raf);releaseElasticDrag(state.current);wake.current=()=>{}}
 },[root,native])
 return {
  start(point:DragPoint,x:number,y:number){point={...point,at:native?Date.now():point.at};state.current.last=null;state.current.turns=0;state.current.direction=0;grip.current={x:Math.max(25,Math.min(75,x)),y:Math.max(28,Math.min(72,y))};sample(point);wake.current()},
  sample(point:DragPoint){if(!native)sample(point)},
  release(){releaseElasticDrag(state.current);wake.current()},
 }
}

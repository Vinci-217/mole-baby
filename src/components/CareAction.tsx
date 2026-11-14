import {sampleCareRoutine,sampleGentleMouth,type ItemMotion} from '../item-motion';

/** Shared prop choreography for bare and dressed bodies. Mouth coordinates
 * are supplied by the current body rig, never by the hat/prop envelope. */
export function paintCareAction(root:HTMLElement,motion:ItemMotion,elapsed:number,mouth:readonly[number,number],reduced:boolean,seed=false){
 const routine=sampleCareRoutine(motion,elapsed,mouth,seed,reduced);
 const vars:Record<string,string>={
  '--care-mouth-x':`${mouth[0]}%`,'--care-mouth-y':`${mouth[1]}%`,
  '--care-opacity':String(routine.opacity),'--care-jaw':String(sampleGentleMouth(motion,elapsed,reduced)/7),
  '--tray-x':`${routine.trayX}%`,'--tray-y':`${routine.trayY}%`,'--tray-opacity':String(routine.trayOpacity),'--tray-lift':`${routine.trayLift}%`,
  '--bottle-x':`${routine.bottleX}%`,'--bottle-y':`${routine.bottleY}%`,'--bottle-angle':`${routine.bottleAngle}deg`,'--bottle-empty':`${(1-routine.milk)*62}%`,
  '--clean-opacity':String(routine.cleanOpacity),'--clean-rinse':String(routine.rinse),'--care-sparkle':String(routine.sparkle),
 };
 for(const [name,value] of Object.entries(vars))root.style.setProperty(name,value);
 root.querySelectorAll<HTMLElement>('.care-food-bite').forEach((element,i)=>{const p=routine.pieces[i];if(!p)return;element.style.left=`${p.x}%`;element.style.top=`${p.y}%`;element.style.opacity=String(p.opacity);element.style.transform=`translate(-50%,-50%) rotate(${p.angle}deg) scale(${p.scale})`});
 root.querySelectorAll<HTMLElement>('.care-clean-bubble').forEach((element,i)=>{const t=reduced?0:elapsed/900+i*1.2;element.style.translate=`${Math.sin(t)*3}% ${Math.cos(t)*7}%`});
}
export default function CareAction({motion}:{motion:ItemMotion}){
 return <span className={`ram-item-cue care-routine-${motion.body}`} style={{color:motion.accent}} aria-hidden="true" data-item-id={motion.itemId} data-item-gesture={motion.gesture} data-care-routine={motion.body}>
  {motion.body==='eat'&&<><span className="care-food-plate care-prop-sheet"/>{[0,1,2,3].map(i=><img key={i} className="care-food-bite" src={motion.image} alt="" draggable={false}/>)}<span className="care-food-plate care-food-rim care-prop-sheet"/></>}
  {motion.body==='drink'&&<span className="care-drink-bottle"><span className="care-prop-sheet care-bottle-full"/><span className="care-prop-sheet care-bottle-empty"/><img className="care-bottle-label" src={motion.image} alt="" draggable={false}/></span>}
  {motion.body==='wash'&&<><span className="care-clean-foam">{[0,1,2,3,4,5,6,7].map(i=><i className="care-clean-bubble" key={i}/>)}</span><span className="care-clean-rinse">{[0,1,2,3,4].map(i=><i key={i}/>)}</span><img className="care-clean-product" src={motion.image} alt="" draggable={false}/></>}
  {motion.body==='medical'&&<img className="care-medicine-bottle" src={motion.image} alt="" draggable={false}/>}
  <span className="care-finish-sparkle">{[0,1,2].map(i=><img key={i} src="./assets/generated/v12-dizzy-star.png" alt="" draggable={false}/>)}</span>
 </span>;
}

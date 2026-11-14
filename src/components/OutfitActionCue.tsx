import type {CostumeAction} from '../costume-action';
import type {RefObject} from 'react';
import SocialCue from './SocialCue';
import CareAction from './CareAction';
import RamSchool from './RamSchool';
import './OutfitActionCue.css';

/** Original prop artwork + explicitly project-authored missing choreography. */
export default function OutfitActionCue({spec,startedAt,stage,sound,clock}:{spec:CostumeAction;startedAt:number;stage:number;sound:boolean;clock:RefObject<{elapsed:number}>}){
 if(spec.kind==='social')return <SocialCue action={spec.action}/>;
 if(spec.kind==='care'&&spec.motion)return <CareAction motion={spec.motion}/>;
 if(spec.kind==='school')return <RamSchool action={spec.action} startedAt={startedAt} stage={stage} sound={sound} clock={clock}/>;
 if(spec.kind==='toy')return <span className={`outfit-action-cue outfit-toy toy-${spec.toy}`} data-costume-toy={spec.toy} aria-hidden="true">
  {spec.toy==='180023'?<span className="outfit-spring">{[0,1,2,3].map(i=><i key={i}/>)}</span>:spec.toy==='180097'?<span className="outfit-gum"/>:<img className="outfit-moving-prop" src={spec.toy?.startsWith('tuya')?'./assets/original/items/180026.png':`./assets/original/items/${spec.toy}.png`} alt=""/>}
  {spec.toy?.startsWith('tuya')&&<svg className="outfit-doodle" viewBox="0 0 100 60"><path d="M8 39 Q24 2 39 33 T70 24 T92 35" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength="1"/></svg>}
 </span>;
 if(spec.kind==='natural')return <span className={`outfit-action-cue outfit-natural natural-${spec.natural}`} aria-hidden="true">
  {spec.natural==='study'?<SocialCue action="focus"/>:spec.natural==='music'?<span className="outfit-musical-notes">♪ ♫</span>:['write','clean','snack'].includes(spec.natural??'')?<img className="outfit-moving-prop" src={`./assets/original/items/${spec.natural==='snack'?'180001':spec.natural==='clean'?'180026':'180026'}.png`} alt=""/>:spec.natural==='rest'?<span className="outfit-rest-mark">z</span>:<img className="outfit-thought" src="./assets/generated/v12-dizzy-star.png" alt=""/>}
 </span>;
 if(spec.kind==='emotion')return <span className="outfit-action-cue" aria-hidden="true">
  {['sleep','mood-dozy','tired'].includes(spec.action)?<span className="outfit-snores">{[0,1,2].map(i=><img key={i} src="./assets/original/slumber/z.png" alt="" style={{animationDelay:`${i*1.2}s`}}/>)}</span>:['mood-joy','happy','reward','waving','catch','review'].includes(spec.action)?<img className="social-affection" src="./assets/original/ui/icon-happy.png" alt=""/>:null}
 </span>;
 return null;
}

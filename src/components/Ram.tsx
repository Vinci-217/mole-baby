import {costumePlayback} from '../wardrobe';
import RamVisual from './RamVisual';
import ClothedRam from './ClothedRam';
import AdaptedAmbientRam from './AdaptedAmbientRam';
import type {RamProps} from './ram-types';
import {useEffect,useMemo,useRef,useState} from 'react';
import {effectiveRamAction} from '../ram-action';
import {ambientOriginalClip,ambientPerformanceClip,originalActionClip,usesAmbientAdaptation} from '../pet-original-actions';
import {needGesture} from '../need-gesture';
import {originalStudyActivity,originalStudyClip} from '../ram-study';
import {isOfficialAction,originalActionVariant} from '../official-clips';
import {emotionSpec,isEmotionClip} from '../mood-motion';

/** Growth, saved clothing and a temporary official action stay independent. */
export default function Ram(props:RamProps){
 const requested=effectiveRamAction(props);
 const look=costumePlayback(props.stage,props.evolution,props.costume);
 const original=isOfficialAction(requested)?originalActionClip(requested):undefined;
 const study=requested==='read-alone'||requested==='focus'?'read':originalStudyActivity(original);
 const source=study?originalStudyClip(look.actualForm,study):original&&originalActionVariant(original,look.actualForm);
 const action=source?`${study==='read'||!requested.startsWith('official-')?'ambient':'official'}-${source.id}`:study?'still':requested;
 const eventKey=JSON.stringify([props.companionId,props.stage,props.evolution,props.costume,props.color,action,props.actionId,props.itemId]);
 const [failedSource,setFailedSource]=useState<string>();
 const moodWithoutSource=look.actualForm!=='seed'&&isEmotionClip(action)&&!emotionSpec(look.actualForm,action==='mood-joy'?'joy':'grumpy');
 const adapted=!study&&(failedSource===eventKey||(!look.clip&&(moodWithoutSource||usesAmbientAdaptation(look.actualForm,action))));
 const recoverable=!study&&source?.kind!=='magic'&&(action==='play-alone'||isEmotionClip(action)||Boolean(ambientOriginalClip(action)||needGesture(action)));
 const current=useRef({key:eventKey,finished:false}),end=useRef(props.onActionEnd),mounted=useRef(true);end.current=props.onActionEnd;
 if(current.current.key!==eventKey)current.current={key:eventKey,finished:false};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 // A delayed completion from the previous outfit/action must not finish the
 // current performance. Multiple source/watchdog callbacks settle only once.
 const generation=current.current;
 const onActionEnd=useMemo(()=>(completed=true)=>{
  if(!mounted.current||current.current!==generation||generation.finished)return;
  if(!completed&&recoverable&&!adapted){setFailedSource(eventKey);return;}
  generation.finished=true;
  end.current?.(completed);
 },[generation,adapted,recoverable,eventKey]);
 const resolved={...props,action,onActionEnd};
 if(adapted&&(!look.clip||!ambientPerformanceClip(look.actualForm,action)))return <AdaptedAmbientRam {...resolved} action={action}/>;
 return look.clip?<ClothedRam {...resolved} look={look} adaptAmbient={adapted}/>:<RamVisual {...resolved}/>;
}

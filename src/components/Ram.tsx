import {costumePlayback} from '../wardrobe';
import RamVisual from './RamVisual';
import ClothedRam from './ClothedRam';
import type {RamProps} from './ram-types';
import {useEffect,useMemo,useRef} from 'react';
import {effectiveRamAction} from '../ram-action';

/** Growth, saved clothing and a temporary official action stay independent. */
export default function Ram(props:RamProps){
 const action=effectiveRamAction(props);
 const eventKey=JSON.stringify([props.companionId,props.stage,props.evolution,props.costume,props.color,action,props.actionId,props.itemId]);
 const current=useRef({key:eventKey,finished:false}),end=useRef(props.onActionEnd),mounted=useRef(true);end.current=props.onActionEnd;
 if(current.current.key!==eventKey)current.current={key:eventKey,finished:false};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 // A delayed completion from the previous outfit/action must not finish the
 // current performance. Multiple source/watchdog callbacks settle only once.
 const generation=current.current;
 const onActionEnd=useMemo(()=>(completed=true)=>{if(!mounted.current||current.current!==generation||generation.finished)return;generation.finished=true;end.current?.(completed)},[generation]);
 const resolved={...props,action,onActionEnd};
 const look=costumePlayback(props.stage,props.evolution,props.costume);
 return look.clip?<ClothedRam {...resolved} look={look}/>:<RamVisual {...resolved}/>;
}

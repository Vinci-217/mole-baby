import {useMemo} from 'react';
import manifest from '../../public/assets/original/official/manifest.json';
import {costumeAction} from '../costume-action';
import {ramForm} from '../original-actions';
import {ambientOriginalClip} from '../pet-original-actions';
import {needGesture} from '../need-gesture';
import {petColorName} from '../pet-color';
import OfficialOutfitMotion from './OfficialOutfitMotion';
import RamVisual from './RamVisual';
import type {RamProps} from './ram-types';

/** Apply a shared gesture to this form's own painted body. */
export default function AdaptedAmbientRam(props: RamProps & {action: string}) {
  const {action,actionId,color,stage,evolution,paused,sound,onActionEnd}=props;
  const form=ramForm(stage,evolution);
  const spec=useMemo(()=>costumeAction(action,form),[action,form]);
  const referenceBody=useMemo(()=>{
    const [x,y,right,bottom]=manifest.bodyBounds[form];
    return {x,y,width:right-x,height:bottom-y};
  },[form]);
  const source=ambientOriginalClip(action);
  const label=needGesture(action)?.label??source?.name??'自然动作';
  return <span className={`ram-sprite ram-classic ram-outfit-host ${props.className??''}`} role="img"
    aria-label={`${petColorName(color)}拉姆 · ${label}`} data-action={action} data-action-source={source?.path}
    data-stage={stage} data-form={form} data-color={color} data-animation-mode={spec.kind} data-play-in-reduced-motion="true">
    <span className="ram-outfit-source" aria-hidden="true">
      <OfficialOutfitMotion sourceKey={`${form}:${color}`} spec={spec} actionId={actionId} stage={stage} evolution={evolution}
        referenceBody={referenceBody} tilt={0} sound={sound} paused={paused} frameSource playInReducedMotion onEnd={onActionEnd}>
        {()=> <RamVisual {...props} action="still" itemId={undefined} onActionEnd={undefined} sound={false}/>}
      </OfficialOutfitMotion>
    </span>
  </span>;
}

import {needGesture} from '../need-gesture';

export default function NeedActionCue({action}: {action: string}) {
  const need=needGesture(action);
  return need ? <img className="ram-need-cue" data-need={need.condition} src={need.image} alt="" aria-hidden="true" draggable={false}/> : null;
}

import {useMemo,useState, type ComponentProps} from 'react';
import {originalElementClip} from '../element-playback';
import OriginalElementSkill, {prepareElementSkill} from './OriginalElementSkill';
import SharedMagicBox from './SharedMagicBox';

type Props = Pick<ComponentProps<typeof SharedMagicBox>, 'children' | 'form' | 'startedAt' | 'onEnd' | 'onSubject'> & {
  elementId?: string;
};

/** The same smoke, target preparation and timing serve both appearances. */
export default function MagicPerformance({elementId, ...props}: Props) {
  const clip = elementId ? originalElementClip(elementId) : undefined;
  const prepared = useMemo(() => clip && elementId ? prepareElementSkill(elementId) : undefined, [clip, elementId]);
  const [started,setStarted]=useState(false),[completed,setCompleted]=useState<boolean|null>(null);
  return <SharedMagicBox {...props}
    prepare={prepared}
    targetDuration={clip?.durationMs}
    targetCompletion={clip?completed:undefined}
    onTargetPlaying={playing=>{if(playing)setStarted(true)}}
    label={clip ? `烟雾变身 · ${clip.name} · 恢复原形` : undefined}
    target={clip&&elementId?<>{started&&<OriginalElementSkill id={elementId} form={props.form} prepared={prepared} onEnd={setCompleted}/>}</>:undefined}
  />;
}

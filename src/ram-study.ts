import type { RamForm } from './original-actions';
import { OFFICIAL_CLIPS, originalActionForms, originalClipForForms, type OfficialClip } from './official-clips';
import index from '../public/assets/original/study-frames/index.json';
import type {FrameClipSpec} from './frame-clip-spec';
import {loadFrameClip} from './frame-clips';
import {prepareFrameAtlases} from './frame-atlases';
import {uploadedMotion} from './uploaded-actions';
import type {PetColor} from './pet-color';

const activities = ['read', 'write', 'draw'] as const;
type OriginalStudyActivity = typeof activities[number];
export type StudyActivity = 'read' | 'write';
const frames: Record<string,FrameClipSpec> = index;
export const originalStudyFrames=(clip:OfficialClip)=>frames[clip.id];
const sources: Record<OriginalStudyActivity, readonly OfficialClip[]> = {
  read: OFFICIAL_CLIPS.filter(clip => clip.kind === 'school' && /\/lahmMovie\/pet\d+Movie\/14\.swf$/.test(clip.path)),
  write: OFFICIAL_CLIPS.filter(clip => clip.kind === 'school' && /\/lahmMovie\/pet\d+Movie\/13\.swf$/.test(clip.path)),
  draw: OFFICIAL_CLIPS.filter(clip => clip.kind === 'care' && /\/pet\/swf\/pet\d+\/tuya1\.swf$/.test(clip.path)),
};

export function originalStudyActivity(clip: OfficialClip | undefined) {
  return clip && activities.find(activity => sources[activity].includes(clip));
}

export function originalStudyClip(form: RamForm, activity: OriginalStudyActivity) {
  // The classroom library begins at junior. The seed can still join a focus
  // session using the classic source, without changing its growth or outfit.
  return originalClipForForms(sources[activity], form === 'seed' ? ['seed', 'classic'] : originalActionForms[form]);
}

export function nextStudyActivity(form: RamForm, previous: StudyActivity): StudyActivity {
  const next = previous === 'read' ? 'write' : 'read';
  return originalStudyClip(form, next) ? next : previous;
}

export async function preloadStudyActivity(form:RamForm, color:PetColor, activity:StudyActivity){
  const source=originalStudyClip(form,activity);
  if(!source)return;
  const spec=originalStudyFrames(source)??uploadedMotion(form,`ambient-${source.id}`);
  if(!spec)return;
  const clip=await loadFrameClip(spec);
  await prepareFrameAtlases(clip.pages,color,window.mobile ? .5 : 1);
}

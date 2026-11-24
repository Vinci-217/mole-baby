import {OFFICIAL_CLIPS,originalClipForForms} from './official-clips';
import type {RamForm} from './original-actions';

const naps=OFFICIAL_CLIPS.filter(clip=>clip.kind==='school'&&/\/lahmMovie\/pet\d+Movie\/0\.swf$/.test(clip.path));

/** A short nap is the entrance to sleep. Later forms use their own sleep
 * loop when the archive has no nap for that exact body. */
export const originalNapClip=(form:RamForm)=>originalClipForForms(naps,[form]);

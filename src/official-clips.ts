import manifest from '../public/assets/original/official/manifest.json'
import type {RamForm} from './original-actions'
export interface OfficialClip {id:string;name:string;kind:string;path:string;sha256:string;bytes:number;symbol:string;forms:string[];level:number;fps:number;animated:boolean;base:boolean;clothingLayer?:number}
export const OFFICIAL_CLIPS:readonly OfficialClip[]=manifest.clips
export const ORIGINAL_OUTFITS=manifest.outfits
export const OFFICIAL_DURATION=16_000
/** Older 32-bit Chromium may compile the bundled engine slowly on first use. */
export const OFFICIAL_LOAD_TIMEOUT=45_000
export const OFFICIAL_FORM:Record<RamForm,string>={seed:'level1',junior:'level2',middle:'level3',senior:'level4',classic:'level101',super:'level101_7',water:'level5_2',wood:'level5_4',fire:'level5_1'}
const levels:Record<RamForm,number>={seed:1,junior:2,middle:3,senior:4,classic:101,super:101,water:5,wood:5,fire:5}
export const isOfficialAction=(action:string)=>action.startsWith('official-')||/^ambient-[a-f0-9]{16}$/.test(action)
export const officialClip=(id:string)=>OFFICIAL_CLIPS.find(clip=>clip.id===id)
export const officialOutfit=(id?:string)=>ORIGINAL_OUTFITS.find(outfit=>outfit.id===id)
export function supportsOfficial(clip:OfficialClip,form:RamForm){
 if(form==='seed')return clip.kind==='care'&&clip.level===1||clip.kind==='body'&&clip.forms.includes('level1')
 if(clip.forms.length||clip.base)return clip.forms.includes(OFFICIAL_FORM[form])||clip.kind==='skill'&&['water','wood','fire'].includes(form)&&clip.forms.includes('level5')
 if(clip.kind==='outfit'&&!clip.level)return form==='junior'
 // pet101 is the classic Super Ram. The later level101_7 body needs its
 // own labelled timeline; sharing the number 101 does not make it compatible.
 if(clip.level===101)return form==='classic'
 return !clip.level||clip.level===levels[form]
}
/** Clothes can use their original junior body without changing earned growth.
 * Keep this separate from spells and care, which require their exact form. */
export function officialOutfitForm(clip:OfficialClip,form:RamForm):RamForm|undefined{
 if(form==='seed'||clip.kind!=='outfit')return;
 // LamuUIManage.checkClothType chooses the complete junior rig for these
 // layers, even when the garment SWF contains other (reused) level labels.
 if(clip.clothingLayer===45||clip.clothingLayer===65)return supportsOfficial(clip,'junior')?'junior':undefined;
 if(supportsOfficial(clip,form))return form;
 if(supportsOfficial(clip,'junior'))return 'junior';
 // A few full costumes contain only a classic Super Ram. Use that complete
 // original appearance as a cosmetic, keeping the pet's actual growth intact.
 return (['classic','super','middle','senior','water','wood','fire'] as const).find(candidate=>supportsOfficial(clip,candidate));
}
export const OFFICIAL_GROUPS=[['outfit','原版装扮'],['care','道具互动'],['school','课堂动作'],['magic','魔法动作'],['transform','变身'],['skill','技能'],['body','基础动作']] as const

/** Generic elemental spell timelines use level5; clothes still require exact labels. */
export const officialTimelineForm=(clip:OfficialClip,form:RamForm)=>clip.kind==='skill'&&clip.forms.includes('level5')&&!clip.forms.includes(OFFICIAL_FORM[form])?'level5':OFFICIAL_FORM[form]

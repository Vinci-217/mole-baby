import type {GameState} from './game'

export const MAGIC_WAND_ID='star-wand'
export const LEGACY_WAND_PRICE=65
export const hasMagicDiploma=(pet:Pick<GameState,'education'>)=>Boolean(pet.education?.graduated.magic)

/** Award once at graduation and repair older graduated saves. Previously
 * purchased wands without the qualification are returned for their old price. */
export function reconcileCourseRewards(pet:GameState):GameState {
 const owned=pet.wardrobe?.includes(MAGIC_WAND_ID)===true
 if(hasMagicDiploma(pet))return owned?pet:{...pet,wardrobe:[...(pet.wardrobe??[]),MAGIC_WAND_ID]}
 if(!owned)return pet
 const next={...pet,coins:Math.min(1e9,pet.coins+LEGACY_WAND_PRICE),wardrobe:pet.wardrobe!.filter(id=>id!==MAGIC_WAND_ID)}
 if(next.wearing===MAGIC_WAND_ID)delete next.wearing
 return next
}

export type BasePetColor='pink'|'yellow'|'blue'|'red'
export type CustomPetColor=`#${string}`
export type PetColor=BasePetColor|CustomPetColor
const names:Record<BasePetColor,string>={pink:'粉色',yellow:'黄色',blue:'蓝色',red:'红色'}
const offsets:Record<BasePetColor,readonly number[]>={red:[255,-199,-250],yellow:[0,-21,-255],blue:[-215,-57,31],pink:[51,-148,0]}
export const isCustomPetColor=(value:unknown):value is CustomPetColor=>typeof value==='string'&&/^#[0-9a-f]{6}$/.test(value)
export const isPetColor=(value:unknown):value is PetColor=>isCustomPetColor(value)||typeof value==='string'&&Object.hasOwn(names,value)
export const petColorName=(color:PetColor)=>isCustomPetColor(color)?`自调色 ${color.toUpperCase()}`:names[color]
/** Preserve the four historical palettes. Custom colours affect only the body
 * masks, keeping eye whites, leaves, pots, clothes and props unchanged. */
export const petColorOffsets=(color:PetColor):readonly number[]=>isCustomPetColor(color)?[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)-255):offsets[color]
export const customPotionId=(color:CustomPetColor)=>`mix-${color.slice(1)}`
export const customPotionColor=(id:unknown):CustomPetColor|null=>typeof id==='string'&&/^mix-[0-9a-f]{6}$/.test(id)?`#${id.slice(4)}`:null
export const MAX_CUSTOM_POTION_COLORS=32

import {getItem} from './catalog'
import {tick,type CareResult,type GameState} from './game'
import {customPotionColor,customPotionId,isCustomPetColor,MAX_CUSTOM_POTION_COLORS,type CustomPetColor} from './pet-color'

export type ColourRecipe=readonly [number,number,number]
export function mixColour(recipe:ColourRecipe):CustomPetColor{
 if(recipe.length!==3||recipe.some(n=>!Number.isInteger(n)||n<0||n>255))throw new RangeError('请选择有效的红绿蓝用量。')
 return `#${recipe.map(n=>n.toString(16).padStart(2,'0')).join('')}`
}
export function colourRecipe(hex:string):ColourRecipe|null{
 const safe=hex.toLowerCase();return isCustomPetColor(safe)?[1,3,5].map(i=>parseInt(safe.slice(i,i+2),16))as unknown as ColourRecipe:null
}
/** A bottle has a stable colour-derived ID. Brewing grants a consumable, never
 * changes the pet directly and never routes through score/coin game rewards. */
export function brewColourPotion(state:GameState,color:CustomPetColor,now=Date.now()):CareResult{
 if(!isCustomPetColor(color))return {state,ok:false,message:'请先调好喜欢的颜色。'}
 const current=tick(state,now),id=customPotionId(color),inventory={...current.inventory}
 for(const key of Object.keys(inventory))if(customPotionColor(key)&&inventory[key]===0)delete inventory[key]
 const owned=Object.keys(inventory).filter(key=>customPotionColor(key)&&inventory[key]>0)
 if(!owned.includes(id)&&owned.length>=MAX_CUSTOM_POTION_COLORS)return {state:current,ok:false,message:'已经收藏32种自调色药水，先用掉一些再调新颜色吧。'}
 const count=inventory[id]??0
 if(count>=9999)return {state:current,ok:false,message:'这个颜色的药水已经装满背包啦。'}
 inventory[id]=count+1
 return {state:{...current,inventory},ok:true,message:`${getItem(id)!.name}已放进药水背包。`}
}

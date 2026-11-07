import type {GameState} from './game';
import {getStage} from './game';
import {ITEMS} from './catalog';
import {ALL_OUTFITS} from './wardrobe';
import {FURNITURE,canOwn,furnitureImage} from './room-furnishings';
import {MAGIC_WAND_ID} from './course-rewards';
import type {GamePrize} from './economy';

/** Awards unlock collections; they never equip clothes or place furniture. */
export function gamePrizeChoices(pet:GameState):GamePrize[]{
 const stage=getStage(pet.growth,pet.evolution);
 return [
  ...ITEMS.filter(item=>item.category!=='toy'&&item.minStage<=stage&&(pet.inventory[item.id]??0)<9999).map(item=>({kind:'item' as const,id:item.id,name:item.name,image:item.image,amount:1 as const})),
  ...ALL_OUTFITS.filter(outfit=>outfit.id!==MAGIC_WAND_ID&&!pet.wardrobe?.includes(outfit.id)).map(outfit=>({kind:'outfit' as const,id:outfit.id,name:outfit.name,image:outfit.iconPath??`./assets/original/wardrobe/${outfit.id}.png`,amount:1 as const})),
  ...FURNITURE.filter(furniture=>!canOwn(pet,furniture.id)).map(furniture=>({kind:'furniture' as const,id:furniture.id,name:furniture.name,image:furnitureImage(furniture.id),amount:1 as const})),
 ];
}
export function grantGamePrize(pet:GameState,prize:GamePrize):GameState{
 if(prize.kind==='item')return {...pet,inventory:{...pet.inventory,[prize.id]:(pet.inventory[prize.id]??0)+1}};
 if(prize.kind==='outfit')return {...pet,wardrobe:[...(pet.wardrobe??[]),prize.id as NonNullable<GameState['wardrobe']>[number]]};
 return {...pet,room:{owned:[...(pet.room?.owned??[]),prize.id],placed:pet.room?.placed??[]}};
}

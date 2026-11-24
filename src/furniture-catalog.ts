import archive from '../public/assets/original/furniture/archive-catalog.json';
import {FURNITURE_PRICE} from './economy';
import {READING_SHELF_ID} from './reading-progress';
import {MUSIC_BOX_ID,STANDARD_FURNITURE,standardFurnitureById,furnitureImage as imageForFurniture,type FurnitureDefinition} from './room-furnishings';

const archived:readonly FurnitureDefinition[]=archive.map(item=>({...item,
 surface:item.surface as FurnitureDefinition['surface'],
 originalArea:item.originalArea as FurnitureDefinition['originalArea'],price:FURNITURE_PRICE,
}));
const archivedById=new Map(archived.map(item=>[item.id,item]));
export const FURNITURE:readonly FurnitureDefinition[]=[...STANDARD_FURNITURE,...archived];

export const furnitureById=(id:string)=>archivedById.get(id)??standardFurnitureById(id);
export const furnitureImage=(id:string)=>imageForFurniture(id,furnitureById(id)?.image);

// Pixel widths relative to the room's 150 px pet. Wider monitors keep these proportions.
const FURNITURE_WIDTHS:Record<string,number>={
 'original-160057':195,'original-160136':155,'original-160185':65,
 'original-160188':170,'original-160190':205,'original-160216':155,
 'original-160218':260,'original-160219':235,'original-160220':155,
 'original-160221':115,'original-160227':65,'original-160254':235,
 'original-160526':250,'original-160666':85,'original-160667':85,
 'original-160680':245,'original-160681':180,'original-160683':115,
 'original-160684':175,'leaf-rug':240,cushion:110,plant:80,bookcase:155,
 'tea-table':165,lamp:65,'leaf-clock':65,picture:130,'message-board':74,[READING_SHELF_ID]:240,[MUSIC_BOX_ID]:108,
};
export function furniturePixelWidth(id:string){
 return (FURNITURE_WIDTHS[id]??furnitureById(id)?.pixelWidth??(id.startsWith('certificate-')?105:100))*.68;
}

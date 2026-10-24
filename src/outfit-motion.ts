import data from '../public/assets/original/wardrobe-motion/runtime.json';
export interface OutfitSheet {cell:number[];tile:number[];rects:number[][];bodyCell:number[];origin:number[];columns:number;rows:number;lookup:Record<string,number>;frameMap:number[];file:string}
interface OutfitSource {sourceId:string;additiveRig:boolean;forms:Record<string,Record<string,OutfitSheet>>}
const sources=data.outfits as unknown as Record<string,OutfitSource>;
export function outfitFrame(id:string,form:string,kind:string,frame:number,row:number,columns:number,sourceFrame?:number) {
  const sheet=sources[id]?.forms[form]?.[kind==='item'?'item-motion':kind];
  if(!sheet)return null;
  const key=String((kind==='football'||kind.startsWith('emotion-'))&&sourceFrame!==undefined?sourceFrame:row*columns+frame);
  const index=sheet.lookup[key];if(index===undefined)return null;
  return {sheet,index:sheet.frameMap[index]};
}
export const hasAuthoredOutfit=(id:string)=>Object.hasOwn(sources,id);

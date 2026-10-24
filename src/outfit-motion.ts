import data from '../public/assets/original/wardrobe-motion/runtime.json';
import heads from '../public/assets/original/football/head-poses.json';
export interface OutfitSheet {cell:number[];tile:number[];rects:number[][];bodyCell:number[];origin:number[];columns:number;rows:number;lookup:Record<string,number>;frameMap:number[];file:string}
interface OutfitSource {sourceId:string;additiveRig:boolean;forms:Record<string,Record<string,OutfitSheet>>}
const sources=data.outfits as unknown as Record<string,OutfitSource>;
export function outfitFrame(id:string,form:string,kind:string,frame:number,row:number,columns:number,sourceFrame?:number) {
  if(kind==='gentle')return outfitFrame(id,form,form==='seed'?'seed':'slumber',0,0,8)
  const sheet=sources[id]?.forms[form]?.[kind==='item'?'item-motion':kind];
  if(!sheet)return null;
  const key=String((kind==='football'||kind.startsWith('emotion-'))&&sourceFrame!==undefined?sourceFrame:row*columns+frame);
  const index=sheet.lookup[key];if(index===undefined)return null;
  return {sheet,index:sheet.frameMap[index]};
}
export const hasAuthoredOutfit=(id:string)=>Object.hasOwn(sources,id);
export function footballOutfitRig(form:string,sourceFrame:number){
  if(!Object.hasOwn(heads.forms,form))return null;
  const info=heads.forms[form as keyof typeof heads.forms],pose=info.poses[sourceFrame-1];
  if(!pose)return null;
  const [x,y,span,angle]=pose,[neutralX,neutralY,neutralSpan,neutralAngle]=info.neutral;
  return {x,y,neutralX,neutralY,scale:span/neutralSpan,angle:((angle-neutralAngle+180)%360+360)%360-180,body:info.neutralBody};
}

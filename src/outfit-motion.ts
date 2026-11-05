import data from '../public/assets/original/wardrobe-motion/runtime.json';
import heads from '../public/assets/original/football/head-poses.json';
import flight from '../public/assets/original/flight/runtime.json';
import classic from '../public/assets/classic/ram-level-animation-sources.json';
import superBody from '../public/assets/original/wardrobe-motion/super-body-bounds.json';
export interface OutfitSheet {cell:number[];tile:number[];rects:number[][];bodyCell:number[];origin:number[];columns:number;rows:number;lookup:Record<string,number>;frameMap:number[];file:string}
interface OutfitSource {sourceId:string;additiveRig:boolean;forms:Record<string,Record<string,OutfitSheet>>}
const sources=data.outfits as unknown as Record<string,OutfitSource>;
interface OutfitPose {sheet:OutfitSheet;index:number;sampledFlight?:boolean;heldSourceIndex?:number;borrowedForm?:'super';borrowedBody?:readonly number[]}
export function outfitFrame(id:string,form:string,kind:string,frame:number,row:number,columns:number,sourceFrame?:number):OutfitPose|null {
  if(form==='classic'){
    // The classic three-leaf body has no separate exported costume atlas.
    // Reuse original Super clothing, then let the current body surface mount
    // it. Do not fall back to the much smaller shop icon.
    let pose:OutfitPose|null,reference:readonly number[]|null|undefined
    if(kind==='flight'){
      const cell=row*columns+frame,clips=flight.forms.classic.clips
      const direction=clips.left.frames.some(p=>p.index===cell)?2:clips.right.frames.some(p=>p.index===cell)?1:0
      const clip=direction===2?clips.left:direction===1?clips.right:clips.down
      const source=1+Math.floor(((sourceFrame??1)-1)/clip.sourceFrameCount*20)
      const sampled=[1,3,5,7,9,11,13,15].filter(start=>start<=source).length-1
      pose=outfitFrame(id,'super','classic',Math.max(0,sampled),direction,8)
      reference=pose?superBody.classic.bounds[pose.heldSourceIndex??direction*8+Math.max(0,sampled)]:null
    }else{
      pose=outfitFrame(id,'super',kind,frame,row,columns,sourceFrame)
      if(pose?.sheet.file.includes('-slumber.'))reference=superBody.slumber.bounds[0]
    }
    return pose?{...pose,borrowedForm:'super',...(reference?{borrowedBody:reference}:{})}:null
  }
  if(kind==='gentle'||kind==='dizzy'||kind==='yawn'||kind==='affection')return outfitFrame(id,form,form==='seed'?'seed':'slumber',0,0,8)
  const sheet=sources[id]?.forms[form]?.[kind==='item'?'item-motion':kind];
  if(!sheet&&kind==='flight'&&(form==='senior'||form==='super')){
    // Earlier clothes predate the full-flight atlas. Their original sampled
    // direction poses already exist; never replace a full-size hood with its
    // tiny shop icon when the body switches to the complete flight player.
    const cell=row*columns+frame,clips=flight.forms[form].clips;
    const direction=clips.left.frames.some(p=>p.index===cell)?2:clips.right.frames.some(p=>p.index===cell)?1:0;
    const starts=form==='senior'?classic.senior.rows[direction].actionFrames:[1,3,5,7,9,11,13,15];
    const sampled=Math.max(0,starts.filter(start=>start<=(sourceFrame??1)).length-1);
    const pose=outfitFrame(id,form,'classic',sampled,direction,8);
    return pose?{...pose,sampledFlight:true}:null;
  }
  if(!sheet)return null;
  const key=String((kind==='football'||kind.startsWith('emotion-'))&&sourceFrame!==undefined?sourceFrame:row*columns+frame);
  const index=sheet.lookup[key];if(index===undefined)return null;
  const visible=(i:number)=>{const box=sheet.rects[sheet.frameMap[i]];return box&&box[2]-box[0]>1&&box[3]-box[1]>1}
  if(!visible(index)){
    // Older atlases retain empty stop/control cells. Keep an actual original
    // pose in the same direction rather than flashing the garment off.
    const start=kind==='classic'?row*columns:0,end=kind==='classic'?Math.min(start+columns,sheet.frameMap.length):sheet.frameMap.length
    for(let i=index-1;i>=start;i--)if(visible(i))return {sheet,index:sheet.frameMap[i],heldSourceIndex:i}
    for(let i=index+1;i<end;i++)if(visible(i))return {sheet,index:sheet.frameMap[i],heldSourceIndex:i}
    return null
  }
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

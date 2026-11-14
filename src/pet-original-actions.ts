import {getItem} from './catalog';
import actionIcons from '../public/assets/original/official/action-icons/index.json';
import {getStage,type GameState} from './game';
import type {RamForm} from './original-actions';
import {OFFICIAL_CLIPS,supportsOfficial,officialOutfitForm,type OfficialClip} from './official-clips';
import {learned} from './pet-school';
import {petActionAppearance} from './wardrobe';
import {ELEMENT_SKILLS,learnedElementSkill} from './element-skills';
import {PLAY_TOOLS,playToolClip} from './original-play-tools';
export {normalizeRamAction} from './ram-action';

export const FORM_NAMES:Record<RamForm,string>={seed:'种子',junior:'初级拉姆',middle:'中级拉姆',senior:'高级拉姆',classic:'经典超级拉姆',super:'神力超级拉姆',water:'水系拉姆',wood:'木系拉姆',fire:'火系拉姆'};
export const playableOriginal=(clip:OfficialClip)=>!clip.path.includes('/tatter/');
export const usesTransformationSmoke=(clip:OfficialClip)=>['magic','transform','skill'].includes(clip.kind)&&playableOriginal(clip);
export function playbackForm(clip:OfficialClip,form:RamForm):RamForm|undefined{
 if(clip.kind==='outfit')return officialOutfitForm(clip,form);
 if(form==='seed')return supportsOfficial(clip,form)?form:undefined;
 if(supportsOfficial(clip,form))return form;
 const nearest:RamForm[]=form==='junior'?['middle','senior','classic']:form==='middle'?['senior','junior','classic']:['classic','super','senior','middle','junior'];
 return ([...nearest,'water','wood','fire'] as RamForm[]).find(candidate=>supportsOfficial(clip,candidate));
}
export const isAmbientAction=(action:string)=>action.startsWith('ambient-');
export const originalActionClip=(action:string)=>OFFICIAL_CLIPS.find(clip=>clip.id===(action.startsWith('official-')?action.slice(9):action.slice(8)));
export function originalItemClip(id:string|undefined,form:RamForm,variant=0):OfficialClip|undefined{
 const item=getItem(id);if(!item||item.changesColor)return;
 const ids=id&&item.animationIds?.includes(id)?[id]:item.animationIds??[item.id==='energy-drink'?'180014':item.sourceId];
 const available=ids.map(source=>OFFICIAL_CLIPS.find(clip=>clip.kind==='care'&&clip.path.endsWith('/'+source+'.swf')&&supportsOfficial(clip,form))).filter((clip):clip is OfficialClip=>Boolean(clip));
 return available.length?available[Math.abs(Math.floor(variant))%available.length]:undefined;
}
const naturalNames:Record<string,string>={'0':'打个瞌睡','1':'眨眨眼','4':'吃口点心','5':'惊讶一下','7':'坐着歇歇','2':'写写画画','3':'敲敲节拍','6':'扫扫地','8':'发会儿呆','9':'颠颠足球','10':'练习画图','11':'看看望远镜','12':'研究藏宝图','13':'练习写字','14':'读读小书','15':'翻翻词典','16':'写几个公式','17':'整理小领巾','18':'想想心事','19':'小小实验','20':'练习朗读'};
const magicNames:Record<string,string>={mofaxingxing:'魔法星星',mofaxianzhiqiu:'魔法先知球',bibobibo:'bibo变变变',baibiansuixin:'百变随心',xingchenshouhu:'星辰守护',shikongganying:'时空感应',yishouzhetian:'一手遮天'};
export interface OriginalChoice {id:string;name:string;clip:OfficialClip;image?:string}
/** Stage variants are one behaviour; classroom UI, certificates and icons are excluded. */
export function naturalOriginalActions(form:RamForm):OriginalChoice[]{
 const seen=new Set<string>();
 return OFFICIAL_CLIPS.filter(clip=>clip.kind==='school'&&/\/lahmMovie\/pet\d+Movie\//.test(clip.path)&&supportsOfficial(clip,form)).flatMap(clip=>{
  const number=clip.path.split('/').pop()!.replace('.swf',''),name=naturalNames[number];if(!name||seen.has(clip.sha256))return [];seen.add(clip.sha256);return [{id:clip.id,name,clip}];
 });
}
const magicIcon='./assets/generated/school/icons/magic.png';
const sourceNumber=(clip:OfficialClip)=>clip.path.split('/').pop()!.replace('.swf','');
const iconItems:Record<string,{image:string}>=actionIcons.icons;
const spellTokens:Record<string,string>={mofaxingxing:'190415',mofaxianzhiqiu:'190416'};
/** Match original item/element icon sources before using the generic fallback. */
export function originalActionIcon(clip:OfficialClip):string{
 const number=sourceNumber(clip),itemId=clip.kind==='magic'?spellTokens[number]:clip.kind==='transform'?number:undefined;
 if(itemId&&iconItems[itemId])return iconItems[itemId].image;
 const skill=ELEMENT_SKILLS.find(skill=>String(skill.sourceId)===number);
 const standalone=clip.path.match(/\/pet5\/skill_([124])\.swf$/);
 const type=skill?.type??(standalone?({1:'fire',2:'water',4:'wood'} as Record<string,string>)[standalone[1]]:undefined);
 return type?`./assets/original/element-skills/icons/${type}.png`:magicIcon;
}

export function originalMagicActions(form:RamForm):OriginalChoice[]{
 const grouped=new Map<string,OfficialClip[]>();for(const clip of OFFICIAL_CLIPS.filter(clip=>clip.kind==='magic')){const key=sourceNumber(clip);if(magicNames[key])grouped.set(key,[...(grouped.get(key)??[]),clip]);}
 return [...grouped].flatMap(([key,clips])=>{const clip=clips.find(clip=>supportsOfficial(clip,form))??clips.find(clip=>playbackForm(clip,form));return clip?[{id:clip.id,name:magicNames[key],clip,image:originalActionIcon(clip)}]:[];});
}
const tools=PLAY_TOOLS;
export function originalPlayTools(form:RamForm):OriginalChoice[]{
 return tools.flatMap(([source,name])=>{const clip=playToolClip(form,'uploaded-'+source),item=getItem(source);return clip?[{id:clip.id,name,clip,image:item?.image}]:[];});
}
export function originalSpecialActions(form:RamForm):OriginalChoice[]{
 const seen=new Set<string>();return OFFICIAL_CLIPS.filter(clip=>['transform','skill'].includes(clip.kind)&&clip.animated&&playableOriginal(clip)&&playbackForm(clip,form)).flatMap(clip=>{
  if(seen.has(clip.sha256))return [];seen.add(clip.sha256);
  const number=sourceNumber(clip),skill=ELEMENT_SKILLS.find(skill=>String(skill.sourceId)===number),name=skill?.name??(clip.kind==='transform'?`变身${number.slice(-3)}${clip.path.includes('/tatter/')?'·碎片':''}`:clip.name.startsWith('skill_')?'神力变身'+number.slice(-1):clip.name);
  return [{id:clip.id,name,clip,image:originalActionIcon(clip)}];
 });
}
export function autonomousOriginalActions(pet:GameState):string[]{
 if(pet.sleeping||pet.activity||pet.outing||getStage(pet.growth,pet.evolution)===0||pet.stats.energy<30||pet.stats.health<=35||pet.stats.hunger<30||pet.stats.thirst<30||pet.stats.cleanliness<30)return [];
 const form=petActionAppearance(pet,'play').form;
 const originals=[...naturalOriginalActions(form),...originalPlayTools(form)].map(row=>'ambient-'+row.id);
 if(learned(pet,'magic'))originals.push('spell');

 for(const skill of ELEMENT_SKILLS)if(learnedElementSkill(pet,skill.id))originals.push('ambient-element-'+skill.id);
 return [...new Set(originals)];
}
export function chooseAutonomousOriginal(pet:GameState,previous?:string,random=Math.random):string|undefined{
 const choices=autonomousOriginalActions(pet).filter(action=>action!==previous);if(!choices.length)return;
 const roll=random();return choices[Math.min(choices.length-1,Math.max(0,Math.floor((Number.isFinite(roll)?roll:0)*choices.length)))];
}
/** Short visible speech for every self-directed performance, including the
 * source IDs used by classroom and care timelines. Never expose file names. */
export function autonomousActionLine(action:string):string{
 const normalized=action.startsWith('ambient-element-')?action.slice(8):action;
 if(normalized.startsWith('element-')){
  const skill=ELEMENT_SKILLS.find(skill=>skill.id===normalized.slice(8));
  return skill?`我要试试${skill.name}魔法，变完再回来陪你！`:'我要练习一下变身魔法，变完就回来！';
 }
 const clip=/^(official-|ambient-)[a-f0-9]{16}$/.test(action)?originalActionClip(action):undefined;
 if(clip){
  const number=sourceNumber(clip),tool=tools.find(([id])=>id===number);
  if(tool)return number.startsWith('tuya')?'我要拿起画笔，画一幅小涂鸦！':`我要玩一会儿${tool[1]}！`;
  const natural=naturalNames[number];if(clip.kind==='school'&&natural)return `我想${natural}，一会儿再来陪你。`;
  return `我要表演${magicNames[number]??clip.name}魔法，变完再回来！`;
 }
 const lines:Record<string,string>={'look-around':'我想转过头，看看周围有什么新鲜事。','watch-butterfly':'我想和小蝴蝶玩一会儿！',happy:'今天心情真好，想开心地晃一晃！',waving:'我来和你挥挥手，打个招呼！','mood-joy':'开心得想伸个懒腰！','mood-content':'我就在这里，安心地陪着你。','mood-dozy':'有点困啦，让我打个小哈欠。','mood-grumpy':'有一点点闷，我缓一会儿就好。'};
 return lines[normalized]??'我想活动一下，一会儿再来陪你。';
}

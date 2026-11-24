import {getItem} from './catalog';
import actionIcons from '../public/assets/original/official/action-icons/index.json';
import {getStage,type GameState} from './game';
import {footballSpec,ramForm,type RamForm} from './original-actions';
import {OFFICIAL_CLIPS,supportsOfficial,officialOutfitForm,officialClip,isOfficialAction,originalActionForms,type OfficialClip} from './official-clips';
import {hasLearnedMagic,learned} from './pet-school';
import {ELEMENT_SKILLS,learnedElementSkill} from './element-skills';
import {PLAY_TOOLS,playToolClip,playToolForm,playToolSource} from './original-play-tools';
import {mayPlay} from './pet-pastimes';
import {hasOriginalNeedFrames,needGesture} from './need-gesture';
import {emotionSpec,isEmotionClip,isMoodAction} from './mood-motion';
import {isAmbientAction,keepsOutfitForIdleAction} from './ram-action';
import {originalStudyActivity,type StudyActivity} from './ram-study';
export {isAmbientAction,normalizeRamAction} from './ram-action';

export const FORM_NAMES:Record<RamForm,string>={seed:'种子',junior:'初级拉姆',middle:'中级拉姆',senior:'高级拉姆',classic:'经典超级拉姆',super:'神力超级拉姆',water:'水系拉姆',wood:'木系拉姆',fire:'火系拉姆'};
export const playableOriginal=(clip:OfficialClip)=>!clip.path.includes('/tatter/');
export const usesTransformationSmoke=(clip:OfficialClip)=>['magic','transform','skill'].includes(clip.kind)&&playableOriginal(clip);
export function playbackForm(clip:OfficialClip,form:RamForm):RamForm|undefined{
 if(clip.kind==='outfit')return officialOutfitForm(clip,form);
 if(supportsOfficial(clip,form))return form;
 if(form==='seed')return originalStudyActivity(clip)&&supportsOfficial(clip,'classic')?'classic':undefined;
 const nearest:RamForm[]=form==='junior'?['middle','senior','classic']:form==='middle'?['senior','junior','classic']:['classic','super','senior','middle','junior'];
 return ([...nearest,'water','wood','fire'] as RamForm[]).find(candidate=>supportsOfficial(clip,candidate));
}
// Finite expressions and natural actions still have frames when the interface
// suppresses continuous motion.
export const playsInReducedMotion=(action:string)=>isAmbientAction(action)||isMoodAction(action)||
 ['read-alone','play-alone','look-around','watch-butterfly','happy','waving'].includes(action);
export const originalActionClip=(action:string)=>officialClip(action.startsWith('official-')?action.slice(9):action.slice(8));
export function ambientOriginalClip(action:string){
 const clip=isAmbientAction(action)?originalActionClip(action):undefined;
 return clip&&(clip.kind==='school'||clip.kind==='magic'||clip.kind==='care'&&PLAY_TOOLS.some(([id])=>id===sourceNumber(clip)))?clip:undefined;
}
/** Complete standalone clips have no clothing layer. Football can stay on
 * the current outfit rig and already has source frames for the bare forms. */
export function ambientPerformanceClip(form:RamForm,action:string){
 const clip=ambientOriginalClip(action);
 return clip&&clip.kind!=='magic'&&playToolSource(action)!=='180004'&&playbackForm(clip,form)?clip:undefined;
}
/** Later forms share the classic toy catalogue but have their own football frames. */
export function usesAmbientFootballFrames(form:RamForm,action:string){
 return keepsOutfitForIdleAction(action)&&playToolSource(action)==='180004'&&playToolForm(form)!==form&&Boolean(footballSpec(form));
}
export function usesBareBodyMotion(form:RamForm,action:string){
 if(action==='sleep'||action==='wake')return true;
 if(isEmotionClip(action))return Boolean(emotionSpec(form,action==='mood-joy'?'joy':'grumpy'));
 if(playToolSource(action)==='180004')return Boolean(footballSpec(form));
 const source=isOfficialAction(action)?originalActionClip(action):undefined;
 return Boolean(source?.kind==='school'&&playbackForm(source,form));
}
export function usesAmbientAdaptation(form:RamForm,action:string,clothed=false){
 if(action==='play-alone')return clothed;
 if(needGesture(action))return clothed||form!=='seed'&&!hasOriginalNeedFrames(form);
 const clip=ambientOriginalClip(action);
 return Boolean(clip&&clip.kind!=='magic'&&(clothed?!ambientPerformanceClip(form,action):!playbackForm(clip,form)&&!usesAmbientFootballFrames(form,action)));
}
export function originalItemClip(id:string|undefined,form:RamForm,variant=0):OfficialClip|undefined{
 const item=getItem(id);if(!item||item.changesColor)return;
 const ids=id&&item.animationIds?.includes(id)?[id]:item.animationIds??[item.id==='energy-drink'?'180014':item.sourceId];
 for(const target of originalActionForms[form]){
  const available=ids.map(source=>OFFICIAL_CLIPS.find(clip=>clip.kind==='care'&&clip.path.endsWith('/'+source+'.swf')&&supportsOfficial(clip,target))).filter(clip=>clip!==undefined);
  if(available.length)return available[Math.abs(Math.floor(variant))%available.length];
 }
}
const naturalNames:Record<string,string>={'0':'打个瞌睡','1':'眨眨眼','4':'吃口点心','5':'惊讶一下','7':'坐着歇歇','2':'做做作业','3':'敲敲节拍','6':'扫扫地','8':'发会儿呆','9':'颠颠足球','10':'摆摆图板','11':'看看显微镜','12':'拿起放大镜','13':'练习写字','14':'读读小书','15':'听课','16':'做几道题','17':'擦擦桌子','18':'想想心事','19':'量一量','20':'练习朗读'};
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
 if(getStage(pet.growth,pet.evolution)===0||!mayPlay(pet))return [];
 const form=ramForm(getStage(pet.growth,pet.evolution),pet.evolution);
 const choices=new Map<string,OfficialClip>();
 for(const source of originalActionForms[form]){
  for(const {clip} of naturalOriginalActions(source)){
   const key='school:'+sourceNumber(clip);
   if(!choices.has(key))choices.set(key,clip);
  }
  for(const [id] of PLAY_TOOLS){
   const key='tool:'+id;
   if(choices.has(key))continue;
   const clip=OFFICIAL_CLIPS.find(candidate=>candidate.kind==='care'&&sourceNumber(candidate)===id&&supportsOfficial(candidate,source));
   if(clip)choices.set(key,clip);
  }
 }
 return [...new Set([...choices.values()].map(clip=>'ambient-'+clip.id))];
}

export function autonomousMagicActions(pet:GameState):string[]{
 const stage=getStage(pet.growth,pet.evolution);
 if(stage===0||!hasLearnedMagic(pet)||!mayPlay(pet))return [];
 const form=ramForm(stage,pet.evolution);
 const choices=ELEMENT_SKILLS.filter(skill=>learnedElementSkill(pet,skill.id)).map(skill=>'ambient-element-'+skill.id);
 if(learned(pet,'magic')){
  choices.unshift('spell');
  // The archived mantra has a finite, independently verified timeline.
  const mantra=originalMagicActions(form).find(row=>sourceNumber(row.clip)==='shikongganying'&&row.clip.effectFrames);
  if(mantra)choices.push('ambient-'+mantra.id);
 }
 return choices;
}
export const isAutonomousMagic=(action='')=>action==='spell'||action.startsWith('ambient-element-')||ambientOriginalClip(action)?.kind==='magic';

export function chooseAutonomousOriginal(pet:GameState,previous?:string,random=Math.random):string|undefined{
 return drawAutonomousAction(autonomousOriginalActions(pet).filter(action=>action!==previous),random);
}
export function drawAutonomousAction(choices:readonly string[],random:()=>number){
 if(!choices.length)return;
 const roll=random();return choices[Math.min(choices.length-1,Math.max(0,Math.floor((Number.isFinite(roll)?roll:0)*choices.length)))];
}
const naturalLines:Record<string,readonly string[]>={
 '0':['眼皮在打架。先让它们抱一下。','唔……刚才那个哈欠把自己吓了一跳。'],
 '1':['眨、眨！你也看见我刚才的小动作了吗？','我刚用眨眼给你打了个暗号。'],
 '2':['我刚把一道题写成了歪歪的两行，再算一次吧。','咦，这个答案和我一开始想的不一样。让我再想想。'],
 '3':['哒、哒哒……下一拍留给你。','咦，敲快一点就成了一首小曲子。'],
 '4':['咔嚓！这口听起来就很香。','把最后一小口藏到最后吃，快乐也能多留一会儿。'],
 '5':['bibo？！刚刚那一下，我差点原地蹦起来。','欸？再看一眼才放心。'],
 '6':['碎屑扫到一起了，小角落又露出来啦。','抬抬脚，我要把这一小块也扫干净。'],
 '7':['这一小块地方挺舒服，我先坐一坐。','坐下来才发现，刚刚忙得忘了喘口气呀。'],
 '8':['刚才脑袋里飘过一朵云。我没舍得叫住它。','bibo……一小会儿什么也不想，真舒坦。'],
 '9':['一下、两下！哎呀，小球差点溜掉。','球乖乖回来了！我再接一次给你看。'],
 '10':['这片要放在这里。转一转，刚刚好！','试试把图板换个方向，唔，好像对上了。'],
 '11':['贴近一点看，原来小小的东西也这么热闹。','嘘，镜头里有个我刚刚才发现的小世界。'],
 '12':['放大一点……找到了，角落里居然藏着细节。','这个小点在镜片底下可一点也不小。'],
 '13':['这一笔慢一点。写完我还想给自己画颗小星星。','笔尖沙沙响。今天这个字比上回站得直！','最后一笔收好，给下一行留个干净的地方。'],
 '14':['我把昨天夹书签的那页翻出来啦。','这一页读到一半，我有点舍不得翻过去。','又翻一页，看看故事里的小家伙去哪儿了。'],
 '15':['听到有意思的地方，我点了好几下头。','先把这个小问题记在脑袋里，等讲完再举手。'],
 '16':['咦，这道题好像可以从另一边想。','再数一次。啊，刚才把自己也数进去了。'],
 '17':['桌角也擦到了，摸上去滑溜溜的。','手边收拾从这一小块开始，看着就舒坦。'],
 '18':['刚才想起一件小事，得自己慢慢想一想。','我走了一小会儿神。bibo，已经回来啦。'],
 '19':['轻一点，刻度快对上了。','量好啦！原来比我猜的长一点点。'],
 '20':['这句话念起来好顺口，我想再念一遍。','唔，刚才吞了一个字。给我再读一次！'],
};
const gestureLines:Record<string,readonly string[]>={
 'look-around':['我看看这边……再看看你那边。','咦，转过头来，这儿看起来又不一样了。'],
 'watch-butterfly':['小蝴蝶，等等我！我只看一眼。','它飞到那边去了。bibo，下次还来呀。'],
 happy:['今天的小高兴攒满了，看我晃给你瞧！','咦，身子自己就想蹦起来了。'],
 waving:['这边这边，是我在和你招手！','悄悄挥一下手，送你一个小小的招呼。'],
 'mood-joy':['bibo！我有份忍不住的小高兴。','这一下是开心的，后面那一下也是！'],
 'mood-content':['挨着你待会儿就很舒服。','我想把这一小会儿过得慢一点。'],
 'mood-dozy':['唔，刚刚那个哈欠比我想的还长。','让我眯一下眼睛，还听得见你呀。'],
 'mood-grumpy':['今天心里有点闷。我想挨着你待会儿。','唔，有团小乌云在我这儿停一下。陪陪我就好。'],
 'play-alone':['球滚回来啦！这回我准备好了。','咚！这一脚差一点就踢歪啦。'],
 spell:['看仔细哦。烟雾里面有个我练了好久的小把戏。','一、二、三……啪！这一次我记住咒语啦。'],
};

export function studyActionLine(activity:StudyActivity,pet?:GameState,sequence=0) {
 if(pet&&pet.stats.happiness<40)return {read:'今天有点闷，翻一页故事，心里就松一点。',write:'这一行慢慢写，先让心里的小乱团歇一会儿。'}[activity];
 if(pet&&pet.stats.energy<45)return {read:'眼皮有点沉，我慢慢读一小页。',write:'写慢一点，今天的笔尖也想歇歇。'}[activity];
 const choices=naturalLines[activity==='read'?'14':'13'];
 return choices[sequence%choices.length];
}

export function autonomousActionLine(action:string,pet?:GameState,sequence=0):string{
 const pick=(lines:readonly string[])=>lines[sequence%lines.length];
 const need=needGesture(action);
 if(need)return need.condition==='hungry'?pick(['咕噜……这次是我的肚子在说话。','要是有块小点心就好啦，我的肚子空空的。']):pick(['bibo，嘴巴干干的，想抿一小口水。','想要一点水，喝完可以再晃给你看。']);
 const normalized=action.startsWith('ambient-element-')?action.slice(8):action;
 if(normalized.startsWith('element-')){
  const skill=ELEMENT_SKILLS.find(skill=>skill.id===normalized.slice(8));
  return skill?pick([`bibo，${skill.name}魔法！看见我悄悄使劲的样子了吗？`,`准备好啦。${skill.name}魔法，出来吧！`]):'刚学的咒语我还记得。bibo，开始！';
 }
 const clip=/^(official-|ambient-)[a-f0-9]{16}$/.test(action)?originalActionClip(action):undefined;
 if(clip){
  const number=sourceNumber(clip),tool=tools.find(([id])=>id===number);
  if(tool)return number.startsWith('tuya')?pick(['这幅小涂鸦给你看。猜猜我接下来要涂什么色？','一笔、两笔，小涂鸦就有模样啦！']):pick([`${tool[1]}到我手边啦。看我这一下！`,`轮到我的${tool[1]}上场了，bibo！`]);
  if(clip.kind==='school'&&naturalLines[number]){
   if(number==='14'||number==='13')return studyActionLine(number==='14'?'read':'write',pet,sequence);
   return pick(naturalLines[number]);
  }
  return `看我的${magicNames[number]??clip.name}！数到三，bibo！`;
 }
 if(normalized==='read-alone')return studyActionLine('read',pet,sequence);
 return pick(gestureLines[normalized]??['bibo，身体也想伸展一下。','动一动，舒服多啦。']);
}

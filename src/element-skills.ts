import {getStage,type GameState} from './game';
export const ELEMENT_TYPES = [
 {id:'fire',name:'火系',basic:'小火苗',sourceType:1,names:['旺盛火焰','爆烈燃烧','火焰漩涡','流星火','星火涅槃']},
 {id:'water',name:'水系',basic:'小水滴',sourceType:2,names:['水花碎片','水上蔓延','似水奔腾','水龙','水上狂舞']},
 {id:'wood',name:'木系',basic:'小树苗',sourceType:3,names:['树根缠绕','通天藤蔓','飞花炫舞','野蛮生长','上天入地']},
] as const;
export type ElementType=typeof ELEMENT_TYPES[number]['id'];
export const ELEMENT_SKILLS=ELEMENT_TYPES.flatMap(type=>[type.basic,...type.names].map((name,index)=>({
 id:`${type.id}-${index+1}`,name,type:type.id,level:index+1,
 sourceId:1208000+(type.sourceType-1)+index*3,
 originalGrade:index===0?1:index*2+1,
})));
export const elementSkillsForCourse=(course:string)=>ELEMENT_SKILLS.filter(skill=>`element-${skill.type}`===course);
export const elementSkillById=(id:string)=>ELEMENT_SKILLS.find(skill=>skill.id===id);

export function learnedElementSkill(pet:Pick<GameState,'growth'|'evolution'|'education'>,id:string){const skill=elementSkillById(id);return Boolean(skill&&getStage(pet.growth,pet.evolution)===4&&pet.education?.graduated[`element-${skill.type}`])}

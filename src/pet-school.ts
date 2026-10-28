import {getStage,type GameState} from './game'
import {elementSkillById} from './element-skills'

const COURSE_DEFINITIONS=[
 {id:'language',name:'语言课',skill:'说中文',minutes:2,lessons:3,requires:null,icon:'language'},
 {id:'english',name:'英文课',skill:'英文问候',minutes:3,lessons:3,requires:'language',icon:'english'},
 {id:'magic',name:'魔法入门课',skill:'魔术盒变身',minutes:3,lessons:1,requires:null,icon:'magic'},
 {id:'element-fire',name:'火系变身课',skill:'火系变身',minutes:4,lessons:6,requires:'magic',icon:'fire'},
 {id:'element-water',name:'水系变身课',skill:'水系变身',minutes:4,lessons:6,requires:'magic',icon:'water'},
 {id:'element-wood',name:'木系变身课',skill:'木系变身',minutes:4,lessons:6,requires:'magic',icon:'wood'},
 {id:'wind',name:'旋风术',skill:'旋风术',minutes:4,lessons:3,requires:'magic',icon:'wind'},
 {id:'fire',name:'流火术',skill:'流火术',minutes:4,lessons:3,requires:'magic',icon:'fire'},
 {id:'ice',name:'寒冰术',skill:'寒冰术',minutes:4,lessons:3,requires:'magic',icon:'ice'},
 {id:'meteor',name:'陨石术',skill:'陨石术',minutes:4,lessons:3,requires:'magic',icon:'meteor'},
] as const
export type CourseId=typeof COURSE_DEFINITIONS[number]['id']
export const COURSES=COURSE_DEFINITIONS.map(course=>({...course,minStage:course.id.startsWith('element-')?4:1,legacy:['wind','fire','ice','meteor'].includes(course.id)}))
export const courseIcon=(id:unknown)=>{const c=courseById(id);return c?.id.startsWith('element-')?`./assets/original/element-skills/icons/${c.icon}.png`:`./assets/generated/school/icons/${c?.icon??'language'}.png`}
export interface Education {lessons:Partial<Record<CourseId,number>>;graduated:Partial<Record<CourseId,number>>}
export interface PetActivity {id:string;kind:'course'|'restaurant';course?:CourseId;startedAt:number;endsAt:number}
export const JOB_MS=120_000,JOB_PAY=180
export const courseById=(id:unknown)=>COURSES.find(c=>c.id===id)
export const learned=(pet:Pick<GameState,'education'>,id:CourseId)=>id==='magic'&&(pet.education?.lessons.magic??0)>=1||Boolean(pet.education?.graduated[id])
export const isSchoolAction=(action:string)=>Boolean(elementSkillById(action.replace(/^element-/,'')))&&action.startsWith('element-')||action==='school-language'||action==='school-english'||action==='school-magic'||action==='restaurant'||action==='skill-language'||action==='skill-english'||action==='skill-magic'||['wind','fire','ice','meteor'].some(id=>action===`skill-${id}`)
export function petSpeech(pet:Pick<GameState,'education'>|null,text:string){return pet&&!learned(pet,'language')?'bibo～ bibobibo！':text}
export function normalizeEducation(value:unknown,now:number):Education|undefined{
 if(!value||typeof value!=='object')return
 const raw=value as Partial<Education>,out:Education={lessons:{},graduated:{}}
 for(const c of COURSES){
  const n=raw.lessons?.[c.id],limit=c.id==='magic'?3:c.lessons;if(Number.isInteger(n)&&n!>=0&&n!<=limit)out.lessons[c.id]=Math.min(n!,c.lessons)
  const at=raw.graduated?.[c.id]
  if(out.lessons[c.id]===c.lessons&&Number.isSafeInteger(at)&&at!>0&&at!<=now&&(!c.requires||learned({education:out},c.requires)))out.graduated[c.id]=at
 }
 return out
}
export function normalizeActivity(value:unknown,pet:Pick<GameState,'createdAt'|'education'|'growth'|'evolution'>,now:number):PetActivity|undefined{
 if(!value||typeof value!=='object')return
 const a=value as PetActivity,c=courseById(a.course)
 if(a.kind!=='course'&&a.kind!=='restaurant'||!Number.isSafeInteger(a.startedAt)||a.startedAt<pet.createdAt||a.startedAt>now||a.id!==`${pet.createdAt}:${a.startedAt}`)return
 const duration=a.kind==='restaurant'?JOB_MS:c?c.minutes*60_000:0
 if(!duration||a.endsAt!==a.startedAt+duration||a.kind==='course'&&(!c||learned(pet,c.id)||getStage(pet.growth,pet.evolution)<c.minStage||c.requires&&!learned(pet,c.requires)))return
 return {id:a.id,kind:a.kind,...(a.kind==='course'?{course:c!.id}:{}),startedAt:a.startedAt,endsAt:a.endsAt}
}
export function activityBlockReason(pet:GameState,kind:'course'|'restaurant',id?:CourseId):string|null{
 const c=courseById(id)
 if(pet.activity)return '先完成或结束当前课程、工作。'
 if(pet.sleeping)return '拉姆睡着了，先轻轻叫醒再来上课。'
 if(pet.outing)return '拉姆正在外出，先叫它回来。'
 if(getStage(pet.growth,pet.evolution)<1)return '初级拉姆开始可以上课和打工；种子需要先长大。'
 if(kind==='course'){
  if(!c)return '请选择要学习的课程。'
  if(learned(pet,c.id))return '这门课已经结业，可以展示本领。'
  if(c.requires&&!learned(pet,c.requires))return `先完成${courseById(c.requires)!.name}。`
  if(getStage(pet.growth,pet.evolution)<c.minStage)return '第五阶段的神力拉姆才能学习三系变身课。'
 }
 if(pet.stats.health<35)return '健康不足，先照料拉姆恢复到35以上。'
 if(pet.stats.energy<30)return '精力不足，先休息恢复到30以上。'
 if(pet.stats.hunger<25)return '肚子饿了，先喂食恢复到25以上。'
 if(pet.stats.thirst<25)return '有点口渴，先喝水恢复到25以上。'
 return null
}
export function beginActivity(pet:GameState,kind:'course'|'restaurant',id?:CourseId,now=Date.now()){
 const c=courseById(id)
 const fail=(message:string)=>({state:pet,ok:false,message})
 const reason=activityBlockReason(pet,kind,id);if(reason)return fail(reason)
 if(!Number.isSafeInteger(now)||now<pet.lastTick)return fail('时间暂时不正确，请稍后再试。')
 const activity:PetActivity={id:`${pet.createdAt}:${now}`,kind,...(kind==='course'?{course:c!.id}:{}),startedAt:now,endsAt:now+(kind==='restaurant'?JOB_MS:c!.minutes*60_000)}
 return {state:{...pet,activity,stats:{...pet.stats,energy:pet.stats.energy-(kind==='restaurant'?10:5)}},ok:true,message:kind==='restaurant'?'围裙系好，去餐厅送餐啦！':`开始${c!.name}，这一节慢慢学。`}
}
/** A persisted single activity settles once, even after reopening the app. */
export function settleActivity(pet:GameState,now:number):GameState{
 const a=pet.activity;if(!a||now<a.endsAt)return pet
 const next={...pet};delete next.activity
 if(a.kind==='restaurant')return {...next,coins:Math.min(1e9,next.coins+JOB_PAY),stats:{...next.stats,happiness:Math.min(100,next.stats.happiness+5)}}
 const c=courseById(a.course);if(!c)return next
 const education:Education={lessons:{...pet.education?.lessons},graduated:{...pet.education?.graduated}}
 education.lessons[c.id]=Math.min(c.lessons,(education.lessons[c.id]??0)+1)
 if(education.lessons[c.id]===c.lessons)education.graduated[c.id]=a.endsAt
 return {...next,education}
}
export function activityAction(a?:PetActivity){return !a?null:a.kind==='restaurant'?'restaurant':a.course==='language'?'school-language':a.course==='english'?'school-english':'school-magic'}
export const activityName=(a:PetActivity)=>a.kind==='restaurant'?'餐厅打工':courseById(a.course)?.name??'上课'
/** Arrange original body poses around the newly drawn prop keyframes. */
export function schoolBody(action:string,elapsed:number){
 if(action==='restaurant'){const t=elapsed%3000;return {action:t<1100?'walk-right':t<2200?'idle':'walk-left',elapsed:t<1100?t:t<2200?t-1100:t-2200}}
 if(action.startsWith('school-'))return {action:'focus',elapsed}
 return elapsed<600?{action:'look-around',elapsed}:elapsed<1700?{action:'waving',elapsed:elapsed-600}:{action:'idle',elapsed:elapsed-1700}
}
export function cancelActivity(pet:GameState){const next={...pet};delete next.activity;return next}

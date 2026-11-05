import type {GameState} from '../game'
import ActivityCountdown from './ActivityCountdown'
import {COURSES,learned,courseIcon,activityBlockReason,type CourseId} from '../pet-school'
import {getStage} from '../game'
import {elementSkillsForCourse} from '../element-skills'
import './RamSchoolPanel.css'

export function ActivityCard({pet,onCancel}:{pet:GameState;onCancel:()=>void}){
 const a=pet.activity;if(!a)return null
 return <section className="school-activity" aria-label="当前活动"><img alt="" src={a.kind==='restaurant'?'./assets/generated/school/icons/restaurant.png':courseIcon(a.course)}/><ActivityCountdown activity={a}/><button onClick={onCancel}>结束{a.kind==='restaurant'?'工作':'这一节'}</button></section>
}
export default function RamSchoolPanel({pet,onLearn,onSkill,onElementSkill,onCancel,busy=false}:{pet:GameState;busy?:boolean;onLearn:(id:CourseId)=>void;onSkill:(id:CourseId)=>void;onElementSkill:(id:string)=>void;onCancel:()=>void}){
 return <section className="school-panel" aria-label="拉姆学院"><header><img src="./assets/generated/school/icons/language.png" alt=""/><div><h3>拉姆学院</h3><p>每门课3分钟，学一次就会。魔法课结业赠法杖；第五阶段解锁三系课程。</p></div></header>{busy&&!pet.activity&&<p role="status">正在互动或专注，结束后即可上课。</p>}<ActivityCard pet={pet} onCancel={onCancel}/><div className="school-course-grid">{COURSES.filter(c=>!c.legacy).map(c=>{
  const mastered=learned(pet,c.id),count=pet.education?.lessons[c.id]??0,stageLocked=getStage(pet.growth,pet.evolution)<c.minStage,skills=elementSkillsForCourse(c.id),reason=mastered?null:activityBlockReason(pet,'course',c.id)
  return <article key={c.id} className={mastered?'graduated':''}><img src={courseIcon(c.id)} alt=""/><h4>{c.name}</h4><p>{reason?reason:mastered?`已学会 · ${c.skill}`:`${c.minutes} 分钟 · 学一次即可掌握`}</p><div className="lesson-dots" aria-label={`已完成${count}节`}>{Array.from({length:c.lessons},(_,i)=><i key={i} className={i<count?'done':''}/>)}</div>{(!mastered||!skills.length)&&<button className="game-button small" disabled={busy||Boolean(reason)||mastered&&(pet.sleeping||Boolean(pet.activity)||Boolean(pet.outing))} onClick={()=>mastered?onSkill(c.id):onLearn(c.id)}>{mastered?'展示本领':'上这一课'}</button>}{skills.length>0&&<ol className="element-skill-list">{skills.map(skill=><li key={skill.id}><span>{skill.name}</span><button disabled={busy||!mastered||stageLocked||Boolean(pet.activity)||pet.sleeping||Boolean(pet.outing)} onClick={()=>onElementSkill(skill.id)}>{mastered?'变身':'未学会'}</button></li>)}</ol>}</article>
 })}</div><p className="school-note">课程时长为桌宠的本地安排；结业证书会放进小屋布置箱。</p></section>
}
export function RestaurantCard({onStart}:{pet:GameState;onStart:()=>void;onCancel:()=>void}){
 return <section className="restaurant-card" aria-label="拉姆餐厅"><img src="./assets/original/restaurant/dock.png" alt=""/><div><h3>拉姆餐厅</h3><p>看看拉姆取餐、端盘送餐，招待来店里吃饭的客人。</p><p>进入后自动播放，可以切换餐厅背景。</p></div><button className="game-button small" onClick={onStart}>进入餐厅</button></section>
}

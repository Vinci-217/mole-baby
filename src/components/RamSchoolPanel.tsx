import {useEffect,useState} from 'react'
import type {GameState} from '../game'
import {COURSES,learned,activityName,courseIcon,activityBlockReason,type CourseId,JOB_PAY} from '../pet-school'
import {getStage} from '../game'
import {elementSkillsForCourse} from '../element-skills'
import './RamSchoolPanel.css'

export function ActivityCard({pet,onCancel}:{pet:GameState;onCancel:()=>void}){
 const [now,setNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[])
 const a=pet.activity;if(!a)return null
 const seconds=Math.max(0,Math.ceil((a.endsAt-now)/1000))
 return <section className="school-activity" aria-label="当前活动"><img alt="" src={a.kind==='restaurant'?'./assets/generated/school/icons/restaurant.png':courseIcon(a.course)}/><div><strong>{activityName(a)}</strong><span role="timer">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span><progress value={Math.max(0,now-a.startedAt)} max={a.endsAt-a.startedAt}/></div><button onClick={onCancel}>结束{a.kind==='restaurant'?'工作':'这一节'}</button></section>
}
export default function RamSchoolPanel({pet,onLearn,onSkill,onElementSkill,onCancel,busy=false}:{pet:GameState;busy?:boolean;onLearn:(id:CourseId)=>void;onSkill:(id:CourseId)=>void;onElementSkill:(id:string)=>void;onCancel:()=>void}){
 return <section className="school-panel" aria-label="拉姆学院"><header><img src="./assets/generated/school/icons/language.png" alt=""/><div><h3>拉姆学院</h3><p>每门课学一次就会啦！第五阶段学完一门三系课，即可掌握本系全部变身。</p></div></header>{busy&&!pet.activity&&<p role="status">正在互动或专注，结束后即可上课。</p>}<ActivityCard pet={pet} onCancel={onCancel}/><div className="school-course-grid">{COURSES.filter(c=>!c.legacy).map(c=>{
  const mastered=learned(pet,c.id),count=pet.education?.lessons[c.id]??0,stageLocked=getStage(pet.growth,pet.evolution)<c.minStage,skills=elementSkillsForCourse(c.id),reason=mastered?null:activityBlockReason(pet,'course',c.id)
  return <article key={c.id} className={mastered?'graduated':''}><img src={courseIcon(c.id)} alt=""/><h4>{c.name}</h4><p>{reason?reason:mastered?`已学会 · ${c.skill}`:`${c.minutes} 分钟 · 学一次即可掌握`}</p><div className="lesson-dots" aria-label={`已完成${count}节`}>{Array.from({length:c.lessons},(_,i)=><i key={i} className={i<count?'done':''}/>)}</div>{(!mastered||!skills.length)&&<button className="game-button small" disabled={busy||Boolean(reason)||mastered&&(pet.sleeping||Boolean(pet.activity)||Boolean(pet.outing))} onClick={()=>mastered?onSkill(c.id):onLearn(c.id)}>{mastered?'展示本领':'上这一课'}</button>}{skills.length>0&&<ol className="element-skill-list">{skills.map(skill=><li key={skill.id}><span>{skill.name}</span><button disabled={busy||!mastered||stageLocked||Boolean(pet.activity)||pet.sleeping||Boolean(pet.outing)} onClick={()=>onElementSkill(skill.id)}>{mastered?'变身':'未学会'}</button></li>)}</ol>}</article>
 })}</div><p className="school-note">课程时长为桌宠的本地安排；结业证书会放进小屋布置箱。</p></section>
}
export function RestaurantCard({pet,onStart,onCancel}:{pet:GameState;onStart:()=>void;onCancel:()=>void}){
 return <section className="restaurant-card" aria-label="餐厅打工"><img src="./assets/generated/school/icons/restaurant.png" alt=""/><div><h3>餐厅小服务员</h3><p>送餐、收拾小桌子 · 2 分钟 / +{JOB_PAY} 摩尔豆</p></div><button className="game-button small" disabled={pet.sleeping||Boolean(pet.activity)||pet.growth<60} onClick={onStart}>去打工</button>{pet.activity?.kind==='restaurant'&&<ActivityCard pet={pet} onCancel={onCancel}/>}</section>
}

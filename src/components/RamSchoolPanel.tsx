import {useEffect,useState} from 'react'
import type {GameState} from '../game'
import {COURSES,learned,activityName,courseIcon,type CourseId,JOB_PAY} from '../pet-school'
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
 return <section className="school-panel" aria-label="拉姆学院"><header><img src="./assets/generated/school/icons/language.png" alt=""/><div><h3>拉姆学院</h3><p>魔法入门后学会变魔术；第五阶段可学习火、水、木三系，每节课解锁一个新变身。</p></div></header><ActivityCard pet={pet} onCancel={onCancel}/><div className="school-course-grid">{COURSES.filter(c=>!c.legacy).map(c=>{
  const mastered=learned(pet,c.id),locked=Boolean(c.requires&&!learned(pet,c.requires)),count=pet.education?.lessons[c.id]??0,stageLocked=getStage(pet.growth,pet.evolution)<c.minStage,skills=elementSkillsForCourse(c.id)
  return <article key={c.id} className={mastered?'graduated':''}><img src={courseIcon(c.id)} alt=""/><h4>{c.name}</h4><p>{stageLocked&&c.minStage===4?'第五阶段开启':mastered?`已学会 · ${c.skill}`:locked?`先完成${COURSES.find(v=>v.id===c.requires)!.name}`:`每节 ${c.minutes} 分钟 · ${count}/${c.lessons} 节`}</p><div className="lesson-dots" aria-label={`已完成${count}节`}>{Array.from({length:c.lessons},(_,i)=><i key={i} className={i<count?'done':''}/>)}</div>{(!mastered||!skills.length)&&<button className="game-button small" disabled={busy||Boolean(pet.activity)||pet.sleeping||locked||stageLocked} onClick={()=>mastered?onSkill(c.id):onLearn(c.id)}>{mastered?'展示本领':skills.length?`学习第 ${count+1} 节`:'上这一课'}</button>}{skills.length>0&&<ol className="element-skill-list">{skills.map((skill,index)=><li key={skill.id}><span>{skill.name}</span><button disabled={busy||count<=index||stageLocked||Boolean(pet.activity)||pet.sleeping} onClick={()=>onElementSkill(skill.id)}>{count>index?'变身':'未学会'}</button></li>)}</ol>}</article>
 })}</div><p className="school-note">课程时长为桌宠的本地安排；结业证书会放进小屋布置箱。</p></section>
}
export function RestaurantCard({pet,onStart,onCancel}:{pet:GameState;onStart:()=>void;onCancel:()=>void}){
 return <section className="restaurant-card" aria-label="餐厅打工"><img src="./assets/generated/school/icons/restaurant.png" alt=""/><div><h3>餐厅小服务员</h3><p>送餐、收拾小桌子 · 2 分钟 / +{JOB_PAY} 摩尔豆</p></div><button className="game-button small" disabled={pet.sleeping||Boolean(pet.activity)||pet.growth<60} onClick={onStart}>去打工</button>{pet.activity?.kind==='restaurant'&&<ActivityCard pet={pet} onCancel={onCancel}/>}</section>
}

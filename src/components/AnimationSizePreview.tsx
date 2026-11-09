import {useEffect,useState} from 'react';
import {flushSync} from 'react-dom';
import Ram from './Ram';
import {RAM_ACTIONS} from './ram-animation';
import {ALL_OUTFITS} from '../wardrobe';
import {ELEMENT_SKILLS} from '../element-skills';
import {OFFICIAL_CLIPS} from '../official-clips';
import {playbackForm} from '../pet-original-actions';
import type {Evolution,Stage} from '../game';
import type {RamForm} from '../original-actions';
import './AnimationSizePreview.css';

export const forms:[RamForm,string,Stage,Evolution?][]=[['seed','种子',0],['junior','初级',1],['middle','中级',2],['senior','高级',3],['classic','经典超级拉姆',4,'classic'],['super','神力超级拉姆',4,'super'],['water','水系',4,'water'],['wood','木系',4,'wood'],['fire','火系',4,'fire']];
export const actionLabels:Record<string,string>={idle:'日常待机',waiting:'等候',still:'保持原样',drag:'拖动',eat:'吃东西',feed:'喂食',drink:'喝水',wash:'洗澡',use:'使用道具',medical:'用药',thirsty:'口渴',hungry:'肚子饿',sick:'生病',tired:'疲倦',dirty:'需要清洁',pet:'摸头',waving:'挥手',catch:'接住',failed:'失落',play:'踢足球',reward:'获得奖励',happy:'开心',wake:'醒来','walk-left':'向左走','walk-right':'向右走','running-left':'向左跑','running-right':'向右跑',running:'跑步',focus:'专注看书',dizzy:'晕乎乎','watch-butterfly':'看蝴蝶','look-around':'东张西望',sleep:'睡觉',peek:'探头',hide:'躲藏',review:'查看心情','mood-joy':'心情 · 快乐','mood-grumpy':'心情 · 生气','mood-content':'心情 · 满足','mood-dozy':'心情 · 困倦','read-alone':'自己翻书','play-alone':'自己玩耍',spell:'变魔术','school-language':'语言课堂','school-english':'英语课堂','school-magic':'魔法课堂',restaurant:'餐厅打工','skill-language':'语言技能','skill-english':'英语技能','skill-magic':'魔术技能','skill-wind':'风魔法','skill-fire':'火魔法','skill-ice':'冰魔法','skill-meteor':'流星魔法',...Object.fromEntries(ELEMENT_SKILLS.map(skill=>['element-'+skill.id,skill.name]))};
type Selection={form:RamForm;action:string;outfit?:string;rawDaily?:boolean};
declare global{interface Window{animationSizeReview?:{select:(value:Selection)=>void;actions:readonly string[];forms:readonly RamForm[]}}}
/** Independent review uses the shipping character renderer and never opens a save. */
export default function AnimationSizePreview(){
 const [selection,setSelection]=useState<Selection>(()=>{const p=new URLSearchParams(location.search);return {form:(p.get('form')??'junior') as RamForm,action:p.get('action')??'idle',outfit:p.get('outfit')??undefined}});
 const [round,setRound]=useState(0),[finished,setFinished]=useState(false);
 const choose=(value:Selection)=>{setSelection(value);setFinished(false);setRound(n=>n+1)};
 useEffect(()=>{window.animationSizeReview={select:value=>flushSync(()=>choose(value)),actions:RAM_ACTIONS,forms:forms.map(([id])=>id)};return()=>{delete window.animationSizeReview}},[]);
 const spec=forms.find(([id])=>id===selection.form)??forms[1];
 return <main className="animation-size-review"><header><h1>拉姆动画 · 大小对照</h1><p>两边使用相同显示比例。左边保持原样，右边播放当前动作。</p><nav>
  <label>形态 <select aria-label="尺寸对照形态" value={selection.form} onChange={e=>choose({...selection,form:e.target.value as RamForm})}>{forms.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
  <label>装扮 <select aria-label="尺寸对照装扮" value={selection.outfit??''} onChange={e=>choose({...selection,outfit:e.target.value||undefined})}><option value="">原来的样子</option>{ALL_OUTFITS.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <label>动作 <select aria-label="尺寸对照动作" value={selection.action} onChange={e=>choose({...selection,action:e.target.value})}><optgroup label="常用动作与变身">{RAM_ACTIONS.map(action=><option key={action} value={action}>{actionLabels[action]??action}</option>)}</optgroup><optgroup label="原版素材逐项检查">{OFFICIAL_CLIPS.filter(c=>c.kind!=='outfit'&&c.kind!=='body'&&!c.path.includes('/tatter/')&&playbackForm(c,selection.form)).map(c=><option key={c.id} value={'official-'+c.id}>{c.name} · {c.path.split('/').slice(-2).join('/')}</option>)}</optgroup></select></label>
  <button onClick={()=>choose({...selection})}>重新播放</button>
 </nav></header><section><figure><div className="size-review-pet" data-review-baseline><Ram color="blue" stage={spec[2]} evolution={spec[3]} action="still" sound={false}/></div><figcaption>原来的大小</figcaption></figure><figure><div className="size-review-pet" data-review-subject data-finished={finished}><Ram color="blue" stage={spec[2]} evolution={spec[3]} action={selection.action} costume={selection.outfit} dragging={selection.action==='drag'} actionId={round} rawDaily={selection.rawDaily} sound={false} onActionEnd={()=>setFinished(true)}/></div><figcaption>{ALL_OUTFITS.find(o=>o.id===selection.outfit)?.name??actionLabels[selection.action]??OFFICIAL_CLIPS.find(c=>'official-'+c.id===selection.action)?.name??'当前动作'}{finished?' · 已播完':''}</figcaption></figure></section><footer>独立预览，不读取或更改玩家存档。服装遵循原版形态规则；道具、书本和特效可以伸出身体范围。</footer></main>;
}

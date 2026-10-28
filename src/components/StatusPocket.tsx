import {useState} from 'react';
import type {GameState} from '../game';
import {StatusValues,StatusRules} from './PetStatus';
import './CarePocket.css';

export default function StatusPocket({pet,onClose,onBackpack,onWake}:{pet:GameState;onClose:()=>void;onBackpack:()=>void;onWake:()=>void}){
 const [rules,setRules]=useState(false);
 return <section className="care-pocket pocket-compact" aria-label="拉姆状态面板">
  <header className="pocket-heading"><b>状态</b><span className="pocket-heading-actions"><button className="pocket-help" aria-label="状态值变化规则" aria-pressed={rules} onClick={()=>setRules(v=>!v)}>?</button><button className="pocket-close" aria-label="关闭小窗" onClick={onClose}>×</button></span></header>
  {rules?<StatusRules/>:<StatusValues pet={pet}/>}
  <footer className="pocket-pages">{rules?<button onClick={()=>setRules(false)}>返回状态</button>:pet.sleeping&&<button onClick={onWake}>轻轻叫醒</button>}<button className="pocket-link" onClick={onBackpack}>打开背包</button></footer>
 </section>;
}

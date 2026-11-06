import {useState} from 'react';
import Ram from './Ram';
import type {Evolution,Stage} from '../game';
import './ReadingPreview.css';

const forms:[string,Stage,Evolution?][]=[['种子',0],['初级',1],['中级',2],['高级',3],['超级拉姆',4,'classic'],['神力超拉',4,'super'],['水系',4,'water'],['木系',4,'wood'],['火系',4,'fire']];
/** Isolated visual review: uses the real Ram renderer without player storage. */
export default function ReadingPreview(){
 const [size,setSize]=useState(150),[action,setAction]=useState('focus'),[run,setRun]=useState(0),[color,setColor]=useState<'blue'|'yellow'>('yellow');
 return <main className="reading-preview"><h1>原版紫色书 · 看书预览</h1><p>九种形态共用读书效果。书本图案来自原客户端，开合、翻页节奏为桌宠适配。</p>
  <nav aria-label="预览大小"><button aria-pressed={size===100} onClick={()=>setSize(100)}>桌面大小</button><button aria-pressed={size===150} onClick={()=>setSize(150)}>小屋大小</button><button onClick={()=>setColor(c=>c==='yellow'?'blue':'yellow')}>切换黄／蓝色</button></nav>
  <nav aria-label="读书动作"><button aria-pressed={action==='focus'} onClick={()=>{setAction('focus');setRun(n=>n+1)}}>专注看书 · 循环</button><button aria-pressed={action==='read-alone'} onClick={()=>{setAction('read-alone');setRun(n=>n+1)}}>翻书全程 · 18秒</button><button onClick={()=>setAction('still')}>停止预览</button></nav>
  <div className="reading-preview-grid">{forms.map(([label,stage,evolution])=><figure key={label}><div className="reading-preview-pet" style={{width:size,height:size*108/100}}><Ram color={color} stage={stage} evolution={evolution} action={action} actionId={run} sound={false} onActionEnd={()=>setAction('still')}/></div><figcaption>{label}</figcaption></figure>)}</div></main>;
}

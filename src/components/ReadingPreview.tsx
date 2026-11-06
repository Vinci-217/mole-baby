import {useState} from 'react';
import Ram from './Ram';
import type {Evolution,Stage} from '../game';
import './ReadingPreview.css';

const forms:[string,Stage,Evolution?][]=[['种子',0],['初级',1],['中级',2],['高级',3],['超级拉姆',4,'classic'],['神力超拉',4,'super'],['水系',4,'water'],['木系',4,'wood'],['火系',4,'fire']];
/** Isolated visual review: uses the real Ram renderer without player storage. */
export default function ReadingPreview(){
 const [size,setSize]=useState(150);
 return <main className="reading-preview"><h1>读书位置预览</h1><nav aria-label="预览大小"><button aria-pressed={size===100} onClick={()=>setSize(100)}>桌面大小</button><button aria-pressed={size===150} onClick={()=>setSize(150)}>小屋大小</button></nav><div className="reading-preview-grid">{forms.map(([label,stage,evolution])=><figure key={label}><div className="reading-preview-pet" style={{width:size,height:size*108/100}}><Ram color="blue" stage={stage} evolution={evolution} action="focus" sound={false}/></div><figcaption>{label}</figcaption></figure>)}</div></main>;
}

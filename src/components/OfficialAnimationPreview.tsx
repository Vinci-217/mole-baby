import {useEffect,useRef,useState} from 'react'
import Ram from './Ram'
import {ALL_OUTFITS} from '../wardrobe'
import {OFFICIAL_CLIPS,ORIGINAL_OUTFITS,supportsOfficial,officialOutfitForm} from '../official-clips'
import type {Evolution,Stage} from '../game'
import {naturalOriginalActions,originalMagicActions,playbackForm} from '../pet-original-actions'
import type {RamForm} from '../original-actions'
import './OfficialAnimationPreview.css'
const forms:[RamForm,string,Stage,Evolution?][]=[['junior','初级',1],['middle','中级',2],['senior','高级',3],['classic','经典超拉',4,'classic'],['super','超级拉姆',4,'super'],['water','水系',4,'water'],['wood','木系',4,'wood'],['fire','火系',4,'fire']]
const picks=['1200001','1200007','1200011','1200016','1200022','1200030','1200058','1200078']
function PreviewPet({clip,stage,evolution,action}:{clip:typeof OFFICIAL_CLIPS[number];stage:Stage;evolution?:Evolution;action:string}){
 const [playing,setPlaying]=useState(true),[round,setRound]=useState(0);
 useEffect(()=>{if(!playing){const timer=setTimeout(()=>{setRound(n=>n+1);setPlaying(true)},800);return()=>clearTimeout(timer)}},[playing]);
 return <Ram stage={stage} evolution={evolution} color="blue" action={clip.kind==='outfit'?action:playing?`official-${clip.id}`:'idle'} actionId={round} costume={clip.kind==='outfit'?ALL_OUTFITS.find(outfit=>outfit.clipId===clip.id||clip.path.endsWith('/'+outfit.sourceId+'.swf'))?.id:undefined} sound={false} onActionEnd={clip.kind==='outfit'?undefined:()=>setPlaying(false)}/>;
}
export default function OfficialAnimationPreview(){
 const params=new URLSearchParams(location.search),single=params.get('clip')
 const [group,setGroup]=useState(params.get('group')??'outfit'),[page,setPage]=useState(0),[form,setForm]=useState<RamForm>((params.get('form')??'junior') as RamForm),[action,setAction]=useState('idle')
 const [compare,setCompare]=useState(params.get('compare')==='1');
 const root=useRef<HTMLElement>(null),phase=useRef('')
 const spec=forms.find(row=>row[0]===form)??forms[0]
 const wardrobeClips=OFFICIAL_CLIPS.filter(clip=>clip.kind==='outfit'&&officialOutfitForm(clip,form))
 const preferred=picks.map(id=>wardrobeClips.find(clip=>clip.path.endsWith(`/${id}.swf`))).filter((row):row is typeof OFFICIAL_CLIPS[number]=>Boolean(row))
 const source=single?OFFICIAL_CLIPS.filter(clip=>clip.id===single&&playbackForm(clip,form)):group==='outfit'?[...preferred,...wardrobeClips.filter(clip=>!preferred.includes(clip))]:group==='school'?naturalOriginalActions(form).map(row=>row.clip):group==='magic'?originalMagicActions(form).map(row=>row.clip):OFFICIAL_CLIPS.filter(clip=>clip.kind===group&&supportsOfficial(clip,form))
 const pageSize=compare?1:2,clips=single?source:source.slice(page*pageSize,page*pageSize+pageSize)
 useEffect(()=>{
  let request=0;const start=performance.now();phase.current=''
  const tick=(now:number)=>{const t=(now-start)%8000,next=t<2000?'idle':t<4000?'walk-left':t<6500?'walk-right':'idle';if(next!==phase.current){phase.current=next;setAction(next)}const x=t<2000?0:t<4000?-(t-2000)/2000*22:t<6500?-22+(t-4000)/2500*44:22-(t-6500)/1500*22;root.current?.style.setProperty('--source-walk',`${group==='outfit'?x:0}px`);request=requestAnimationFrame(tick)}
  request=requestAnimationFrame(tick);return()=>cancelAnimationFrame(request)
 },[form,group,page])
 return <main className="official-animation-preview" ref={root}><header><h1>桌宠 · 原版动画预览</h1><p>本地原版素材库 {OFFICIAL_CLIPS.length} 份 · 衣橱新增 {ORIGINAL_OUTFITS.length} 件</p><nav><label>形态 <select aria-label="原版预览形态" value={form} onChange={event=>{setForm(event.target.value as RamForm);setPage(0)}}>{forms.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{[['outfit','装扮'],['care','道具互动'],['school','自然小动作'],['magic','魔法']].map(([id,name])=><button key={id} aria-pressed={id===group} onClick={()=>{setGroup(id);setPage(0)}}>{name}</button>)}<button aria-pressed={compare} onClick={()=>{setCompare(v=>!v);setPage(0)}}>对照原来大小</button><button disabled={!page} onClick={()=>setPage(page-1)}>上一组</button><button disabled={(page+1)*pageSize>=source.length} onClick={()=>setPage(page+1)}>下一组</button></nav></header>
 <p className="official-preview-note">穿戴遵循原版形态规则；脱下恢复原形。道具与魔法会自动重播。</p><section className="official-preview-grid">{compare&&<figure><div className="official-preview-pet"><Ram stage={spec[2]} evolution={spec[3]} color="blue" action="still" sound={false}/></div><figcaption>原来的样子 · 相同显示比例</figcaption></figure>}{clips.map(clip=><figure key={`${clip.id}:${form}`} data-clip={clip.id}><div className="official-preview-pet"><PreviewPet clip={clip} stage={spec[2]} evolution={spec[3]} action={action}/></div><figcaption>{clip.name}{clip.kind==='outfit'&&officialOutfitForm(clip,form)==='junior'&&form!=='junior'?' · 初级外观':''}</figcaption></figure>)}{!clips.length&&<p>暂未找到这类可播放原片。</p>}</section><footer>原 SWF 图形与时间轴，桌宠适配播放 · 此预览不读取或改写玩家存档</footer></main>
}

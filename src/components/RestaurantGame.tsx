import {useEffect,useRef,useState} from 'react';
import type {GameState,PetColor} from '../game';
import {RECIPES,INTERIORS,createRestaurant,createSession,restaurantCommand,restaurantInterior,restaurantLevel,staffLimit,dishStars,restaurantHonors,openRestaurant,closeRestaurant,advanceRestaurant,recipeById,PHASE_MS,type RestaurantCommand,type RestaurantSession,type Guest} from '../restaurant';
import layouts from '../restaurant-layouts.json';
import workerArt from '../restaurant-worker-art.json';
import levels from '../restaurant-data.json';
import Ram from './Ram';
import './RestaurantGame.css';
const ASSET='./assets/original/restaurant/';
const time=(ms:number)=>{const n=Math.ceil(ms/1000);return n>=60?`${Math.floor(n/60)}分${n%60?`${n%60}秒`:''}`:`${n}秒`};
type Point={x:number;y:number};
const HOME={x:480,y:474},DOOR={x:470,y:515};
const point=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const layoutFor=(id:number)=>(layouts as Record<string,Record<string,Point>>)[id];
const guestPoint=(g:Guest,layout:Record<string,Point>,elapsed=g.elapsed)=>{
 const seat=layout[`tablePoint${101+g.seat}`]??HOME;
 if(g.phase==='enter')return point(DOOR,seat,Math.min(1,elapsed/PHASE_MS.enter));
 if(g.phase==='leave')return point(seat,DOOR,Math.min(1,elapsed/PHASE_MS.leave));
 return seat;
};
function WorkerScene({session,interior,name,staff}:{session:RestaurantSession;interior:number;name:string;staff:number}){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({session,interior,at:performance.now()});latest.current={session,interior,at:performance.now()};
 useEffect(()=>{
  let frame=0,stopped=false;const images:Record<string,HTMLImageElement>={};
  for(const key of ['1200043-left','1200043-leftup','1200043-rightdown','1200042-rightdown']){const img=new Image();img.src=ASSET+`workers/${key}.webp`;images[key]=img;}
  for(const color of ['pink','yellow','blue','red']){const image=new Image();image.src=ASSET+`guests/${color}.webp`;images['guest-'+color]=image;}
  const paint=(now:number)=>{
   if(stopped)return;const ctx=canvas.current?.getContext('2d');if(!ctx){frame=requestAnimationFrame(paint);return;}
   ctx.clearRect(0,0,960,560);const {session:s,interior:id,at}=latest.current,layout=layoutFor(id),extra=s.open?Math.min(250,now-at):0;
   for(const g of s.guests){if(g.phase!=='eat')continue;const color=['pink','yellow','blue','red'][g.colour],image=images['guest-'+color],p=guestPoint(g,layout);if(!image.complete||!image.naturalWidth)continue;const table=layout[`table${101+g.seat}`]??p;ctx.save();ctx.translate(p.x,p.y);if(p.x>table.x)ctx.scale(-1,1);const cell=Math.floor(now/1000*24)%16;ctx.drawImage(image,cell*100,0,100,96,-50,-80,100,96);ctx.restore();}
   const occupied=new Set<number>();const actors:{worker:number;pos:Point;from:Point;to:Point;carrying:boolean;moving:boolean;dish?:number}[]=[];
   for(const g of s.guests){
    const counter=layout.movePoint51??{x:430,y:395},table=layout[`point${101+g.seat}`]??HOME,elapsed=g.elapsed+extra;
    if(g.phase==='fetch'){actors.push({worker:g.worker,pos:point(HOME,counter,Math.min(1,elapsed/PHASE_MS.fetch)),from:HOME,to:counter,carrying:false,moving:true});occupied.add(g.worker);}
    if(g.phase==='deliver'){actors.push({worker:g.worker,pos:point(counter,table,Math.min(1,elapsed/PHASE_MS.deliver)),from:counter,to:table,carrying:true,moving:true,dish:g.dish});occupied.add(g.worker);}
    if(g.phase==='eat'&&elapsed<2100&&g.worker>=0){actors.push({worker:g.worker,pos:point(table,HOME,Math.min(1,elapsed/2100)),from:table,to:HOME,carrying:false,moving:true});occupied.add(g.worker);}
   }
   const count=canvas.current?.dataset.staff?Number(canvas.current.dataset.staff):1;
   for(let worker=0;worker<count;worker++)if(!occupied.has(worker))actors.push({worker,pos:{x:HOME.x+worker*40,y:HOME.y},from:HOME,to:HOME,carrying:false,moving:false});
   for(const a of actors.sort((a,b)=>a.pos.y-b.pos.y)){
    const dx=a.to.x-a.from.x,dy=a.to.y-a.from.y;
    let key=a.carrying?'1200042-rightdown':a.moving&&dy<-15?'1200043-leftup':dx<0?'1200043-left':'1200043-rightdown';
    const image=images[key];if(!image.complete||!image.naturalWidth)continue;
    const moving=(workerArt as Record<string,{moving:number[]}>)[key].moving;
    const index=a.moving?moving[Math.floor(now/1000*24)%moving.length]:1,scale=.95;
    const flip=(a.carrying&&dx<0)||(!a.carrying&&key==='1200043-leftup'&&dx>0);
    ctx.save();ctx.translate(a.pos.x,a.pos.y);if(flip)ctx.scale(-1,1);
    ctx.drawImage(image,index*200,0,200,240,-100*scale,-200*scale,200*scale,240*scale);
    if(a.carrying&&a.dish){const key='dish-'+a.dish;let dish=images[key];if(!dish){dish=new Image();dish.src=ASSET+`dishes/${a.dish}.webp`;images[key]=dish;}if(dish.complete&&dish.naturalWidth){const width=28,height=width*dish.naturalHeight/dish.naturalWidth;ctx.drawImage(dish,-47,-39-height,width,height);}}
    ctx.restore();
    ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff9df';ctx.strokeStyle='#6f492c';ctx.lineWidth=3;const label=a.worker===0?name:`帮手 ${a.worker}`;ctx.strokeText(label,a.pos.x,a.pos.y+16);ctx.fillText(label,a.pos.x,a.pos.y+16);
   }
   frame=requestAnimationFrame(paint);
  };frame=requestAnimationFrame(paint);return()=>{stopped=true;cancelAnimationFrame(frame)};
 },[name]);
 return <canvas className="restaurant-worker-canvas" width={960} height={560} ref={canvas} data-staff={staff} aria-label="拉姆取餐、端盘送餐、空手返回"/>;
}
export default function RestaurantGame({pet,getPet,onChange,onClose,sound,volume,onToggleSound}:{pet:GameState;getPet:()=>GameState;onChange:(pet:GameState)=>void;onClose:()=>void;sound:boolean;volume:number;onToggleSound:()=>void}){
 const [online,setOnline]=useState(()=>navigator.onLine!==false);
 const [session,setSession]=useState(()=>createSession()),sessionRef=useRef(session);sessionRef.current=session;
 const [tab,setTab]=useState<'menu'|'counters'|'staff'|'decor'|'ledger'>('menu'),[query,setQuery]=useState(''),[all,setAll]=useState(false),[stove,setStove]=useState(0),[message,setMessage]=useState(''),[help,setHelp]=useState(false);
 const root=useRef<HTMLElement>(null),audio=useRef(new Map<string,HTMLAudioElement>()),soundRef=useRef({sound,volume});soundRef.current={sound,volume};
 const r=pet.restaurant??createRestaurant(),interior=restaurantInterior(r),level=restaurantLevel(r.xp),layout=layoutFor(r.interior);
 const sync=(next:RestaurantSession)=>{sessionRef.current=next;setSession(next)};
 function effect(name:string){
  if(!soundRef.current.sound||document.hidden)return;
  let a=audio.current.get(name);if(!a){a=new Audio(ASSET+`audio/${name}.mp3`);audio.current.set(name,a);}a.volume=soundRef.current.volume;a.currentTime=0;void a.play().catch(()=>{});
 }
 function stop(notice?:string){const before=getPet(),next=closeRestaurant(before,sessionRef.current,notice);if(next.state!==before)onChange(next.state);sync(next.session);}
 function leave(){stop();onClose();}
 function command(c:RestaurantCommand){
  if(c.kind==='interior'&&sessionRef.current.open){setMessage('先打烊，再更换餐厅内饰。');return;}
  const result=restaurantCommand(getPet(),c);if(result.ok){onChange(result.state);effect(c.kind==='cook'?'downPot':c.kind==='collect'?'downFood':'foodGo');if(c.kind==='cook'){const first=result.state.restaurant!.stoves.findIndex(s=>!s);if(first>=0)setStove(first);}}
  setMessage(result.message);
 }
 useEffect(()=>{
  root.current?.focus();let last=performance.now(),nativeVisible=true;
  const tick=window.setInterval(()=>{
   const now=performance.now(),dt=now-last;last=now;if(!sessionRef.current.open)return;
   if(navigator.onLine===false){stop('网络已断开，已自动打烊；没有离线收益。');return;}
   if(document.hidden||!nativeVisible){stop('程序进入后台，已自动打烊；回来后可以重新营业。');return;}
   const before=getPet().restaurant,next=advanceRestaurant(getPet(),sessionRef.current,dt);
   if((next.state.restaurant?.served??0)>(before?.served??0))effect('foodSuccess');
   if(next.state.restaurant?.stoves.some((s,i)=>s?.state==='ready'&&before?.stoves[i]?.state==='cooking'))effect('foodOk');
   onChange(next.state);sync(next.session);
  },250);
  const pause=()=>{if(document.hidden)stop('程序进入后台，已自动打烊；没有离线收益。')};
  const unsubscribe=window.desktop?.onStateChanged(state=>{nativeVisible=state.windowVisible!==false&&!state.petMode;if(!nativeVisible)stop('程序进入后台，已自动打烊；没有离线收益。')});
  const disconnected=()=>{setOnline(false);stop('网络已断开，已自动打烊；没有离线收益。')};
  const connected=()=>setOnline(true);
  window.addEventListener('offline',disconnected);window.addEventListener('online',connected);
  const shutdown=()=>stop('已打烊，未完成的订单已退回。');
  document.addEventListener('visibilitychange',pause);window.addEventListener('pagehide',shutdown);window.addEventListener('beforeunload',shutdown);
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();leave();}if(e.key==='Tab'){const buttons=root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);
  return()=>{window.removeEventListener('offline',disconnected);window.removeEventListener('online',connected);unsubscribe?.();clearInterval(tick);document.removeEventListener('visibilitychange',pause);window.removeEventListener('pagehide',shutdown);window.removeEventListener('beforeunload',shutdown);document.removeEventListener('keydown',key);shutdown();for(const a of audio.current.values())a.pause();};
 },[]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),4500);return()=>clearTimeout(timer)},[message]);
 useEffect(()=>{if(!sound)for(const a of audio.current.values())a.pause();},[sound]);
 const dishes=RECIPES.filter(recipe=>(all||recipe.level<=level)&&recipe.name.includes(query)).sort((a,b)=>a.level-b.level||a.id-b.id);
 const stock=Object.entries(r.stock).filter(([,n])=>n>0);
 const staffNote=session.open?'服务员正在接待客人':'休息中，营业时自动送餐';
 return <div className="restaurant-overlay"><section className="restaurant-app" role="dialog" aria-modal="true" aria-label="拉姆餐厅" tabIndex={-1} ref={root}>
  <header className="restaurant-header"><div className="restaurant-brand"><img src={ASSET+'icons/1340045.webp'} alt=""/><div><h1>拉姆餐厅</h1><span>{pet.name}的小小餐厅</span></div></div><div className="restaurant-level"><b>Lv.{level}</b><span>{level===60?'满级餐厅':`${r.xp} / ${levels.levels[level]} 经验`}</span><progress value={r.xp-(levels.levels[level-1]??0)} max={(levels.levels[level]??r.xp+1)-(levels.levels[level-1]??0)}/></div><strong className="restaurant-wallet" aria-label={`钱包 ${pet.coins} 摩尔豆`}>{pet.coins.toLocaleString()}<small>摩尔豆</small></strong><button className="restaurant-close" onClick={leave} aria-label="离开餐厅">×</button></header>
  <div className="restaurant-toolbar"><span className={`restaurant-open-badge ${session.open?'is-open':''}`}>{session.open?'正在营业':'已打烊'}</span><span>好评 {r.favor}%</span><span>本次接待 {session.served} 位 · 收入 {session.earned} 豆</span><div className="restaurant-toolbar-buttons"><button onClick={onToggleSound} aria-pressed={sound} aria-label="餐厅音效">{sound?'♫ 音效开':'♫ 音效关'}</button><button aria-expanded={help} onClick={()=>setHelp(v=>!v)}>玩法</button><button className="restaurant-primary" disabled={!online&&!session.open} title={!online?'联网后可以开始营业':undefined} onClick={()=>{if(navigator.onLine===false){setMessage('联网后可以开始营业。');return;}if(session.open)stop();else{const result=openRestaurant(getPet(),sessionRef.current);sync(result.session);setMessage(result.ok?'营业开始啦！先选菜备料，做好后点击灶台上菜。':result.session.notice);if(result.ok)effect('foodGo');}}}>{session.open?'打烊休息':'开始营业'}</button></div></div>
  {help&&<div className="restaurant-help"><strong>备菜 → 烹饪 → 上餐台 → 拉姆送餐 → 顾客付款</strong><p>所有菜都用摩尔豆备料；等级提高后解锁更多菜谱和内饰。烹饪只计算营业时间，本地时长为原时长的 1/60，限制在 10 秒至 4 分钟。做好后请及时上菜，放久会烧糊。退出餐厅、断网、程序关闭或进入后台会打烊，未完成订单退菜，重开不会补算收益。</p><p>菜品、场景、制服动作和餐厅音效使用原客户端素材；经营节奏、豆价、帮手和荣誉条件为桌宠适配。</p></div>}
  <div className="restaurant-body"><main className="restaurant-floor"><div className="restaurant-scene" aria-label="餐厅营业场景">
   <img className="restaurant-background" src={ASSET+`rooms/${r.interior}.webp`} alt={interior.name}/>
   {session.guests.map(g=>{const pos=guestPoint(g,layout);return <div className={`restaurant-guest phase-${g.phase}`} key={g.id} style={{left:`${pos.x/9.6}%`,top:`${pos.y/5.6}%`}}>{g.phase!=='eat'&&<Ram color={(['pink','yellow','blue','red'] as PetColor[])[g.colour]} stage={1} action={g.phase==='enter'?'walk-left':g.phase==='leave'?'walk-right':'idle'} sound={false}/>}{g.phase==='wait'&&<span className="restaurant-guest-thought">等一份好吃的<progress max={30000} value={30000-g.wait}/></span>}{g.phase==='eat'&&<span className="restaurant-guest-thought eating">bibo～ 好吃！</span>}</div>})}
   {stock.map(([id],index)=>{const p=layout[`foodTable${51+index}`]??HOME;return <img key={id} className="restaurant-scene-dish" src={ASSET+`dishes/${id}.webp`} alt="" style={{left:`${(p.x-27)/9.6}%`,top:`${(p.y-40)/5.6}%`}}/>})}
   {session.guests.filter(g=>g.phase==='eat').map(g=>{const p=layout[`table${101+g.seat}`]??HOME;return <img key={g.id} className="restaurant-scene-dish" src={ASSET+`dishes/${g.dish}.webp`} alt="" style={{left:`${p.x/9.6}%`,top:`${(p.y-26)/5.6}%`}}/>})}
   <div className="restaurant-worker-host" ref={node=>{node?.querySelector('canvas')?.setAttribute('data-staff',String(r.staff))}}><WorkerScene session={session} interior={r.interior} name={pet.name} staff={r.staff}/></div>
   {!session.open&&<div className="restaurant-welcome"><b>让香气飘起来吧</b><span>先选菜备料，再开始营业</span></div>}
  </div>
  <div className="restaurant-stoves" aria-label="灶台">{Array.from({length:interior.stoves},(_,i)=>{const s=r.stoves[i],recipe=s&&recipeById(s.dish);return <button key={i} className={`restaurant-stove ${stove===i?'selected':''} ${s?.state??'empty'}`} aria-label={`灶台 ${i+1}${s?' '+recipe!.name+' '+(s.state==='ready'?'已做好':s.state==='burnt'?'已烧糊':'烹饪中'):' 空闲'}`} aria-pressed={stove===i} onClick={()=>{setStove(i);if(s?.state==='ready')command({kind:'collect',stove:i});else if(s?.state==='burnt')command({kind:'discard',stove:i});else setTab('menu');}}><span className="restaurant-stove-number">{i+1}</span>{recipe?<><img src={ASSET+`icons/${recipe.id}.webp`} alt=""/><strong>{recipe.name}</strong><span>{s!.state==='cooking'?`${session.open?'还需':'待营业'} ${time(s!.remaining)}`:s!.state==='ready'?'做好了 · 点击上菜':'烧糊了 · 点击清理'}</span><progress value={s!.state==='cooking'?recipe.cookMs-s!.remaining:s!.state==='ready'?s!.fresh:0} max={s!.state==='ready'?recipe.freshMs:recipe.cookMs}/></>:<><span className="restaurant-empty-pot">♨</span><strong>空灶台</strong><span>选择后从菜谱备菜</span></>}</button>})}</div>
  <p className="restaurant-status" role="status">{message||session.notice}</p><p className="restaurant-online-note">仅在线营业 · 进度自动保存 · 退出 / 断网 / 后台自动打烊</p>
  </main><aside className="restaurant-management"><nav className="restaurant-tabs" aria-label="餐厅管理">{([['menu','菜谱'],['counters','餐台'],['staff','员工'],['decor','装修'],['ledger','账本']] as const).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setMessage('')}}>{label}</button>)}</nav>
   <div className="restaurant-management-content">
   {tab==='menu'&&<><div className="restaurant-menu-heading"><h2>今天做点什么？</h2><span>灶台 {stove+1} · 共 72 道原版菜</span></div><div className="restaurant-menu-filter"><input aria-label="搜索菜谱" placeholder="找一道拿手菜…" value={query} onChange={e=>setQuery(e.target.value)}/><label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>显示未解锁</label></div><div className="restaurant-recipe-list">{dishes.map(recipe=>{const locked=recipe.level>level;return <article key={recipe.id} className={`restaurant-recipe ${locked?'locked':''}`}><img loading="lazy" src={ASSET+`icons/${recipe.id}.webp`} alt={recipe.name}/><div><h3>{recipe.name}{dishStars(r,recipe.id)>0&&<small>{'★'.repeat(dishStars(r,recipe.id))}</small>}</h3><p>{time(recipe.cookMs)} · {recipe.servings} 份 · 每份 {recipe.sell} 豆</p><span>{locked?`Lv.${recipe.level} 解锁`:`已制作 ${r.mastery[recipe.id]??0} 批`}</span></div><button disabled={locked||pet.coins<recipe.cost||Boolean(r.stoves[stove])} aria-label={`备菜 ${recipe.name} ${recipe.cost} 摩尔豆`} onClick={()=>command({kind:'cook',dish:recipe.id,stove})}>{locked?'未解锁':<>{recipe.cost}<small>豆备菜</small></>}</button></article>})}{!dishes.length&&<p className="restaurant-empty">没找到这道菜，换个名字试试。</p>}</div></>}
   {tab==='counters'&&<><h2>供应餐台 <small>{stock.length}/{interior.counters}</small></h2><p>相同菜品会合并；卖完后空出位置。做好后点击灶台即可上菜。</p>{!stock.length&&<p className="restaurant-empty">还没有供应中的菜，先去菜谱选一道吧。</p>}{stock.map(([id,count])=>{const recipe=recipeById(Number(id))!;return <article className="restaurant-counter-card" key={id}><img src={ASSET+`dishes/${id}.webp`} alt=""/><div><h3>{recipe.name}</h3><b>{count} 份</b><p>每份 {recipe.sell} 摩尔豆</p></div></article>})}<h3>灶台管理</h3>{r.stoves.map((s,i)=>s&&<div className="restaurant-clean-row" key={i}><span>{i+1} 号 · {recipeById(s.dish)!.name}</span><button onClick={()=>command({kind:'discard',stove:i})}>放弃并清理</button></div>)}</>}
   {tab==='staff'&&<><h2>餐厅小服务员</h2><p>{staffNote}。每位服务员一次接一单，先取餐，再端盘送餐，空手返回。</p><div className="restaurant-staff-card"><span className="restaurant-staff-portrait" style={{backgroundImage:`url(${ASSET}workers/1200043-rightdown.webp)`}} aria-hidden="true"/><div><h3>{pet.name}</h3><p>店长的拉姆 · 免费上岗</p><b>{session.open?'工作中':'已休息'}</b></div></div>{Array.from({length:r.staff-1},(_,i)=><div className="restaurant-staff-row" key={i}><span>拉姆帮手 {i+1}</span><b>{session.open?'接待中':'休息中'}</b></div>)}<button className="restaurant-primary restaurant-hire" disabled={r.staff>=staffLimit(r.xp)||pet.coins<r.staff*250} onClick={()=>command({kind:'hire'})}>招募帮手 · {r.staff*250} 豆</button><p>当前 {r.staff}/{staffLimit(r.xp)} 位；达到 9、19、40 级会扩充员工名额。招募为一次付费，没有离线工资。</p></>}
   {tab==='decor'&&<><h2>换一套餐厅内饰</h2><p>原版固定桌椅布局；新内饰增加灶台、餐台与座位。打烊且灶台清空后可更换。</p><div className="restaurant-interiors">{INTERIORS.map(room=><article key={room.id}><img loading="lazy" src={ASSET+`rooms/${room.id}.webp`} alt={room.name}/><div><h3>{room.name}</h3><p>{room.tables} 桌 · {room.stoves} 灶 · {room.counters} 餐台</p><button disabled={room.id===r.interior||session.open||!r.owned.includes(room.id)&&(level<room.level||pet.coins<room.cost)} onClick={()=>command({kind:'interior',id:room.id})}>{room.id===r.interior?'使用中':r.owned.includes(room.id)?'换上':level<room.level?`Lv.${room.level} 解锁`:`${room.cost} 豆购买`}</button></div></article>)}</div></>}
   {tab==='ledger'&&<><h2>小店经营账本</h2><dl className="restaurant-ledger"><div><dt>累计营业额</dt><dd>{r.revenue} 豆</dd></div><div><dt>备菜 / 招募 / 装修</dt><dd>{r.spent} 豆</dd></div><div><dt>累计净收益</dt><dd>{r.revenue-r.spent} 豆</dd></div><div><dt>招待客人</dt><dd>{r.served} 位</dd></div><div><dt>等待后离开</dt><dd>{r.lost} 位</dd></div><div><dt>解锁菜谱</dt><dd>{RECIPES.filter(recipe=>recipe.level<=level).length} / 72 道</dd></div></dl><p>收入已直接存入小屋的钱包，净收益仅作统计。没有第二次领取，也没有离线收益。</p><h3>小店荣誉</h3>{restaurantHonors(r).map(h=><div key={h.name} className={`restaurant-honor ${h.done?'earned':''}`}><b>{h.done?'★':'☆'} {h.name}</b><span>{h.done?'已获得':h.progress}</span></div>)}</>}
   </div>
  </aside></div>
 </section></div>;
}

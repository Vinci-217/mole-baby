import {NativeStove,NativeCounter,NativeMenu,NativeHud,NativeSprite,nativeLayout,nativeRectStyle} from './RestaurantClassic';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {GameState,PetColor} from '../game';
import {RECIPES,INTERIORS,createRestaurant,createSession,restaurantCommand,restaurantInterior,restaurantLevel,staffLimit,restaurantHonors,openRestaurant,closeRestaurant,advanceRestaurant,recipeById,PHASE_MS,type RestaurantCommand,type RestaurantSession,type Guest} from '../restaurant';
import layouts from '../restaurant-layouts.json';
import workerArt from '../restaurant-worker-art.json';
import Ram from './Ram';
import './RestaurantGame.css';
const ASSET='./assets/original/restaurant/';
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
 const [tab,setTab]=useState<'menu'|'counters'|'staff'|'decor'|'ledger'|null>(null),[stove,setStove]=useState(0),[message,setMessage]=useState(''),[help,setHelp]=useState(false),[discard,setDiscard]=useState<number|null>(null);
 const popups=useRef({help,discard});popups.current={help,discard};
 const root=useRef<HTMLElement>(null),scene=useRef<HTMLDivElement>(null),tabRef=useRef(tab),audio=useRef(new Map<string,HTMLAudioElement>()),soundRef=useRef({sound,volume});soundRef.current={sound,volume};
 const r=pet.restaurant??createRestaurant(),interior=restaurantInterior(r),level=restaurantLevel(r.xp),layout=layoutFor(r.interior);
 tabRef.current=tab;
 useLayoutEffect(()=>{const element=scene.current;if(!element)return;const observer=new ResizeObserver(()=>element.style.setProperty('--native-scale',String(element.clientWidth/960)));observer.observe(element);return()=>observer.disconnect()},[]);
 const sync=(next:RestaurantSession)=>{sessionRef.current=next;setSession(next)};
 function effect(name:string){
  if(!soundRef.current.sound||document.hidden)return;
  let a=audio.current.get(name);if(!a){a=new Audio(ASSET+`audio/${name}.mp3`);audio.current.set(name,a);}a.volume=soundRef.current.volume;a.currentTime=0;void a.play().catch(()=>{});
 }
 function stop(notice?:string){const before=getPet(),next=closeRestaurant(before,sessionRef.current,notice);if(next.state!==before)onChange(next.state);sync(next.session);}
 function leave(){stop();onClose();}
 function command(c:RestaurantCommand,confirmed=false){
  if(c.kind==='discard'&&!confirmed){setDiscard(c.stove);return;}
  if(c.kind==='interior'&&sessionRef.current.open){setMessage('先打烊，再更换餐厅内饰。');return;}
  const result=restaurantCommand(getPet(),c);if(result.ok){onChange(result.state);if(c.kind!=='cook'&&c.kind!=='prepare')effect('foodGo');if(c.kind==='cook')setTab(null);}
  setMessage(result.message);
 }
 useEffect(()=>{
  root.current?.focus();let last=performance.now(),nativeVisible=true;
  const tick=window.setInterval(()=>{
   const now=performance.now(),dt=now-last;last=now;
   if(navigator.onLine===false){stop('网络已断开，已自动打烊；没有离线收益。');return;}
   if(document.hidden||!nativeVisible){stop('程序进入后台，已自动打烊；回来后可以重新营业。');return;}
   const saved=getPet(),before=saved.restaurant,next=advanceRestaurant(saved,sessionRef.current,dt);
   for(const [i,s]of(next.state.restaurant?.stoves??[]).entries()){if(s&&!s.prep&&before?.stoves[i]?.prep)effect(s.state==='pot'?'downPot':s.state==='ingredients'?'downFood':'foodOk');if(s?.state==='ready'&&before?.stoves[i]?.state==='cooking')effect('foodSuccess');}
   if(next.state!==saved)onChange(next.state);if(next.session!==sessionRef.current)sync(next.session);
  },250);
  const pause=()=>{if(document.hidden)stop('程序进入后台，已自动打烊；没有离线收益。')};
  const unsubscribe=window.desktop?.onStateChanged(state=>{nativeVisible=state.windowVisible!==false&&!state.petMode;if(!nativeVisible)stop('程序进入后台，已自动打烊；没有离线收益。')});
  const disconnected=()=>{setOnline(false);stop('网络已断开，已自动打烊；没有离线收益。')};
  const connected=()=>setOnline(true);
  window.addEventListener('offline',disconnected);window.addEventListener('online',connected);
  const shutdown=()=>stop('已打烊，未完成的订单已退回。');
  document.addEventListener('visibilitychange',pause);window.addEventListener('pagehide',shutdown);window.addEventListener('beforeunload',shutdown);
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();if(popups.current.discard!==null){setDiscard(null);return;}if(popups.current.help){setHelp(false);return;}if(tabRef.current!==null){setTab(null);return;}leave();}if(e.key==='Tab'){const buttons=root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);
  return()=>{window.removeEventListener('offline',disconnected);window.removeEventListener('online',connected);unsubscribe?.();clearInterval(tick);document.removeEventListener('visibilitychange',pause);window.removeEventListener('pagehide',shutdown);window.removeEventListener('beforeunload',shutdown);document.removeEventListener('keydown',key);shutdown();for(const a of audio.current.values())a.pause();};
 },[]);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),4500);return()=>clearTimeout(timer)},[message]);
 useEffect(()=>{if(!sound)for(const a of audio.current.values())a.pause();},[sound]);
 const stock=Object.entries(r.stock).filter(([,n])=>n>0);
 const staffNote=session.open?'服务员正在接待客人':'休息中，营业时自动送餐';
 function toggleBusiness(){
  if(navigator.onLine===false){setMessage('联网后可以开始营业。');return;}
  if(session.open)stop();else{const result=openRestaurant(getPet(),sessionRef.current);sync(result.session);setMessage(result.session.notice);if(result.ok)effect('foodGo');}
 }
 const native=nativeLayout(r.interior),sign=native.joinMc;
 return <div className="restaurant-overlay"><section className="restaurant-app original-restaurant-app" role="dialog" aria-modal="true" aria-label="拉姆餐厅" tabIndex={-1} ref={root}>
  <div className="native-mobile-hint">原版比例画面 · 可以左右滑动查看，点击炉灶开始做菜。</div>
  <div className="restaurant-body"><main className="restaurant-floor"><div className="restaurant-native-viewport"><div ref={scene} className="restaurant-scene" aria-label="餐厅营业场景">
   <NativeSprite asset={`rooms/${r.interior}`}/>
   <span className="native-restaurant-name" style={native.myNameMc.text?{...nativeRectStyle(native.myNameMc.text),fontSize:`calc(${native.myNameMc.text.font}px * var(--native-scale))`}:undefined}>{pet.name}餐厅</span>
   <button className="native-hit native-open-sign" style={nativeRectStyle({x:sign.x+sign.rect.x,y:sign.y+sign.rect.y,w:sign.rect.w,h:sign.rect.h})} aria-label={session.open?'打烊休息':'开始营业'} disabled={!online&&!session.open} onClick={toggleBusiness}><img src={`./assets/original/restaurant/classic/signs/${r.interior}/${session.open?0:1}.webp`} alt=""/></button>
   {Array.from({length:interior.stoves},(_,i)=><NativeStove key={i} index={i} stove={r.stoves[i]} room={r.interior} onSelect={()=>{setStove(i);setTab('menu')}} onCommand={command}/>)}
   {stock.map(([id],index)=><NativeCounter key={id} room={r.interior} index={index} dish={Number(id)} onClick={()=>setTab('counters')}/>)}
   {session.guests.map(g=>{const pos=guestPoint(g,layout);return <div className={`restaurant-guest phase-${g.phase}`} key={g.id} style={{left:`${pos.x/9.6}%`,top:`${pos.y/5.6}%`}}>{g.phase!=='eat'&&<Ram color={(['pink','yellow','blue','red'] as PetColor[])[g.colour]} stage={1} action={g.phase==='enter'?'walk-left':g.phase==='leave'?'walk-right':'idle'} sound={false}/>}{g.phase==='wait'&&<span className="restaurant-guest-thought">等一份好吃的<progress max={30000} value={30000-g.wait}/></span>}{g.phase==='eat'&&<span className="restaurant-guest-thought eating">bibo～ 好吃！</span>}</div>})}
   {session.guests.filter(g=>g.phase==='eat').map(g=>{const p=layout[`table${101+g.seat}`]??HOME;return <img key={g.id} className="restaurant-scene-dish" src={ASSET+`dishes/${g.dish}.webp`} alt="" style={{left:`${p.x/9.6}%`,top:`${(p.y-26)/5.6}%`}}/>})}
   <div className="restaurant-worker-host" ref={node=>{node?.querySelector('canvas')?.setAttribute('data-staff',String(r.staff))}}><WorkerScene session={session} interior={r.interior} name={pet.name} staff={r.staff}/></div>
   {discard!==null&&<div className="native-management-shade"><section className="native-confirm" role="alertdialog" aria-label="确认清理或捐赠"><p>{r.stoves[discard]?.state==='burnt'?'你确定要花费100摩尔豆将烧糊的菜处理掉吗？':'你愿意支付100摩尔豆包装费，将菜捐给流浪的拉姆吗？'}</p><button onClick={()=>{command({kind:'discard',stove:discard},true);setDiscard(null)}}>确定</button><button onClick={()=>setDiscard(null)}>取消</button></section></div>}
   <NativeHud coins={pet.coins} level={level} favor={r.favor} onMenu={()=>{const empty=r.stoves.findIndex(s=>!s);setStove(empty>=0?empty:0);setTab('menu')}} onStaff={()=>setTab('staff')} onHelp={()=>setHelp(v=>!v)} onLedger={()=>setTab('ledger')} onClose={leave}/>
   {tab==='menu'&&<NativeMenu restaurant={r} coins={pet.coins} stove={stove} onChoose={dish=>command({kind:'cook',dish,stove})} onClose={()=>setTab(null)}/>}
   {help&&<div className="restaurant-help"><button aria-label="关闭玩法说明" onClick={()=>setHelp(false)}>×</button><strong>点击炉灶 → 选菜 → 放入食材 → 开始制作 → 端到餐台</strong><p>点击场景里的炉灶选择菜谱，按提示继续点击放入食材、开始制作。菜品使用原配置烹饪时间，做好后点击炉灶端菜。右侧菜谱本翻页查看菜品；扳手打开员工与装修，金币处查看账本。</p><p>所有菜品用摩尔豆获取。退出、断网或后台自动打烊，不补算离线收益。</p></div>}
   {tab!==null&&tab!=='menu'&&<div className="native-management-shade"><aside className="restaurant-management"><header className="native-management-heading"><strong>{({counters:'供应餐台',staff:'员工管理',decor:'餐厅装修',ledger:'经营账本'})[tab]}</strong><button aria-label="关闭餐厅管理" onClick={()=>setTab(null)}>×</button></header><nav className="restaurant-tabs" aria-label="餐厅管理">{([['counters','餐台'],['staff','员工'],['decor','装修'],['ledger','账本']] as const).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</nav>
   <div className="restaurant-management-content">
   {tab==='counters'&&<><h2>供应餐台 <small>{stock.length}/{interior.counters}</small></h2><p>相同菜品会合并；卖完后空出位置。做好后点击灶台即可上菜。</p>{!stock.length&&<p className="restaurant-empty">还没有供应中的菜，先去菜谱选一道吧。</p>}{stock.map(([id,count])=>{const recipe=recipeById(Number(id))!;return <article className="restaurant-counter-card" key={id}><img src={ASSET+`dishes/${id}.webp`} alt=""/><div><h3>{recipe.name}</h3><b>{count} 份</b><p>每份 {recipe.sell} 摩尔豆</p></div></article>})}<h3>灶台管理</h3>{r.stoves.map((s,i)=>s&&<div className="restaurant-clean-row" key={i}><span>{i+1} 号 · {recipeById(s.dish)!.name}</span><button onClick={()=>command({kind:'discard',stove:i})}>放弃并清理</button></div>)}</>}
   {tab==='staff'&&<><h2>餐厅小服务员</h2><p>{staffNote}。每位服务员一次接一单，先取餐，再端盘送餐，空手返回。</p><div className="restaurant-staff-card"><span className="restaurant-staff-portrait" style={{backgroundImage:`url(${ASSET}workers/1200043-rightdown.webp)`}} aria-hidden="true"/><div><h3>{pet.name}</h3><p>店长的拉姆 · 免费上岗</p><b>{session.open?'工作中':'已休息'}</b></div></div>{Array.from({length:r.staff-1},(_,i)=><div className="restaurant-staff-row" key={i}><span>拉姆帮手 {i+1}</span><b>{session.open?'接待中':'休息中'}</b></div>)}<button className="restaurant-primary restaurant-hire" disabled={r.staff>=staffLimit(r.xp)||pet.coins<r.staff*250} onClick={()=>command({kind:'hire'})}>招募帮手 · {r.staff*250} 豆</button><p>当前 {r.staff}/{staffLimit(r.xp)} 位；达到 9、19、40 级会扩充员工名额。招募为一次付费，没有离线工资。</p></>}
   {tab==='decor'&&<><h2>换一套餐厅内饰</h2><p>原版固定桌椅布局；新内饰增加灶台、餐台与座位。打烊且灶台清空后可更换。</p><div className="restaurant-interiors">{INTERIORS.map(room=><article key={room.id}><img loading="lazy" src={ASSET+`rooms/${room.id}.webp`} alt={room.name}/><div><h3>{room.name}</h3><p>{room.tables} 桌 · {room.stoves} 灶 · {room.counters} 餐台</p><button disabled={room.id===r.interior||session.open||!r.owned.includes(room.id)&&(level<room.level||pet.coins<room.cost)} onClick={()=>command({kind:'interior',id:room.id})}>{room.id===r.interior?'使用中':r.owned.includes(room.id)?'换上':level<room.level?`Lv.${room.level} 解锁`:`${room.cost} 豆购买`}</button></div></article>)}</div></>}
   {tab==='ledger'&&<><h2>小店经营账本</h2><dl className="restaurant-ledger"><div><dt>累计营业额</dt><dd>{r.revenue} 豆</dd></div><div><dt>备菜 / 招募 / 装修</dt><dd>{r.spent} 豆</dd></div><div><dt>累计净收益</dt><dd>{r.revenue-r.spent} 豆</dd></div><div><dt>招待客人</dt><dd>{r.served} 位</dd></div><div><dt>等待后离开</dt><dd>{r.lost} 位</dd></div><div><dt>解锁菜谱</dt><dd>{RECIPES.filter(recipe=>recipe.level<=level).length} / 72 道</dd></div></dl><p>收入已直接存入小屋的钱包，净收益仅作统计。没有第二次领取，也没有离线收益。</p><h3>小店荣誉</h3>{restaurantHonors(r).map(h=><div key={h.name} className={`restaurant-honor ${h.done?'earned':''}`}><b>{h.done?'★':'☆'} {h.name}</b><span>{h.done?'已获得':h.progress}</span></div>)}</>}
   </div>
  </aside></div>}
  </div></div><p className="restaurant-status" role="status">{message||session.notice}</p><div className="native-aux-controls"><span>{session.open?'营业中':'已打烊'} · 本次 {session.served} 位客人 / {session.earned} 豆 · 退出、断网或后台自动打烊</span><button onClick={onToggleSound} aria-label="餐厅音效" aria-pressed={sound}>{sound?'音效开':'音效关'}</button></div></main></div>
 </section></div>;
}

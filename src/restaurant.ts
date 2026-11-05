import data from './restaurant-data.json';
import type {GameState} from './game';
import {getStage} from './game';
export const RECIPES=data.recipes, INTERIORS=data.interiors;
export type Recipe=typeof RECIPES[number];
export const recipeById=(id:number)=>RECIPES.find(r=>r.id===id);
export const restaurantLevel=(xp:number)=>Math.max(1,data.levels.reduce((level,n,i)=>xp>=n?i+1:level,1));
export const staffLimit=(xp:number)=>data.staffLimits[restaurantLevel(xp)-1];
export const restaurantInterior=(r:RestaurantState)=>INTERIORS.find(i=>i.id===r.interior)!;
export const dishStars=(r:RestaurantState,id:number)=>recipeById(id)!.stars.filter(n=>(r.mastery[id]??0)>=n).length;
export interface Stove {dish:number;remaining:number;fresh:number;state:'cooking'|'ready'|'burnt'}
export interface RestaurantState {
 version:1;xp:number;favor:number;revenue:number;spent:number;served:number;lost:number;
 interior:number;owned:number[];staff:number;stock:Record<number,number>;reserved?:Record<number,number>;mastery:Record<number,number>;stoves:(Stove|null)[];
}
export const createRestaurant=():RestaurantState=>({version:1,xp:0,favor:50,revenue:0,spent:0,served:0,lost:0,interior:1330004,owned:[1330004],staff:1,stock:{},mastery:{},stoves:[]});
const int=(x:unknown,max=1e9):x is number=>Number.isSafeInteger(x)&&Number(x)>=0&&Number(x)<=max;
/** Session, guests and clocks are intentionally never restored; only earned progress survives. */
export function normalizeRestaurant(raw:unknown):RestaurantState|undefined {
 if(!raw||typeof raw!=='object'||(raw as RestaurantState).version!==1)return;
 const v=raw as RestaurantState,r=createRestaurant();
 for(const key of ['xp','revenue','spent','served','lost'] as const)if(int(v[key]))r[key]=v[key];
 if(int(v.favor,100))r.favor=v.favor;
 r.owned=INTERIORS.filter(i=>Array.isArray(v.owned)&&v.owned.includes(i.id)).map(i=>i.id);if(!r.owned.includes(1330004))r.owned.unshift(1330004);
 r.interior=r.owned.includes(v.interior)?v.interior:1330004;
 if(int(v.staff,staffLimit(r.xp))&&v.staff>=1)r.staff=v.staff;
 for(const recipe of RECIPES){
  const stock=int(v.stock?.[recipe.id],1e6)?v.stock[recipe.id]:0,reserved=int(v.reserved?.[recipe.id],100)?v.reserved![recipe.id]:0;
  if(stock+reserved>0)r.stock[recipe.id]=Math.min(1e6,stock+reserved);
  if(int(v.mastery?.[recipe.id],1e6)&&v.mastery[recipe.id]>0)r.mastery[recipe.id]=v.mastery[recipe.id];
 }
 // Keep batches from a previously larger interior. Switching requires idle stoves.
 r.stoves=Array.from({length:restaurantInterior(r).stoves},(_,i)=>{
  const s=Array.isArray(v.stoves)?v.stoves[i]:null,recipe=s&&recipeById(s.dish);
  return s&&recipe&&['cooking','ready','burnt'].includes(s.state)&&int(s.remaining,recipe.cookMs)&&int(s.fresh,recipe.freshMs)?{dish:s.dish,remaining:s.remaining,fresh:s.fresh,state:s.state}:null;
 });
 // Valid supplies survive even if a future version changes counter capacity.
 return r;
}
export type RestaurantCommand={kind:'cook';dish:number;stove:number}|{kind:'collect'|'discard';stove:number}|{kind:'hire'}|{kind:'interior';id:number};
export function restaurantCommand(pet:GameState,command:RestaurantCommand):{state:GameState;ok:boolean;message:string}{
 const r=pet.restaurant??createRestaurant(),interior=restaurantInterior(r);
 const fail=(message:string)=>({state:pet,ok:false,message});
 let next:RestaurantState={...r,stoves:Array.from({length:interior.stoves},(_,i)=>r.stoves[i]??null),stock:{...r.stock},mastery:{...r.mastery}},coins=pet.coins,message='';
 if(command.kind==='cook'){
  const recipe=recipeById(command.dish);if(!recipe||!int(command.stove,interior.stoves-1))return fail('请选择菜品和空灶台。');
  if(restaurantLevel(r.xp)<recipe.level)return fail(`餐厅 ${recipe.level} 级解锁这道菜。`);
  if(next.stoves[command.stove])return fail('这个灶台还在使用中。');
  if(coins<recipe.cost)return fail('摩尔豆不够，先用现有菜品营业或回小屋签到。');
  if((r.stock[recipe.id]??0)+recipe.servings>1e6)return fail('这道菜的存量已满，先营业卖一些吧。');
  coins-=recipe.cost;next.spent=Math.min(1e9,next.spent+recipe.cost);next.stoves[command.stove]={dish:recipe.id,state:'cooking',remaining:recipe.cookMs,fresh:recipe.freshMs};message=`${recipe.name}已备料，花费 ${recipe.cost} 摩尔豆。`;
 }else if(command.kind==='collect'||command.kind==='discard'){
  if(!int(command.stove,interior.stoves-1))return fail('请选择灶台。');
  const s=next.stoves[command.stove];if(!s)return fail('灶台已经空了。');
  if(command.kind==='collect'){
   if(s.state!=='ready')return fail(s.state==='burnt'?'菜已烧糊，请先清理。':'还没有做好。');
   const recipe=recipeById(s.dish)!;
   if(!Object.hasOwn(next.stock,s.dish)&&Object.keys(next.stock).length>=interior.counters)return fail('餐台已满，请先卖完一种菜再上新菜。');
   if((next.stock[s.dish]??0)+recipe.servings>1e6)return fail('这道菜的存量已满，先营业卖一些吧。');
   next.stock[s.dish]=(next.stock[s.dish]??0)+recipe.servings;next.mastery[s.dish]=Math.min(1e6,(next.mastery[s.dish]??0)+1);next.xp=Math.min(1e9,next.xp+5+recipe.extraXp);message=`${recipe.name}已上餐台，共 ${recipe.servings} 份。`;
  }else message='灶台已清理，食材费用不退还。';
  next.stoves[command.stove]=null;
 }else if(command.kind==='hire'){
  if(r.staff>=staffLimit(r.xp))return fail('已达到当前等级的员工上限。');
  const cost=r.staff*250;if(coins<cost)return fail(`招募需要 ${cost} 摩尔豆。`);
  coins-=cost;next.spent=Math.min(1e9,next.spent+cost);next.staff++;message='新的拉姆帮手加入了！';
 }else if(command.kind==='interior'){
  const room=INTERIORS.find(i=>i.id===command.id);if(!room)return fail('没有找到这套餐厅内饰。');
  if(r.stoves.some(Boolean))return fail('先处理完灶台里的菜再更换内饰。');
  if(!r.owned.includes(room.id)){
   if(restaurantLevel(r.xp)<room.level)return fail(`餐厅 ${room.level} 级解锁这套内饰。`);
   if(coins<room.cost)return fail('摩尔豆不足。');coins-=room.cost;next.spent=Math.min(1e9,next.spent+room.cost);next.owned=[...r.owned,room.id];
  }
  if(Object.values(r.stock).filter(n=>n>0).length>room.counters)return fail('现有菜品种类超出新内饰的餐台数量，请先卖完一些。');
  next.interior=room.id;next.stoves=Array(room.stoves).fill(null);message='餐厅已换上新内饰。';
 }
 return {state:{...pet,coins,restaurant:next},ok:true,message};
}
export interface Guest {id:number;seat:number;dish:number;phase:'enter'|'wait'|'fetch'|'deliver'|'eat'|'leave';elapsed:number;wait:number;worker:number;paid:boolean;colour:number}
export interface RestaurantSession {open:boolean;arrival:number;nextId:number;guests:Guest[];earned:number;served:number;notice:string;seed:number}
export const createSession=(seed=Date.now()):RestaurantSession=>({open:false,arrival:2500,nextId:1,guests:[],earned:0,served:0,notice:'备好菜，再让拉姆开始营业吧。',seed:seed>>>0});
export const PHASE_MS={enter:2600,wait:30000,fetch:2100,deliver:3100,eat:9000,leave:2300};
export function restaurantBlockReason(pet:GameState):string|null {
 if(pet.sleeping)return '拉姆睡着了，叫醒以后再来工作。';
 if(pet.outing||pet.activity)return '先结束当前的外出、课程或工作。';
 if(getStage(pet.growth,pet.evolution)<1)return '初级拉姆就可以当服务员；种子需要先长大。';
 if(pet.stats.energy<21||pet.stats.health<25||pet.stats.hunger<15||pet.stats.thirst<15)return '拉姆需要先吃饱、喝水和休息，再来工作。';
 return null;
}
export function openRestaurant(pet:GameState,session:RestaurantSession){
 const reason=restaurantBlockReason(pet);return reason?{session:{...session,notice:reason},ok:false}:{session:{...createSession(session.seed),open:true,notice:'营业中 · 菜做好后，记得点击灶台上菜。'},ok:true};
}
/** Refund uncompleted orders on closing. No guest/worker state or clock enters a save. */
export function closeRestaurant(pet:GameState,session:RestaurantSession,notice='已打烊。打工已取消，食物和经营进度已保存。'){
 if(!session.open)return {state:pet,session:{...session,notice}};
 const r=pet.restaurant??createRestaurant(),stock={...r.stock};
 for(const g of session.guests)if(!g.paid&&['fetch','deliver','eat'].includes(g.phase))stock[g.dish]=Math.min(1e6,(stock[g.dish]??0)+1);
 return {state:{...pet,restaurant:{...r,stock,reserved:{}}},session:{...session,open:false,guests:[],notice}};
}
/** Advances only bounded, observed online time; a suspended tab never catches up. */
export function advanceRestaurant(pet:GameState,session:RestaurantSession,elapsed:number){
 if(!session.open)return {state:pet,session};
 if(!Number.isFinite(elapsed)||elapsed<=0)return {state:pet,session};
 if(elapsed>3000)return closeRestaurant(pet,session,'程序已暂停，自动打烊；未完成的订单不结算，菜品已退回。');
 const reason=restaurantBlockReason(pet);if(reason)return closeRestaurant(pet,session,reason+' 已自动打烊。');
 const dt=elapsed,r=pet.restaurant??createRestaurant(),stock={...r.stock},reserved={...r.reserved};
 let revenue=r.revenue,xp=r.xp,served=r.served,lost=r.lost,favor=r.favor,coins=pet.coins,earned=session.earned,sessionServed=session.served,notice=session.notice;
 const stoves=r.stoves.map(s=>{
  if(!s||s.state==='burnt')return s;
  if(s.state==='cooking')return s.remaining>dt?{...s,remaining:s.remaining-dt}:{...s,remaining:0,state:'ready' as const};
  return s.fresh>dt?{...s,fresh:s.fresh-dt}:{...s,fresh:0,state:'burnt' as const};
 });
 const guests:Guest[]=[];
 for(const original of session.guests){
  let g={...original,elapsed:original.elapsed+dt};
  if(g.phase==='wait'){
   g.wait+=dt;
   if(g.wait>=PHASE_MS.wait){g={...g,phase:'leave',elapsed:0};lost=Math.min(1e9,lost+1);favor=Math.max(0,favor-2);notice='有客人等太久离开了，记得及时上菜。';}
  }else if(g.elapsed>=PHASE_MS[g.phase]){
   if(g.phase==='enter')g={...g,phase:'wait',elapsed:0};
   else if(g.phase==='fetch')g={...g,phase:'deliver',elapsed:0};
   else if(g.phase==='deliver')g={...g,phase:'eat',elapsed:0};
   else if(g.phase==='eat'){
    if(!g.paid){const pay=recipeById(g.dish)!.sell+Math.floor(dishStars(r,g.dish)/2);coins=Math.min(1e9,coins+pay);revenue=Math.min(1e9,revenue+pay);earned+=pay;reserved[g.dish]=Math.max(0,(reserved[g.dish]??0)-1);served=Math.min(1e9,served+1);sessionServed++;xp=Math.min(1e9,xp+2);favor=Math.min(100,favor+1);notice=`客人用餐完毕，摩尔豆 +${pay}。`;}
    g={...g,phase:'leave',elapsed:0,paid:true};
   }else if(g.phase==='leave')continue;
  }
  guests.push(g);
 }
 const busy=new Set(guests.filter(g=>g.phase==='fetch'||g.phase==='deliver'||g.phase==='eat'&&g.elapsed<2100).map(g=>g.worker));
 for(let i=0;i<guests.length;i++){
  const g=guests[i];if(g.phase!=='wait')continue;
  const worker=Array.from({length:r.staff},(_,n)=>n).find(n=>!busy.has(n));
  // A reserved last serving still occupies its counter until delivered or refunded.
  const available=Object.keys(stock).map(Number).filter(id=>stock[id]>0);if(worker===undefined||!available.length)continue;
  const dish=available[g.id%available.length];stock[dish]--;reserved[dish]=(reserved[dish]??0)+1;busy.add(worker);guests[i]={...g,dish,worker,phase:'fetch',elapsed:0};
 }
 // Release empty counter types only after all their orders are paid.
 for(const key of Object.keys(stock)){const id=Number(key);if(stock[id]===0&&!guests.some(g=>g.dish===id&&!g.paid))delete stock[id];}
 let arrival=session.arrival-dt,nextId=session.nextId,seed=session.seed;
 if(arrival<=0){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;arrival=5500+(seed%3000)+Math.max(0,50-favor)*60;
  const seat=Array.from({length:restaurantInterior(r).tables},(_,n)=>n).find(n=>!guests.some(g=>g.seat===n));
  if(seat!==undefined){guests.push({id:nextId++,seat,dish:0,phase:'enter',elapsed:0,wait:0,worker:-1,paid:false,colour:seed%4});}
 }
 return {state:{...pet,coins,restaurant:{...r,stock,reserved,stoves,revenue,xp,served,lost,favor}},session:{...session,guests,arrival,nextId,seed,earned,served:sessionServed,notice}};
}
export function restaurantHonors(r:RestaurantState){
 return [{name:'小有心得',done:r.served>=10,progress:`${Math.min(10,r.served)}/10 位客人`},{name:'财源滚滚',done:r.revenue>=1000,progress:`${Math.min(1000,r.revenue)}/1000 豆营业额`},{name:'大家风范',done:restaurantLevel(r.xp)>=10,progress:`${restaurantLevel(r.xp)}/10 级`},{name:'五星厨神',done:RECIPES.some(recipe=>dishStars(r,recipe.id)>=5),progress:'任一道菜达到五星'}];
}

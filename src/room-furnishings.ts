import type {GameState} from './game'
import {COURSES,learned,type CourseId} from './pet-school'
import originalFurniture from '../public/assets/original/furniture/catalog.json'
import archivedFurnitureIds from './archived-furniture-ids.json'
import {FURNITURE_PRICE} from './economy'
import {READING_SHELF_ID,normalizeShelfPage} from './reading-progress'
import {furnitureIdleImage,roomFurnitureAction} from './room-furniture-actions'
export type Surface='wall'|'floor'
export interface Placement {id:string;x:number;y:number;instanceId?:string;scale?:number;order?:number;shelfPage?:number}
export interface RoomFurnishings {owned:string[];placed:Placement[]}
export const hasRoomWall=(backgroundId:string)=>!['berry-picnic','sky-observatory','mystery-flower-sea'].includes(backgroundId)
export interface FurnitureDefinition {
 id:string;name:string;surface:Surface;price:number;width?:number;pixelWidth?:number;
 image?:string;sourceId?:string;originalArea?:'house'|'garden';dragOnly?:boolean;
}
export const MUSIC_BOX_ID='music-box';
const musicBox: FurnitureDefinition = {id:MUSIC_BOX_ID,name:'音乐盒',surface:'floor',price:FURNITURE_PRICE,width:10,image:'./assets/original/furniture/music-box.png',sourceId:'160169'};
export const GAME_PRIZE_FURNITURE:readonly FurnitureDefinition[]=[
 {id:READING_SHELF_ID,name:'拉姆书架',surface:'floor',price:0,width:20,image:'./assets/original/reading-books/shelf.svg'},
 {id:'message-board',name:'小屋留言板',surface:'wall',price:0,width:9,image:'./assets/original/message-board/board.png',sourceId:'160131',dragOnly:true},
 ...originalFurniture.map(item=>({...item,surface:(item.surface==='wall'?'wall':'floor') as Surface})),
 {id:'leaf-rug',name:'嫩叶地毯',surface:'floor',price:120,width:17},
 {id:'cushion',name:'浆果软垫',surface:'floor',price:180,width:11},
 {id:'plant',name:'小小绿植',surface:'floor',price:160,width:9},
 {id:'bookcase',name:'橡木书架',surface:'floor',price:360,width:14},
 {id:'tea-table',name:'蘑菇茶几',surface:'floor',price:280,width:13},
 {id:'lamp',name:'暖光小灯',surface:'floor',price:220,width:8},
 {id:'leaf-clock',name:'双叶挂钟',surface:'wall',price:200,width:9},
 {id:'picture',name:'庄园风景画',surface:'wall',price:240,width:14},
].map(furniture=>({...furniture,surface:furniture.surface as Surface,price:furniture.id===READING_SHELF_ID?0:FURNITURE_PRICE}))
export const STANDARD_FURNITURE:readonly FurnitureDefinition[]=[musicBox,...GAME_PRIZE_FURNITURE];
const furnitureIndex=new Map(STANDARD_FURNITURE.map(item=>[item.id,item]));
const archivedFurniture=new Set(archivedFurnitureIds);
const isPurchasableFurniture=(id:string)=>furnitureIndex.has(id)||archivedFurniture.has(id);
export function standardFurnitureById(id:string):FurnitureDefinition|undefined{
 const f=furnitureIndex.get(id);if(f)return f
 if(id.startsWith('certificate-')){const c=COURSES.find(c=>id===`certificate-${c.id}`);if(c)return {id,name:`${c.name}结业证书`,surface:'wall' as const,price:0,width:12}}
}
export function furnitureImage(id:string,image=standardFurnitureById(id)?.image){
 const action=roomFurnitureAction(id);
 if(action)return furnitureIdleImage(action);
 return image??`./assets/generated/school/furniture/${id.startsWith('certificate-')?'certificate':id}.png`;
}
const exists=(id:string)=>archivedFurniture.has(id)||Boolean(standardFurnitureById(id));
// The official message board is a free wall furnishing. It stays in the
// warehouse for every existing save, so adding this feature never rewrites an
// old room inventory or forces the board onto a wall.
const isFreeRoomFurniture=(id:string)=>id==='message-board'||id===READING_SHELF_ID;
export const isRoomInteractiveFurniture=(id:string)=>id===MUSIC_BOX_ID||isFreeRoomFurniture(id)||Boolean(roomFurnitureAction(id));
export const canOwn=(pet:Pick<GameState,'room'|'education'>,id:string)=>isFreeRoomFurniture(id)?true:id.startsWith('certificate-')?learned(pet,id.slice(12) as CourseId):Boolean(pet.room?.owned.includes(id))
export const hasPlacedMusicBox=(pet:GameState)=>canOwn(pet,MUSIC_BOX_ID)&&Boolean(pet.room?.placed.some(piece=>piece.id===MUSIC_BOX_ID));
export const MAX_PLACED_FURNITURE=200;
export const placementKey=(p:Placement)=>p.instanceId??p.id;
export const furnitureScale=(p:Placement)=>p.scale??1;
export function normalizeRoom(value:unknown):RoomFurnishings|undefined{
 if(!value||typeof value!=='object')return
 const raw=value as Partial<RoomFurnishings>,owned=Array.isArray(raw.owned)?[...new Set(raw.owned.filter(id=>typeof id==='string'&&isPurchasableFurniture(id)))]:[]
 const seen=new Set<string>(),placed:Placement[]=[]
 if(Array.isArray(raw.placed))for(const p of raw.placed.slice(0,MAX_PLACED_FURNITURE)){
  if(!p||typeof p.id!=='string'||!exists(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue
  if(p.id===MUSIC_BOX_ID&&!owned.includes(MUSIC_BOX_ID))continue;
  const instanceId=typeof p.instanceId==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(p.instanceId)?p.instanceId:undefined;
  if(p.instanceId!==undefined&&!instanceId)continue;
  const key=instanceId??p.id;if(seen.has(key))continue;seen.add(key);
  placed.push({id:p.id,x:Math.max(0,Math.min(100,p.x)),y:Math.max(0,Math.min(100,p.y)),...(instanceId?{instanceId}:{}),...(typeof p.scale==='number'&&Number.isFinite(p.scale)?{scale:Math.max(.25,Math.min(3,p.scale))}:{}),...(typeof p.order==='number'&&Number.isFinite(p.order)?{order:Math.max(0,Math.min(10000,Math.round(p.order)))}:{}),...(p.id===READING_SHELF_ID&&typeof p.shelfPage==='number'&&Number.isFinite(p.shelfPage)?{shelfPage:normalizeShelfPage(p.shelfPage)}:{})})
 }
 return {owned,placed}
}

export function buyFurniture(pet:GameState,id:string){
 if(!isPurchasableFurniture(id))return {state:pet,ok:false,message:'这件家具暂时不可购买。'};
 if(canOwn(pet,id))return {state:pet,ok:false,message:'已经拥有这件摆设啦。'};
 const price=furnitureIndex.get(id)?.price??FURNITURE_PRICE;
 if(pet.coins<price)return {state:pet,ok:false,message:'摩尔豆不够啦。'};
 return {state:{...pet,coins:pet.coins-price,room:{owned:[...(pet.room?.owned??[]),id],placed:pet.room?.placed??[]}},ok:true,message:'家具已放进布置箱。'};
}
/** Buying unlocks the design; each placed copy has its own key and size.
 * Old id/x/y records remain valid and are edited in place, without migration. */
export function placeFurniture(pet:GameState,id:string,x:number,y:number,instanceId?:string,scale?:number,order?:number){
 if(!exists(id)||!canOwn(pet,id)||![x,y].every(Number.isFinite)||x<0||x>100||y<0||y>100||scale!==undefined&&(!Number.isFinite(scale)||scale<.25||scale>3)||order!==undefined&&(!Number.isSafeInteger(order)||order<0||order>10000))return pet;
 const placed=pet.room?.placed??[],existing=instanceId?placed.find(p=>placementKey(p)===instanceId&&p.id===id):undefined;
 if(instanceId&&!existing||!instanceId&&placed.length>=MAX_PLACED_FURNITURE)return pet;
 let key=instanceId;
 if(!key){
  const prefix=`piece-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  key=prefix;
  for(let suffix=1;placed.some(piece=>placementKey(piece)===key);suffix++)key=`${prefix}-${suffix}`;
 }
 const piece:Placement={...(existing??{id,instanceId:key}),x,y,...(scale!==undefined?{scale}:{}),...(order!==undefined?{order}:{})};
 return {...pet,room:{owned:pet.room?.owned??[],placed:existing?placed.map(p=>p===existing?piece:p):[...placed,piece]}};
}
export const frontFurnitureOrder=(placed:readonly Placement[])=>Math.min(10000,Math.max(0,...placed.map(piece=>piece.order??0))+1);

export function duplicateFurniture(pet:GameState,key:string){
 const placed=pet.room?.placed??[];
 const piece=placed.find(candidate=>placementKey(candidate)===key);
 if(!piece)return pet;
 const x=piece.x+(piece.x>94?-6:6),y=piece.y<8?piece.y+4:piece.y-4;
 const next=placeFurniture(pet,piece.id,x,y,undefined,piece.scale,frontFurnitureOrder(placed));
 if(next===pet||piece.shelfPage===undefined)return next;
 return changeReadingShelfPage(next,placementKey(next.room!.placed.at(-1)!),piece.shelfPage);
}
export function removeFurniture(pet:GameState,key:string){return {...pet,room:{owned:pet.room?.owned??[],placed:(pet.room?.placed??[]).filter(p=>placementKey(p)!==key)}}}
export function changeReadingShelfPage(pet:GameState,key:string,page:number){
 const current=pet.room?.placed.find(piece=>placementKey(piece)===key&&piece.id===READING_SHELF_ID);
 if(!current||!Number.isFinite(page))return pet;
 const shelfPage=normalizeShelfPage(page);if(shelfPage===(current.shelfPage??0))return pet;
 return {...pet,room:{owned:pet.room!.owned,placed:pet.room!.placed.map(piece=>piece===current?{...piece,shelfPage}:piece)}};
}

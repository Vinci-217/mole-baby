import type {GameState} from './game'
import {COURSES,learned,type CourseId} from './pet-school'
import originalFurniture from '../public/assets/original/furniture/catalog.json'
import {FURNITURE_PRICE} from './economy'
export type Surface='wall'|'floor'
export interface Placement {id:string;x:number;y:number;instanceId?:string;scale?:number;order?:number}
export interface RoomFurnishings {owned:string[];placed:Placement[]}
export const hasRoomWall=(backgroundId:string)=>!['berry-picnic','sky-observatory','mystery-flower-sea'].includes(backgroundId)
export interface FurnitureDefinition {id:string;name:string;surface:Surface;price:number;width:number;image?:string;sourceId?:string;dragOnly?:boolean}
export const FURNITURE:readonly FurnitureDefinition[]=[
 ...originalFurniture.map(item=>({...item,surface:(item.surface==='wall'?'wall':'floor') as Surface})),
 {id:'leaf-rug',name:'嫩叶地毯',surface:'floor',price:120,width:17},
 {id:'cushion',name:'浆果软垫',surface:'floor',price:180,width:11},
 {id:'plant',name:'小小绿植',surface:'floor',price:160,width:9},
 {id:'bookcase',name:'橡木书架',surface:'floor',price:360,width:14},
 {id:'tea-table',name:'蘑菇茶几',surface:'floor',price:280,width:13},
 {id:'lamp',name:'暖光小灯',surface:'floor',price:220,width:8},
 {id:'leaf-clock',name:'双叶挂钟',surface:'wall',price:200,width:9},
 {id:'picture',name:'庄园风景画',surface:'wall',price:240,width:14},
 {id:'message-board',name:'小屋留言板',surface:'wall',price:0,width:9,image:'./assets/original/message-board/board.png',sourceId:'160131',dragOnly:true},
].map(furniture=>({...furniture,surface:furniture.surface as Surface,price:FURNITURE_PRICE}))
export function furnitureById(id:string){
 const f=FURNITURE.find(f=>f.id===id);if(f)return f
 if(id.startsWith('certificate-')){const c=COURSES.find(c=>id===`certificate-${c.id}`);if(c)return {id,name:`${c.name}结业证书`,surface:'wall' as const,price:0,width:12}}
}
export const furnitureImage=(id:string)=>{const furniture=furnitureById(id);return furniture&&'image' in furniture&&furniture.image?furniture.image:`./assets/generated/school/furniture/${id.startsWith('certificate-')?'certificate':id}.png`}
// Pixel widths relative to the room's 150 px pet. Beds, seats and small wall
// ornaments have distinct proportions; a wider monitor must not enlarge them.
const FURNITURE_WIDTHS:Record<string,number>={
 'original-160057':195,'original-160136':155,'original-160185':65,
 'original-160188':170,'original-160190':205,'original-160216':155,
 'original-160218':260,'original-160219':235,'original-160220':155,
 'original-160221':115,'original-160227':65,'original-160254':235,
 'original-160526':250,'original-160666':85,'original-160667':85,
 'original-160680':245,'original-160681':180,'original-160683':115,
 'original-160684':175,'leaf-rug':240,cushion:110,plant:80,bookcase:155,
 'tea-table':165,lamp:65,'leaf-clock':65,picture:130,'message-board':74,
};
export function furniturePixelWidth(id:string){return (FURNITURE_WIDTHS[id]??(id.startsWith('certificate-')?105:100))*.68}
// The official message board is a free wall furnishing. It stays in the
// warehouse for every existing save, so adding this feature never rewrites an
// old room inventory or forces the board onto a wall.
export const canOwn=(pet:GameState,id:string)=>id==='message-board'?true:id.startsWith('certificate-')?learned(pet,id.slice(12) as CourseId):Boolean(pet.room?.owned.includes(id))
export const MAX_PLACED_FURNITURE=200;
export const placementKey=(p:Placement)=>p.instanceId??p.id;
export const furnitureScale=(p:Placement)=>p.scale??1;
export function normalizeRoom(value:unknown):RoomFurnishings|undefined{
 if(!value||typeof value!=='object')return
 const raw=value as Partial<RoomFurnishings>,owned=Array.isArray(raw.owned)?[...new Set(raw.owned.filter(id=>typeof id==='string'&&FURNITURE.some(f=>f.id===id)))].slice(0,FURNITURE.length):[]
 const seen=new Set<string>(),placed:Placement[]=[]
 if(Array.isArray(raw.placed))for(const p of raw.placed.slice(0,MAX_PLACED_FURNITURE)){
  if(!p||typeof p.id!=='string'||!furnitureById(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue
  const instanceId=typeof p.instanceId==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(p.instanceId)?p.instanceId:undefined;
  if(p.instanceId!==undefined&&!instanceId)continue;
  const key=instanceId??p.id;if(seen.has(key))continue;seen.add(key);
  placed.push({id:p.id,x:Math.max(0,Math.min(100,p.x)),y:Math.max(0,Math.min(100,p.y)),...(instanceId?{instanceId}:{}),...(typeof p.scale==='number'&&Number.isFinite(p.scale)?{scale:Math.max(.25,Math.min(3,p.scale))}:{}),...(typeof p.order==='number'&&Number.isFinite(p.order)?{order:Math.max(0,Math.min(10000,Math.round(p.order)))}:{})})
 }
 return {owned,placed}
}

export function buyFurniture(pet:GameState,id:string){
 const f=FURNITURE.find(f=>f.id===id)
 if(!f||canOwn(pet,id)||pet.coins<f.price)return {state:pet,ok:false,message:canOwn(pet,id)?'已经拥有这件摆设啦。':'摩尔豆不够啦。'}
 return {state:{...pet,coins:pet.coins-f.price,room:{owned:[...(pet.room?.owned??[]),id],placed:pet.room?.placed??[]}},ok:true,message:`${f.name}放进布置箱啦。`}
}
/** Buying unlocks the design; each placed copy has its own key and size.
 * Old id/x/y records remain valid and are edited in place, without migration. */
export function placeFurniture(pet:GameState,id:string,x:number,y:number,instanceId?:string,scale?:number,order?:number){
 if(!furnitureById(id)||!canOwn(pet,id)||![x,y].every(Number.isFinite)||x<0||x>100||y<0||y>100||scale!==undefined&&(!Number.isFinite(scale)||scale<.25||scale>3)||order!==undefined&&(!Number.isSafeInteger(order)||order<0||order>10000))return pet;
 const placed=pet.room?.placed??[],existing=instanceId?placed.find(p=>placementKey(p)===instanceId&&p.id===id):undefined;
 if(instanceId&&!existing||!instanceId&&placed.length>=MAX_PLACED_FURNITURE)return pet;
 let key=instanceId;
 if(!key){do{key=`piece-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}while(placed.some(p=>placementKey(p)===key))}
 const piece:Placement={...(existing??{id,instanceId:key}),x,y,...(scale!==undefined?{scale}:{}),...(order!==undefined?{order}:{})};
 return {...pet,room:{owned:pet.room?.owned??[],placed:existing?placed.map(p=>p===existing?piece:p):[...placed,piece]}};
}
export function removeFurniture(pet:GameState,key:string){return {...pet,room:{owned:pet.room?.owned??[],placed:(pet.room?.placed??[]).filter(p=>placementKey(p)!==key)}}}

import type {GameState} from './game'
import {COURSES,learned,type CourseId} from './pet-school'
export type Surface='wall'|'floor'
export interface Placement {id:string;x:number;y:number}
export interface RoomFurnishings {owned:string[];placed:Placement[]}
export const hasRoomWall=(backgroundId:string)=>!['berry-picnic','sky-observatory'].includes(backgroundId)
export const FURNITURE=[
 {id:'leaf-rug',name:'嫩叶地毯',surface:'floor',price:120,width:17},
 {id:'cushion',name:'浆果软垫',surface:'floor',price:180,width:11},
 {id:'plant',name:'小小绿植',surface:'floor',price:160,width:9},
 {id:'bookcase',name:'橡木书架',surface:'floor',price:360,width:14},
 {id:'tea-table',name:'蘑菇茶几',surface:'floor',price:280,width:13},
 {id:'lamp',name:'暖光小灯',surface:'floor',price:220,width:8},
 {id:'leaf-clock',name:'双叶挂钟',surface:'wall',price:200,width:9},
 {id:'picture',name:'庄园风景画',surface:'wall',price:240,width:14},
] as const
export function furnitureById(id:string){
 const f=FURNITURE.find(f=>f.id===id);if(f)return f
 if(id.startsWith('certificate-')){const c=COURSES.find(c=>id===`certificate-${c.id}`);if(c)return {id,name:`${c.name}结业证书`,surface:'wall' as const,price:0,width:12}}
}
export const furnitureImage=(id:string)=>`./assets/generated/school/furniture/${id.startsWith('certificate-')?'certificate':id}.png`
export const canOwn=(pet:GameState,id:string)=>id.startsWith('certificate-')?learned(pet,id.slice(12) as CourseId):Boolean(pet.room?.owned.includes(id))
export function normalizeRoom(value:unknown):RoomFurnishings|undefined{
 if(!value||typeof value!=='object')return
 const raw=value as Partial<RoomFurnishings>,owned=Array.isArray(raw.owned)?[...new Set(raw.owned.filter(id=>typeof id==='string'&&FURNITURE.some(f=>f.id===id)))].slice(0,30):[]
 const seen=new Set<string>(),placed:Placement[]=[]
 if(Array.isArray(raw.placed))for(const p of raw.placed){
  if(!p||typeof p.id!=='string'||seen.has(p.id)||!furnitureById(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue
  const f=furnitureById(p.id)!;seen.add(p.id);placed.push({id:p.id,x:Math.max(10,Math.min(90,p.x)),y:Math.max(f.surface==='wall'?20:66,Math.min(f.surface==='wall'?40:81,p.y))})
 }
 return {owned,placed}
}
export function buyFurniture(pet:GameState,id:string){
 const f=FURNITURE.find(f=>f.id===id)
 if(!f||canOwn(pet,id)||pet.coins<f.price)return {state:pet,ok:false,message:canOwn(pet,id)?'已经拥有这件摆设啦。':'摩尔豆不够啦。'}
 return {state:{...pet,coins:pet.coins-f.price,room:{owned:[...(pet.room?.owned??[]),id],placed:pet.room?.placed??[]}},ok:true,message:`${f.name}放进布置箱啦。`}
}
export function placeFurniture(pet:GameState,id:string,x:number,y:number){
 const f=furnitureById(id);if(!f||!canOwn(pet,id)||!Number.isFinite(x)||!Number.isFinite(y)||x<10||x>90||y<(f.surface==='wall'?20:66)||y>(f.surface==='wall'?40:81))return pet
 return {...pet,room:{owned:pet.room?.owned??[],placed:[...(pet.room?.placed??[]).filter(p=>p.id!==id),{id,x,y}]}}
}
export function removeFurniture(pet:GameState,id:string){return {...pet,room:{owned:pet.room?.owned??[],placed:(pet.room?.placed??[]).filter(p=>p.id!==id)}}}

import {createPet,GROWTH_MAX,type GameState} from './game';

const FLAG='ramu-local-debug-v1',DATA='ramu-local-debug-data-v1';
// Only an explicitly requested preview build or Vite development server has
// this switch. Native builds keep their normal persistence bridge untouched.
export function localDebugAvailable(){return (import.meta.env.DEV||import.meta.env.VITE_LOCAL_DEBUG==='1')&&!window.desktop&&!window.mobile}
export function localDebugEnabled(){return localDebugAvailable()&&sessionStorage.getItem(FLAG)==='on'}
export function setLocalDebug(enabled:boolean){
 if(!localDebugAvailable())return;
 if(enabled)sessionStorage.setItem(FLAG,'on');else sessionStorage.removeItem(FLAG);
 location.reload();
}
/** A Storage-compatible sandbox backed only by this tab's sessionStorage.
 * Writes, clear(), property access and key enumeration never reach live data. */
export function debugStorage(entries:Record<string,string>,persist:(entries:Record<string,string>)=>void):Storage{
 const values=Object.assign(Object.create(null) as Record<string,string>,entries);
 const flush=()=>persist({...values});
 const methods={getItem:(key:string)=>values[String(key)]??null,setItem:(key:string,value:string)=>{values[String(key)]=String(value);flush()},removeItem:(key:string)=>{delete values[String(key)];flush()},clear:()=>{for(const key of Object.keys(values))delete values[key];flush()},key:(index:number)=>Object.keys(values)[index]??null};
 return new Proxy(Object.create(null),{
  get:(_target,key)=>key==='length'?Object.keys(values).length:key in methods?methods[key as keyof typeof methods]:values[String(key)],
  set:(_target,key,value)=>{methods.setItem(String(key),value);return true},
  deleteProperty:(_target,key)=>{methods.removeItem(String(key));return true},
  ownKeys:()=>Object.keys(values),getOwnPropertyDescriptor:(_target,key)=>key in values?{value:values[String(key)],enumerable:true,configurable:true,writable:true}:undefined,
 }) as Storage;
}
export function installLocalDebug(){
 if(!localDebugEnabled())return;
 const live=window.localStorage;let entries:Record<string,string>;
 try{entries=JSON.parse(sessionStorage.getItem(DATA)??'null');if(!entries||Object.values(entries).some(v=>typeof v!=='string'))throw Error('No sandbox')}catch{
  entries=Object.fromEntries(Object.entries(live));
  let pet:GameState;try{pet=JSON.parse(live.getItem('ramu-house-save-v1')??'null');if(!pet?.stats)throw Error('No pet')}catch{pet=createPet('调试拉姆','yellow')}
  entries['ramu-house-save-v1']=JSON.stringify({...pet,highestGrowth:GROWTH_MAX,activity:undefined,outing:undefined,lastTick:Date.now()});
 }
 const persist=(next:Record<string,string>)=>sessionStorage.setItem(DATA,JSON.stringify(next));persist(entries);
 Object.defineProperty(window,'localStorage',{value:debugStorage(entries,persist),configurable:true});
}

import type {Plugin} from 'vite';
import type {BookPageFrame,BookPageLayouts} from '../src/reading-page-layout';

type BookLayouts=Record<string,{frames:BookPageFrame[]}>;
const pageControls=new Set(['pre_btn','next_btn','close_btn']);

/** The runtime needs paper geometry and navigation hit boxes from the export. */
export function packReadingGeometry(layouts:BookLayouts):BookPageLayouts {
 const unique=new Map<string,number>(),frames:BookPageFrame[]=[];
 const books=Object.fromEntries(Object.entries(layouts).map(([id,layout])=>[id,
  layout.frames.map(({rect,viewRect,controls})=>{
   const close=controls.find(control=>/close/i.test(control.name));
   const frame={rect,viewRect,controls:controls.filter(control=>pageControls.has(control.name)||control===close)
    .map(({name,rect})=>({name,rect}))};
   const key=JSON.stringify(frame),existing=unique.get(key);
   if(existing!==undefined)return existing;
   const index=frames.push(frame)-1;
   unique.set(key,index);
   return index;
  }),
 ]));
 return {books,frames};
}

function packFurnitureMask<T extends {mask:string[]}>({mask,...bounds}:T){
 if(mask.length!==32||mask.some(row=>!/^[0-9a-f]{8}$/i.test(row)))throw Error('Invalid furniture alpha mask');
 return {...bounds,mask:Buffer.from(mask.join(''),'hex').toString('base64')};
}

export function runtimeAssetData():Plugin {
 return {name:'runtime-asset-data',enforce:'pre',transform(code,id){
  if(id.endsWith('/public/assets/original/reading-books/layout.json')){
   return JSON.stringify(packReadingGeometry(JSON.parse(code)));
  }
  if(id.endsWith('/public/assets/original/furniture/bounds.json')){
   const bounds=JSON.parse(code) as Record<string,{mask:string[]}>;
   return JSON.stringify(Object.fromEntries(Object.entries(bounds).map(([key,art])=>[key,packFurnitureMask(art)])));
  }
  if(id.endsWith('/public/assets/original/reading-books/shelf-bounds.json')){
   return JSON.stringify(packFurnitureMask(JSON.parse(code)));
  }
 }};
}

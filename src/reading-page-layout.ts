import originalLayouts from '../public/assets/original/reading-books/layout.json';
import type {RamBook} from './reading-books';

export type BookRect=[number,number,number,number];
export interface BookPageFrame {
 rect:BookRect;
 viewRect?:BookRect;
 controls:{name:string;rect:BookRect}[];
}
export interface BookPageLayouts {books:Record<string,number[]>;frames:BookPageFrame[]}
const layouts=originalLayouts as unknown as BookPageLayouts;

/** Original paper bounds; static exports can include text extending past the paper. */
export function readingPageLayout(book:RamBook,page:number){
 const frame=layouts.frames[layouts.books[book.id][page]],rect=frame.viewRect??frame.rect;
 const width=frame.viewRect?rect[2]:Math.min(rect[2],book.id==='secret'?783:750),height=rect[3];
 const fallback=(side:'left'|'right',top=false):BookRect=>[
  rect[0]+(side==='left'?0:width-105),rect[1]+(top?0:height-165),105,top?145:165
 ];
 function position(bounds:BookRect){
  return {left:`${(bounds[0]-rect[0])/width*100}%`,top:`${(bounds[1]-rect[1])/height*100}%`,width:`${bounds[2]/width*100}%`,height:`${bounds[3]/height*100}%`};
 }
 function hit(name:string,otherwise:BookRect){
  const exact=frame.controls.find(control=>control.name===name);
  const source=(exact??(name==='close_btn'?frame.controls.find(control=>/close/i.test(control.name)):undefined))?.rect??otherwise;
  const left=Math.max(rect[0],source[0]),top=Math.max(rect[1],source[1]);
  const right=Math.min(rect[0]+width,source[0]+source[2]),bottom=Math.min(rect[1]+height,source[1]+source[3]);
  return position(right>left&&bottom>top?[left,top,right-left,bottom-top]:otherwise);
 }
 return {width,height,image:position(frame.rect),
  previous:frame.viewRect?{left:0,top:'68%',width:'19%',height:'32%'}:hit('pre_btn',fallback('left')),
  next:frame.viewRect?{right:0,top:'68%',width:'19%',height:'32%'}:hit('next_btn',fallback('right')),
  close:hit('close_btn',fallback(page===book.pages.length-1?'left':'right',true))};
}

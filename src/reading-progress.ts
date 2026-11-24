import bookPageCounts from './reading-book-page-counts.json';

const pageCounts: Readonly<Record<string,number>>=bookPageCounts;
export const READING_SHELF_ID='reading-shelf';
export const RAM_HANDBOOK_ID='supplies';
export type RamBookId=string;
export const SHELF_BOOKS_PER_ROW=7;
export const BOOKS_PER_SHELF_PAGE=2*SHELF_BOOKS_PER_ROW;
export const SHELF_PAGE_COUNT=Math.max(1,Math.ceil(Object.keys(pageCounts).length/BOOKS_PER_SHELF_PAGE));
export const normalizeShelfPage=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(SHELF_PAGE_COUNT-1,Math.floor(value))):0;

export interface ReadingProgress {pages:Partial<Record<RamBookId,number>>;lastBook?:RamBookId}
const knownBook=(id:unknown):id is RamBookId=>typeof id==='string'&&Object.hasOwn(pageCounts,id);
const boundedPage=(id:RamBookId,page:number)=>Math.max(0,Math.min(pageCounts[id]-1,Math.floor(page)));

export function normalizeReadingProgress(value:unknown):ReadingProgress|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const raw=value as {pages?:unknown;lastBook?:unknown},pages:ReadingProgress['pages']={};
 if(raw.pages&&typeof raw.pages==='object'&&!Array.isArray(raw.pages))for(const [id,page] of Object.entries(raw.pages)){
  if(knownBook(id)&&typeof page==='number'&&Number.isFinite(page))pages[id]=boundedPage(id,page);
 }
 const lastBook=knownBook(raw.lastBook)?raw.lastBook:undefined;
 return Object.keys(pages).length||lastBook?{pages,...(lastBook?{lastBook}:{})}:undefined;
}

export function bookmarkPage(progress:ReadingProgress|undefined,id:RamBookId,page:number):ReadingProgress{
 if(!knownBook(id)||!Number.isFinite(page))return progress??{pages:{}};
 return {pages:{...progress?.pages,[id]:boundedPage(id,page)},lastBook:id};
}

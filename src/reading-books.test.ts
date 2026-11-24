import {describe,it,expect} from 'vitest';
import {RAM_BOOKS,RAM_HANDBOOK_ID,READING_SHELF_ID,BOOKS_PER_SHELF_PAGE,SHELF_BOOKS_PER_ROW,SHELF_PAGE_COUNT,ramBook,shelfBooks,normalizeShelfPage,normalizeReadingProgress,bookmarkPage} from './reading-books';
import {bookSpine} from './reading-spines';
import {createPet,parseSave} from './game';
import {canOwn,placeFurniture,changeReadingShelfPage,normalizeRoom} from './room-furnishings';
import {createMemory} from './companion-memory';
import {petBackupText,restorePetBackup} from './pet-backup';
import {readFileSync} from 'node:fs';
import {packReadingGeometry} from '../scripts/runtime-asset-data';
import {readingPageLayout,type BookPageFrame} from './reading-page-layout';
import pageCounts from './reading-book-page-counts.json';

const now=1_800_000_000_000;
it('keeps every paper and navigation rectangle needed by the original reader',()=>{
 const original=JSON.parse(readFileSync('public/assets/original/reading-books/layout.json','utf8')) as Record<string,{frames:BookPageFrame[]}>;
 const compact=packReadingGeometry(original);
 expect(pageCounts).toEqual(Object.fromEntries(RAM_BOOKS.map(book=>[book.id,book.pages.length])));
 const control=(frame:BookPageFrame,name:string)=>frame.controls.find(item=>item.name===name)?.rect??
  (name==='close_btn'?frame.controls.find(item=>/close/i.test(item.name))?.rect:undefined);
 for(const book of RAM_BOOKS)for(const [page] of book.pages.entries()){
  const before=original[book.id].frames[page],after=compact.frames[compact.books[book.id][page]];
  expect(after.rect).toEqual(before.rect);
  expect(after.viewRect).toEqual(before.viewRect);
  for(const name of ['pre_btn','next_btn','close_btn'])expect(control(after,name)).toEqual(control(before,name));
  const layout=readingPageLayout(book,page);
  expect(layout.width).toBeGreaterThan(0);
  expect(layout.height).toBeGreaterThan(0);
 }
});
describe('a personal shelf and portable reading positions',()=>{
 it('lets an existing save place the free shelf without changing coins, identity or existing furniture',()=>{
  const original={...createPet('小叶','blue',now),room:{owned:['plant'],placed:[{id:'plant',x:20,y:70}]}};
  const loaded=parseSave(JSON.stringify(original),now)!;
  expect(loaded.reading).toBeUndefined();expect(canOwn(loaded,READING_SHELF_ID)).toBe(true);
  const next=placeFurniture(loaded,READING_SHELF_ID,40,60);
  expect(next.coins).toBe(original.coins);expect(next.createdAt).toBe(original.createdAt);
  expect(next.room!.owned).toEqual(original.room.owned);expect(next.room!.placed[0]).toEqual(original.room.placed[0]);
  expect(next.room!.placed[1].id).toBe(READING_SHELF_ID);
 });
 it('keeps the separate place in every book and preserves it in an exported and imported pet backup',()=>{
  let reading=bookmarkPage(undefined,'life',3);reading=bookmarkPage(reading,'study',6);
  const pet={...createPet('书友','pink',now),reading},entries=new Map<string,string>();
  const storage={getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>{entries.set(key,value)},removeItem:(key:string)=>{entries.delete(key)}};
  const exported=petBackupText(pet,createMemory(pet),storage),restored=restorePetBackup(exported,storage,now);
  expect(restored.pet.reading).toEqual({pages:{life:3,study:6},lastBook:'study'});
  expect(restored.pet.createdAt).toBe(pet.createdAt);expect(restored.pet.inventory).toEqual(pet.inventory);
  expect(parseSave(storage.getItem('ramu-house-save-v1'),now)!.reading).toEqual(pet.reading);
 });
 it('bounds imported bookmarks to the real book pages and ignores unknown or invalid entries',()=>{
  expect(normalizeReadingProgress({pages:{life:1e9,study:-3,food:2.9,secret:'4',supplies:Infinity,unknown:2},lastBook:'unknown'})).toEqual({pages:{life:9,study:0,food:2}});
  for(const value of [null,[],{},false,{pages:{study:NaN},lastBook:'bad'}])expect(normalizeReadingProgress(value)).toBeUndefined();
  const progress=bookmarkPage(undefined,'study',4);
  expect(bookmarkPage(progress,'study',NaN)).toBe(progress);
  expect(normalizeReadingProgress({pages:{},lastBook:'secret'})).toEqual({pages:{},lastBook:'secret'});
 });
 it('drops the removed book from old reading progress and keeps the other bookmarks',()=>{
  expect(ramBook('library-36')).toBeUndefined();
  expect(normalizeReadingProgress({pages:{'library-36':3,study:4},lastBook:'library-36'})).toEqual({pages:{study:4}});
  expect(normalizeReadingProgress({pages:{'library-36':3},lastBook:'library-36'})).toBeUndefined();
  expect(RAM_BOOKS.map(book=>`${book.title} ${book.description}`).join('\n')).not.toMatch(/[摩魔]\s*[灵靈]|\bmo[ _-]?ling\b|magic[ _-]?spirit/iu);
 });
 it('makes every distinct verified book reachable once through the furniture pages',()=>{
  expect(RAM_BOOKS.length).toBeGreaterThan(60);expect(SHELF_BOOKS_PER_ROW).toBe(7);
  expect(BOOKS_PER_SHELF_PAGE).toBe(2*SHELF_BOOKS_PER_ROW);
  const books=Array.from({length:SHELF_PAGE_COUNT},(_,index)=>shelfBooks(index)).flat();
  expect(books).toEqual(RAM_BOOKS);expect(new Set(books.map(book=>book.id)).size).toBe(books.length);
  expect(new Set(books.map(book=>book.source)).size).toBe(books.length);
  for(const id of ['dragon-handbook','super-ram-introduction','gazette-1'])expect(ramBook(id)?.pages.length).toBeGreaterThan(1);
  expect(shelfBooks(0)[0].id).toBe(RAM_HANDBOOK_ID);
  for(const page of [NaN,Infinity,undefined,'2',-1])expect(normalizeShelfPage(page)).toBe(0);
  expect(normalizeShelfPage(1e9)).toBe(SHELF_PAGE_COUNT-1);expect(normalizeShelfPage(2.9)).toBe(2);
  for(const book of RAM_BOOKS)expect(book.pages.every(page=>page.startsWith('./assets/original/reading-books/')&&!page.includes('..'))).toBe(true);
 });
 it('gives each volume a distinct illustrated design and keeps the Gazette bindings consistent',()=>{
  const illustrated=RAM_BOOKS.filter(book=>!book.id.startsWith('gazette-')).map(bookSpine);
  expect(illustrated.every(spine=>spine.art?.startsWith('./assets/generated/reading-spines/'))).toBe(true);
  expect(new Set(illustrated.map(spine=>`${spine.art}:${spine.hue}`)).size).toBe(illustrated.length);
  expect(new Set(illustrated.map(spine=>spine.title)).size).toBe(illustrated.length);
  for(const book of RAM_BOOKS.filter(book=>book.id.startsWith('gazette-'))){
   expect(bookSpine(book)).toEqual({title:`${book.id.slice('gazette-'.length)}期`});
  }
 });
 it('keeps each placed shelf on its own page through movement, resizing and save parsing',()=>{
  let pet=placeFurniture(createPet('书友','pink',now),READING_SHELF_ID,35,60);
  pet=placeFurniture(pet,READING_SHELF_ID,65,60);
  const [first,second]=pet.room!.placed;
  const changed=changeReadingShelfPage(pet,first.instanceId!,3);
  expect(changed.room!.placed[0].shelfPage).toBe(3);expect(changed.room!.placed[1]).toBe(second);
  expect(changed.coins).toBe(pet.coins);expect(changed.createdAt).toBe(pet.createdAt);
  const moved=placeFurniture(changed,READING_SHELF_ID,42,70,first.instanceId,1.5);
  expect(moved.room!.placed[0]).toMatchObject({shelfPage:3,x:42,y:70,scale:1.5});
  expect(parseSave(JSON.stringify(moved),now)!.room!.placed[0].shelfPage).toBe(3);
  expect(changeReadingShelfPage(pet,'missing',2)).toBe(pet);
  expect(changeReadingShelfPage(pet,first.instanceId!,NaN)).toBe(pet);
  expect(normalizeRoom({owned:[],placed:[{id:READING_SHELF_ID,x:20,y:50,shelfPage:1e9},{id:'plant',x:15,y:70,shelfPage:3}]})!.placed).toEqual([{id:READING_SHELF_ID,x:20,y:50,shelfPage:SHELF_PAGE_COUNT-1},{id:'plant',x:15,y:70}]);
 });
 it('carries new book positions and a later furniture page through the existing JSON backup',()=>{
  let pet=placeFurniture(createPet('藏书家','blue',now),READING_SHELF_ID,40,60);
  pet=changeReadingShelfPage(pet,pet.room!.placed[0].instanceId!,8);
  pet={...pet,reading:bookmarkPage(bookmarkPage(undefined,'rescue',4),'library-216',6)};
  const entries=new Map<string,string>(),storage={getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>{entries.set(key,value)},removeItem:(key:string)=>{entries.delete(key)}};
  const restored=restorePetBackup(petBackupText(pet,createMemory(pet),storage),storage,now).pet;
  expect(restored.reading).toEqual(pet.reading);expect(restored.room).toEqual(pet.room);
 });
});

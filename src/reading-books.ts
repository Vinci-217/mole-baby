import catalog from '../public/assets/original/reading-books/catalog.json';
import {BOOKS_PER_SHELF_PAGE,SHELF_BOOKS_PER_ROW,normalizeShelfPage,type RamBookId} from './reading-progress';
export * from './reading-progress';

export interface RamBook {id:RamBookId;title:string;description:string;cover:string;pages:string[];source:string}
export const RAM_BOOKS:readonly RamBook[]=catalog as RamBook[];
const booksById=new Map(RAM_BOOKS.map(book=>[book.id,book]));
export const ramBook=(id:unknown)=>typeof id==='string'?booksById.get(id):undefined;
export function shelfBooks(page:unknown){
 const start=normalizeShelfPage(page)*BOOKS_PER_SHELF_PAGE;
 return RAM_BOOKS.slice(start,start+BOOKS_PER_SHELF_PAGE);
}
const spineHeights = [124, 114, 129, 111, 119, 128, 116, 122, 116, 128, 109, 119, 125, 115];
const spineWidths = [98, 91, 91, 98, 90, 96, 92, 95, 92, 97, 92, 97, 91, 94];

/** The two book rows sit on the lower edges of the 480 × 520 shelf recesses. */
export function shelfBookStyle(index: number, illustrated: boolean) {
  const slotWidth = (395 - 86) / SHELF_BOOKS_PER_ROW;
  const column = index % SHELF_BOOKS_PER_ROW;
  const ledge = index < SHELF_BOOKS_PER_ROW ? 262 : 427;
  return {
    left: `${(86 + column * slotWidth) / 480 * 100}%`,
    bottom: `${(520 - ledge) / 520 * 100}%`,
    width: `${slotWidth / 480 * 100}%`,
    height: `${(illustrated ? spineHeights[index] : 118) / 520 * 100}%`,
    '--spine-width': `${illustrated ? spineWidths[index] : 94}%`,
  };
}

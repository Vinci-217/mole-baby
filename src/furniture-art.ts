import data from '../public/assets/original/furniture/bounds.json';
import readingShelf from '../public/assets/original/reading-books/shelf-bounds.json';
interface FurnitureArt{imageWidth:number;imageHeight:number;left:number;top:number;width:number;height:number;mask:string|null}
const artwork=data as unknown as Record<string,FurnitureArt>;
const shelf=readingShelf as unknown as FurnitureArt;
const fallback:FurnitureArt={imageWidth:100,imageHeight:100,left:0,top:0,width:100,height:100,mask:null};
export function furnitureArt(id:string){return id==='reading-shelf'?shelf:artwork[id.startsWith('certificate-')?'certificate':id]??fallback}
/** Hit the visible source pixels, so transparent chair legs/curtain gaps do
 * not steal a click from another furnishing underneath. */
export function furnitureHit(id:string,x:number,y:number){
 if(x<0||y<0||x>=1||y>=1)return false;
 const {mask}=furnitureArt(id);if(!mask)return true;
 const row=Math.floor(y*32),column=Math.floor(x*32);
 // Each exported row is a big-endian 32-bit mask, with x=0 at its low bit.
 return Boolean(atob(mask).charCodeAt(row*4+3-(column>>3))&(1<<(column%8)));
}

import data from '../public/assets/original/furniture/bounds.json';
interface FurnitureArt{imageWidth:number;imageHeight:number;left:number;top:number;width:number;height:number;mask:string[]}
const artwork=data as Record<string,FurnitureArt>;
export function furnitureArt(id:string){return artwork[id.startsWith('certificate-')?'certificate':id]??{imageWidth:100,imageHeight:100,left:0,top:0,width:100,height:100,mask:Array(32).fill('ffffffff')}}
/** Hit the visible source pixels, so transparent chair legs/curtain gaps do
 * not steal a click from another furnishing underneath. */
export function furnitureHit(id:string,x:number,y:number){
 if(x<0||y<0||x>=1||y>=1)return false;
 const art=furnitureArt(id);return Boolean((parseInt(art.mask[Math.min(31,Math.floor(y*32))],16)>>>0)&(1<<Math.min(31,Math.floor(x*32))));
}

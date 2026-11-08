import {useState} from 'react';
import {createPet,type GameState,type Evolution} from '../game';
import {ALL_OUTFITS,buyOutfit,wearOutfit,type OutfitId} from '../wardrobe';
import Wardrobe from './Wardrobe';
import './WardrobePreview.css';
const FORMS=[['seed','种子'],['junior','初级'],['middle','中级'],['senior','高级'],['super','超级拉姆'],['classic','经典超级拉姆'],['water','水系'],['wood','木系'],['fire','火系']];
const params=new URLSearchParams(location.search),initialForm=FORMS.some(([id])=>id===params.get('form'))?params.get('form')!:'middle';
const previewOutfit=ALL_OUTFITS.find(outfit=>outfit.id===params.get('outfit')||outfit.sourceId===params.get('outfit'));
const growthFor=(form:string)=>({seed:0,junior:60,middle:180,senior:420} as Record<string,number>)[form]??840;
export default function WardrobePreview(){
 const [pet,setPet]=useState<GameState>(()=>{const growth=growthFor(initialForm);return {...createPet('试衣拉姆','blue'),growth,highestGrowth:growth,evolution:growth===840?initialForm as Evolution:undefined,growthLocked:true,coins:2000,wardrobe:[...new Set<OutfitId>(['party-cap','flower-crown',...(previewOutfit?[previewOutfit.id]:[])])],wearing:initialForm==='seed'?undefined:previewOutfit?.id??'flower-crown'}});
 return <main className="wardrobe-review-page"><header><h1>拉姆小衣橱</h1><p>点击装扮试穿，再试试摸摸、左右走动；也可以按住镜子里的拉姆拖动。</p><label>预览形态 <select aria-label="预览形态" defaultValue={initialForm} onChange={e=>{const form=e.target.value,growth=growthFor(form);setPet(p=>({...p,growth,evolution:growth===840?form as Evolution:undefined}))}}>{FORMS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></header><Wardrobe pet={pet} onBuy={id=>setPet(p=>buyOutfit(p,id).state)} onWear={id=>setPet(p=>wearOutfit(p,id).state)}/><footer>独立试衣预览，正式存档不会改变。</footer></main>;
}

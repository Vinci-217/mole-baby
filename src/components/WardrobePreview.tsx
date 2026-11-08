import {useState} from 'react';
import {createPet,type GameState,type Evolution} from '../game';
import {buyOutfit,wearOutfit} from '../wardrobe';
import Wardrobe from './Wardrobe';
import './WardrobePreview.css';
export default function WardrobePreview(){
 const [pet,setPet]=useState<GameState>(()=>({...createPet('试衣拉姆','blue'),growth:180,highestGrowth:180,growthLocked:true,coins:2000,wardrobe:['party-cap','flower-crown'],wearing:'flower-crown'}));
 return <main className="wardrobe-review-page"><header><h1>拉姆小衣橱</h1><p>点击装扮试穿，再试试摸摸、左右走动；也可以按住镜子里的拉姆拖动。</p><label>预览形态 <select aria-label="预览形态" defaultValue="middle" onChange={e=>{const form=e.target.value,growth=({seed:0,junior:60,middle:180,senior:420} as Record<string,number>)[form]??840;setPet(p=>({...p,growth,evolution:growth===840?form as Evolution:undefined}))}}>{[['seed','种子'],['junior','初级'],['middle','中级'],['senior','高级'],['super','超级拉姆'],['classic','经典超级拉姆'],['water','水系'],['wood','木系'],['fire','火系']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></header><Wardrobe pet={pet} onBuy={id=>setPet(p=>buyOutfit(p,id).state)} onWear={id=>setPet(p=>wearOutfit(p,id).state)}/><footer>独立试衣预览，正式存档不会改变。</footer></main>;
}

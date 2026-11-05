import {useState} from 'react';
import {createPet,parseSave,type GameState} from '../game';
import RestaurantWorkShowcase from './RestaurantWorkShowcase';
import {useRoomMedia} from '../room-media';
const KEY='ramu-restaurant-review-v1';
/** Explicit browser review mode. Never reads or writes the player's pet slot. */
export default function RestaurantPreview(){
 const [pet] = useState<GameState>(()=>{try{const saved=parseSave(localStorage.getItem(KEY));if(saved)return saved;}catch{}return {...createPet('小厨师','blue'),growth:180,highestGrowth:180,growthLocked:true,coins:3000};});
 useRoomMedia(true,true,'./assets/original/restaurant/audio/bgSound.mp3');
 return <><RestaurantWorkShowcase pet={pet} onClose={()=>location.assign('./')} /><div className="restaurant-preview-label">餐厅动画预览 · 不会修改正式存档</div></>;
}

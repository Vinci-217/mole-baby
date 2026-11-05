import {useRef,useState} from 'react';
import {createPet,parseSave,type GameState} from '../game';
import RestaurantGame from './RestaurantGame';
import {useRoomMedia} from '../room-media';
const KEY='ramu-restaurant-review-v1';
/** Explicit browser review mode. Never reads or writes the player's pet slot. */
export default function RestaurantPreview(){
 const [pet,setPet]=useState<GameState>(()=>{try{const saved=parseSave(localStorage.getItem(KEY));if(saved)return saved;}catch{}return {...createPet('小厨师','blue'),growth:180,highestGrowth:180,growthLocked:true,coins:3000};});
 const ref=useRef(pet);ref.current=pet;const [sound,setSound]=useState(true);
 useRoomMedia(true,true,'./assets/original/restaurant/audio/bgSound.mp3');
 return <><RestaurantGame pet={pet} getPet={()=>ref.current} onChange={next=>{ref.current=next;setPet(next);localStorage.setItem(KEY,JSON.stringify(next));}} onClose={()=>location.assign('./')} sound={sound} volume={.3} onToggleSound={()=>setSound(s=>!s)}/><div className="restaurant-preview-label">餐厅试玩 · 独立体验存档</div></>;
}

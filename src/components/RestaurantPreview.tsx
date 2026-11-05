import {useState} from 'react';
import {createPet,parseSave,type GameState} from '../game';
import RestaurantWorkShowcase from './RestaurantWorkShowcase';
import DesktopRestaurantWork from './DesktopRestaurantWork';
import {useRoomMedia} from '../room-media';
const KEY='ramu-restaurant-review-v1';
/** Explicit browser review mode. Never reads or writes the player's pet slot. */
export default function RestaurantPreview(){
 const desktop = new URLSearchParams(location.search).get('preview')==='desktop-work';
 const [working,setWorking]=useState(true);
 const [shiftStarted,setShiftStarted]=useState(Date.now);
 const [pet] = useState<GameState>(()=>{try{const saved=parseSave(localStorage.getItem(KEY));if(saved)return saved;}catch{}return {...createPet('小厨师','blue'),growth:180,highestGrowth:180,growthLocked:true,coins:3000};});
 useRoomMedia(!desktop,true,'./assets/original/restaurant/audio/bgSound.mp3');
 if(desktop)return <main className="restaurant-desktop-preview"><h1>桌面餐厅打工</h1><p>左边灶台，右边餐桌，拉姆往返送餐。</p><div className="restaurant-desktop-demo companion-layout"><div className="compact-pet">{working?<DesktopRestaurantWork pet={{...pet,activity:{id:'preview',kind:'restaurant',startedAt:shiftStarted,endsAt:shiftStarted+120000}}} onView={()=>location.assign('./?preview=restaurant')} onStop={()=>setWorking(false)}/>:<button className="game-button small" onClick={()=>{setShiftStarted(Date.now());setWorking(true)}}>再看一次</button>}</div></div><small>点击动画可以进入餐厅查看。</small></main>;
 return <><RestaurantWorkShowcase pet={pet} onClose={()=>location.assign('./')} /><div className="restaurant-preview-label">餐厅动画预览 · 不会修改正式存档</div></>;
}

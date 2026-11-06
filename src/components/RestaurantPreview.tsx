import {useEffect,useState} from 'react';
import {createPet,parseSave,type GameState} from '../game';
import RestaurantWorkShowcase from './RestaurantWorkShowcase';
import DesktopRestaurantWork from './DesktopRestaurantWork';
import {useRoomMedia} from '../room-media';
const KEY='ramu-restaurant-review-v1';
/** Explicit browser review mode. Never reads or writes the player's pet slot. */
export default function RestaurantPreview(){
 const params=new URLSearchParams(location.search),desktop=params.get('preview')==='desktop-work';
 const [working,setWorking]=useState(desktop||params.get('working')==='1');
 const [shiftStarted,setShiftStarted]=useState(Date.now);
 const [pet]=useState<GameState>(()=>{try{const saved=parseSave(localStorage.getItem(KEY));if(saved)return saved;}catch{}return {...createPet('小厨师','blue'),growth:180,highestGrowth:180,growthLocked:true,coins:3000};});
 useEffect(()=>{if(!working)return;const due=setTimeout(()=>setWorking(false),Math.max(0,shiftStarted+120000-Date.now()));return()=>clearTimeout(due)},[working,shiftStarted]);
 useRoomMedia(!desktop,true,working?'./assets/original/restaurant/audio/bgSound.mp3':undefined);
 const shown={...pet,activity:working?{id:'preview',kind:'restaurant' as const,startedAt:shiftStarted,endsAt:shiftStarted+120000}:undefined};
 if(desktop)return <main className="restaurant-desktop-preview"><h1>桌面餐厅打工</h1><p>取餐、端盘、送到餐桌，再空手返回。</p><div className="restaurant-desktop-demo companion-layout"><div className="compact-pet">{working?<DesktopRestaurantWork pet={shown} onView={()=>location.assign('./?preview=restaurant&working=1')} onStop={()=>setWorking(false)}/>:<button className="game-button small" onClick={()=>{setShiftStarted(Date.now());setWorking(true)}}>去餐厅打工</button>}</div></div></main>;
 return <><RestaurantWorkShowcase pet={shown} onClose={()=>location.assign('./?preview=desktop-work')}/><div className="restaurant-preview-label">餐厅状态预览 · 不会修改正式存档</div></>;
}

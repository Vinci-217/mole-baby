import {useLayoutEffect,useState} from 'react';
import {createPortal} from 'react-dom';
/** Keep the shortcut inside the game's focus trap as well as its visual layer. */
export default function GameSoundToggle({game,enabled,onToggle}:{game:string;enabled:boolean;onToggle:()=>void}){
 const [host,setHost]=useState<Element|null>(null);
 useLayoutEffect(()=>{setHost([...document.querySelectorAll('[role=dialog]')].at(-1)??null)},[game]);
 return host?createPortal(<button className="game-sound-toggle" aria-label="游戏音效" aria-pressed={enabled} onClick={onToggle}>{enabled?'♫ 音效开':'♫ 音效关'}</button>,host):null;
}

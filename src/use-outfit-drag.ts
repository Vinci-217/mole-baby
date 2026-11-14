import {useEffect,useState,type RefObject} from 'react';

export type OutfitDragAction='idle'|'walk-left'|'walk-right';

/** Use the existing drag spring's direction; keep the source's original
 * walk timeline instead of rotating an idle pose to imitate a turn. */
export function outfitDragAction(view:number,speed:number,previous:OutfitDragAction='idle'):OutfitDragAction {
 if(!Number.isFinite(view)||!Number.isFinite(speed)||speed<12)return 'idle';
 if(view<-.14)return 'walk-left';
 if(view>.14)return 'walk-right';
 return previous;
}

export function useOutfitDrag(root:RefObject<HTMLElement|null>,dragging:boolean){
 const [pose,setPose]=useState<OutfitDragAction>('idle');
 useEffect(()=>{
  if(!dragging){setPose('idle');return;}
  const sprite=root.current?.closest<HTMLElement>('.ram-sprite');
  if(!sprite)return;
  const sample=()=>{
   const view=parseFloat(sprite.style.getPropertyValue('--drag-view'))||0;
   const speed=parseFloat(sprite.style.getPropertyValue('--drag-horizontal-speed'))||0;
   setPose(previous=>outfitDragAction(view,speed,previous));
  };
  sprite.addEventListener('ram-drag-motion',sample);sample();
  return()=>sprite.removeEventListener('ram-drag-motion',sample);
 },[root,dragging]);
 return dragging?pose:'idle';
}

import {Component,lazy,Suspense,type ReactNode} from 'react';

const furnishings=()=>import('./components/RoomFurnishings');
export const RoomFurnishingLayer=lazy(async()=>({default:(await furnishings()).RoomFurnishingLayer}));
export const RoomFurnishingEditor=lazy(async()=>({default:(await furnishings()).RoomFurnishingEditor}));
export const OriginalReadingBook=lazy(()=>import('./components/OriginalReadingBook'));
export const ShopBook=lazy(()=>import('./components/ShopBook'));
export const Wardrobe=lazy(()=>import('./components/Wardrobe'));
export const PetDiary=lazy(()=>import('./components/PetDiary'));
export const RestaurantWorkShowcase=lazy(()=>import('./components/RestaurantWorkShowcase'));
export const FruitGame=lazy(()=>import('./components/FruitGame'));
export const MemoryGame=lazy(()=>import('./components/MemoryGame'));
export const TreasureGame=lazy(()=>import('./components/TreasureGame'));
export const MoreGames=lazy(()=>import('./components/MoreGames'));
export const ColorMixerGame=lazy(()=>import('./components/ColorMixerGame'));

export class DeferredView extends Component<{children:ReactNode;quiet?:boolean;onClose?:()=>void},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){
  const {children,quiet,onClose}=this.props;
  const fallback=<div className={`deferred-view-status${onClose?' deferred-view-popup':''}`} role={this.state.failed?'alert':'status'}>
   <span>{this.state.failed?'暂时无法打开。':'正在打开…'}</span>
   {this.state.failed&&<button type="button" className="game-button small" onClick={()=>location.reload()}>重新加载</button>}
   {onClose&&<button type="button" className="round-close" aria-label="关闭面板" onClick={onClose}>×</button>}
  </div>;
  if(this.state.failed)return fallback;
  return <Suspense fallback={quiet?null:fallback}>
   {children}
  </Suspense>;
 }
}

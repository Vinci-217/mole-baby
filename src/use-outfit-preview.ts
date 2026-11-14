import {useCallback,useEffect,useSyncExternalStore} from 'react';
import type {RamForm} from './original-actions';
import type {OfficialClip} from './official-clips';
import {officialViewportScale} from './original-viewport';
import {loadOutfitPreview,outfitPreview,outfitPreviewKey,subscribeOutfitPreview} from './outfit-preview-cache';

export const outfitPreviewSource=(clip:OfficialClip,form:RamForm,bodyForm:RamForm,finite=false,registerBody=true)=>`v12:${clip.sha256}:${clip.id}:${form}:${bodyForm}:${finite}:${registerBody}:${officialViewportScale(clip)}`;
export function useOutfitPreview(source:string,color:readonly number[],enabled=true){
 const key=enabled?outfitPreviewKey(source,color):'';
 const subscribe=useCallback((listener:()=>void)=>key?subscribeOutfitPreview(key,listener):()=>{},[key]);
 const snapshot=useCallback(()=>key?outfitPreview(key):undefined,[key]);
 const image=useSyncExternalStore(subscribe,snapshot,()=>undefined);
 useEffect(()=>{if(key&&!image)void loadOutfitPreview(key)},[key,Boolean(image)]);
 return image;
}

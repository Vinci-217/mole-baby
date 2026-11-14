import type {OfficialClip} from './official-clips';

/** Only warm the chosen local source. The existing protocol/HTTP cache owns
 * the bytes; this module retains promises, never another full asset library. */
const requests=new Map<string,Promise<void>>();
export function preloadOriginalOutfit(clip:OfficialClip){
 const found=requests.get(clip.sha256);if(found)return found;
 const root=window.desktop?.isElectron?'ram-original://assets/':'./assets/original/official/';
 const files=['files/'+clip.path,...(clip.base?['files/resource/NPC/lamubone.swf']:[])];
 const ready=Promise.all(files.map(async file=>{
  const response=await fetch(root+file,{cache:'force-cache'});
  if(!response.ok)throw Error('Original outfit unavailable');await response.arrayBuffer();
 })).then(()=>{}).catch(error=>{requests.delete(clip.sha256);throw error});
 requests.set(clip.sha256,ready);
 while(requests.size>8)requests.delete(requests.keys().next().value!);
 return ready;
}

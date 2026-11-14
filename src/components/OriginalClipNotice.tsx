import {useEffect,useState,type RefObject} from 'react';
import {exportAnimationLoadLog} from '../animation-log';

/** Load feedback belongs beside the mirror, outside the character hit area. */
export default function OriginalClipNotice({mirror}:{mirror:RefObject<HTMLElement|null>}){
 const [status,setStatus]=useState('');
 useEffect(()=>{
  const root=mirror.current;if(!root)return;
  const read=()=>{const clip=[...root.querySelectorAll<HTMLElement>('.official-ram-clip')].find(node=>node.getClientRects().length>0);setStatus(!clip||clip.classList.contains('is-ready')?'':clip.classList.contains('is-failed')?'failed':clip.querySelector('[data-cached-original=true]')?'':'loading')};
  const observer=new MutationObserver(read);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});read();return()=>observer.disconnect();
 },[mirror]);
 return <div className="wardrobe-load-notice"><span role="status">{status==='loading'?'正在加载原版动画，首次打开可能稍慢。':status==='failed'?'原版动画尚未加载完成。':null}</span><div className="wardrobe-load-actions">{status==='failed'&&<button type="button" onClick={()=>mirror.current?.querySelector('.official-ram-clip')?.dispatchEvent(new Event('ram-original-retry'))}>重新加载</button>}<button type="button" onClick={exportAnimationLoadLog}>导出动画日志</button></div></div>;
}

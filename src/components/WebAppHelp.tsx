import {useState,useSyncExternalStore} from 'react';
import {subscribeWebCache,webCacheState} from '../web-app';
import './WebAppHelp.css';

export default function WebAppHelp({compact=false}:{compact?:boolean}){
 const cache=useSyncExternalStore(subscribeWebCache,webCacheState),[storage,setStorage]=useState('');
 async function persist(){
  try{setStorage(await navigator.storage?.persist?.()?'已申请保留本地数据，仍建议定期导出备份。':'浏览器暂未授予长期存储，请定期导出存档。')}
  catch{setStorage('暂时无法申请长期存储，请先导出存档备份。')}
 }
 return <details className={`web-app-help ${compact?'is-compact':''}`} open={!compact}>
  <summary>添加到主屏幕 · 网页存档</summary>
  <p>iPhone／iPad：用 Safari 打开，点击“分享”→“添加到主屏幕”。安卓和电脑可在浏览器菜单中选择“安装应用”或“添加到主屏幕”。</p>
  <p>苹果主屏幕版与 Safari 的存档各自独立。建议先添加到主屏幕，再领养；已有拉姆请先导出存档，在主屏幕版导入。</p>
  {!compact&&<><p>存档保存在当前浏览器的此网站数据中，换浏览器或访问地址前请导出备份。已缓存的近期素材可以离线使用，新动作首次使用需要联网。</p>
   <p className="web-cache-status" role="status">{cache==='ready'?'离线页面已就绪，素材按需缓存。':cache==='update-ready'?'新版已准备好，关闭所有拉姆网页后重新打开即可更新。':cache==='unavailable'?'当前浏览器未启用离线缓存，仍可在线使用。':'正在准备离线页面……'}</p>
   {typeof navigator.storage?.persist==='function'&&<button className="game-button small" type="button" onClick={()=>void persist()}>申请保留本地数据</button>}
   {storage&&<p role="status">{storage}</p>}
  </>}
 </details>;
}

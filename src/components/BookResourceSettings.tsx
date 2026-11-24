import {useState} from 'react';
import type {BookDownloads} from '../book-downloads';

export default function BookResourceSettings({downloads,status,unavailable}:{downloads:BookDownloads;status?:BookDownloadStatus;unavailable:boolean}){
 const [failed,setFailed]=useState(false);
 if(!status)return <p role={unavailable?'alert':'status'}>{unavailable?'暂时无法读取图书缓存。':'正在读取图书缓存…'}</p>;

 const complete=status.downloaded===status.total;
 const active=status.phase==='downloading'||status.phase==='pausing';
 const remaining=Math.ceil((status.totalBytes-status.downloadedBytes)/1048576);
 const action=status.phase==='paused'||status.phase==='error'?'继续下载':'下载全部图书';
 const count=`已下载 ${status.downloaded} / ${status.total} 本`;
 const message=failed||status.phase==='error'?`${count}，下载失败，请重试。`:count;
 return <>
  <div className="settings-row">
   <span role={failed||status.phase==='error'?'alert':'status'}>{message}</span>
   {active?<button type="button" className="game-button small" disabled={status.phase==='pausing'}
    onClick={()=>void downloads.pauseAll().catch(()=>setFailed(true))}>{status.phase==='pausing'?'正在暂停…':'暂停'}</button>:
    !complete&&<button type="button" className="game-button small"
     onClick={()=>{setFailed(false);void downloads.downloadAll().catch(()=>setFailed(true))}}>{action} · 约 {remaining} MiB</button>}
  </div>
  {active&&<progress aria-label="图书素材下载进度" value={status.downloadedBytes} max={status.totalBytes}/>}
 </>;
}

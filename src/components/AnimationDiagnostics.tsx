import {useEffect,useState} from 'react';
import {exportAnimationLoadLog} from '../animation-log';

export default function AnimationDiagnostics(){
 const [summary,setSummary]=useState<{count:number;bytes:number}|null>(null);
 useEffect(()=>{let live=true;void fetch('./offline-resources.json').then(response=>response.ok?response.json():null).then(index=>{if(live&&Array.isArray(index?.files))setSummary({count:index.files.length,bytes:index.bytes})}).catch(()=>{});return()=>{live=false}},[]);
 const installed=Boolean(window.desktop||window.mobile);
 return <div className="animation-diagnostics">
  <p className="settings-hint">{installed?'游戏素材已随安装包保存到本机，日常播放无需联网下载。':'当前是网页预览，首次打开需要加载素材；安装版的游戏素材已内置。'}{summary&&` 本版包含 ${summary.count} 个本地文件，共 ${(summary.bytes/1048576).toFixed(1)} MiB。`}</p>
  <div className="settings-actions"><button type="button" className="game-button small" onClick={exportAnimationLoadLog}>导出动画日志</button></div>
 </div>;
}

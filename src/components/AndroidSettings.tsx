import {useEffect,useState} from 'react';
import type {AndroidPermissions} from '../android-host';
export default function AndroidSettings(){
  const[state,setState]=useState<AndroidPermissions|null>(null),[message,setMessage]=useState('');
  useEffect(()=>{let active=true;const refresh=()=>{void window.mobile?.permissions().then(v=>{if(active)setState(v)}).catch(()=>{if(active)setMessage('暂时无法读取系统设置。')});};refresh();const off=window.mobile?.on('permissions',refresh);return()=>{active=false;off?.();};},[]);
  if(!window.mobile)return null;
  const request=(kind:Parameters<NonNullable<Window['mobile']>['requestPermission']>[0])=>{setMessage('');void window.mobile!.requestPermission(kind).catch(error=>setMessage(error.message));};
  return <section className="android-settings" aria-label="安卓陪伴设置"><h3>手机与平板陪伴</h3>
    <p>小屋里可以直接照料、学习和玩游戏。允许悬浮窗后，拉姆也能陪你使用其他应用。</p>
    <div className="settings-row"><span>悬浮窗</span><button className="game-button small" onClick={()=>request('overlay')}>{state?.overlay?'已允许 · 系统设置':'去允许'}</button></div>
    <div className="settings-row"><span>课程与专注通知</span><button className="game-button small" onClick={()=>request('notifications')}>{state?.notifications?'已允许 · 系统设置':'去允许'}</button></div>
    <div className="settings-row"><span>准时提醒</span><button className="game-button small" onClick={()=>request('alarms')}>{state?.exactAlarms?'已允许 · 系统设置':'设置精确闹钟'}</button></div>
    <div className="settings-row"><span>悬浮窗触摸穿透</span><button role="switch" aria-label="悬浮窗触摸穿透" aria-checked={state?.touchThrough===true} disabled={!state?.overlay} onClick={()=>{void window.desktop?.setMouseThrough(!state?.touchThrough).then(()=>window.mobile!.permissions()).then(setState).catch(error=>setMessage(error.message));}}>{state?.touchThrough?'开启':'关闭'}</button></div>
    <p>穿透后，可从通知栏点“恢复触摸”。锁屏、省电或系统清理可能暂停陪伴；强制停止后，需要再次打开拉姆。</p>
    <button className="game-button small" onClick={()=>request('battery')}>后台省电设置</button>
    <div className="settings-row"><span>Wi-Fi 下自动下载更新</span><button role="switch" aria-label="Wi-Fi 下自动下载更新" aria-checked={state?.autoDownloadWifi===true} onClick={()=>{void window.mobile?.setAutoDownloadWifi(!state?.autoDownloadWifi).then(setState).catch(error=>setMessage(error.message));}}>{state?.autoDownloadWifi?'开启':'关闭'}</button></div>
    <p>更新会在启动后检查；差量不适用时自动改用完整包。自动下载默认关闭，开启后仅使用非计费的 Wi-Fi；APK 安装始终由系统征求确认。</p>
    <button className="game-button small" onClick={()=>{void window.mobile?.cancelUpdate();}}>取消正在下载的更新</button>
    {message&&<p role="alert">{message}</p>}
  </section>;
}

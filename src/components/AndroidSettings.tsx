import {useEffect,useState} from 'react';
import type {AndroidPermissions} from '../android-host';
import SettingsSwitch from './SettingsSwitch';
export default function AndroidSettings(){
  const[state,setState]=useState<AndroidPermissions|null>(null),[message,setMessage]=useState('');
  useEffect(()=>{
    const mobile=window.mobile;if(!mobile)return;
    let active=true,received=false;
    const off=mobile.on('permissions',value=>{received=true;if(active)setState(value as unknown as AndroidPermissions)});
    void mobile.permissions().then(value=>{if(active&&!received)setState(value)},()=>{if(active&&!received)setMessage('暂时无法读取系统设置。')});
    return()=>{active=false;off()};
  },[]);
  if(!window.mobile)return null;
  const request=(kind:Parameters<NonNullable<Window['mobile']>['requestPermission']>[0])=>{setMessage('');void window.mobile!.requestPermission(kind).catch(error=>setMessage(error.message));};
  return <section className="android-settings" aria-label="安卓陪伴设置"><h3>手机与平板陪伴</h3>
    <div className="settings-row"><span>悬浮窗</span><button className="game-button small" aria-label="设置悬浮窗权限" onClick={()=>request('overlay')}>{state?.overlay?'已允许 · 系统设置':'去允许'}</button></div>
    <div className="settings-row"><span>课程与专注通知</span><button className="game-button small" aria-label="设置通知权限" onClick={()=>request('notifications')}>{state?.notifications?'已允许 · 系统设置':'去允许'}</button></div>
    <div className="settings-row"><span>准时提醒</span><button className="game-button small" aria-label="设置准时提醒权限" onClick={()=>request('alarms')}>{state?.exactAlarms?'已允许 · 系统设置':'设置精确闹钟'}</button></div>
    <SettingsSwitch label="悬浮窗触摸穿透" checked={state?.touchThrough===true} disabled={!state?.overlay}
      onChange={enabled=>{void window.desktop?.setMouseThrough(enabled).then(()=>window.mobile!.permissions()).then(setState).catch(error=>setMessage(error.message));}}/>
    {state?.touchThrough&&<p>可从通知栏恢复触摸。</p>}
    <button className="game-button small" onClick={()=>request('battery')}>后台省电设置</button>
    <SettingsSwitch label="Wi-Fi 下自动下载更新" checked={state?.autoDownloadWifi===true}
      onChange={enabled=>{void window.mobile?.setAutoDownloadWifi(enabled).then(setState).catch(error=>setMessage(error.message));}}/>
    {message&&<p role="alert">{message}</p>}
  </section>;
}

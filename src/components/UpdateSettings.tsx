import{useEffect,useState}from'react'
import SettingsSwitch from './SettingsSwitch'
import './UpdateSettings.css'
const megabytes=(bytes:number)=>`${(bytes/1000000).toFixed(1)} MB`
export default function UpdateSettings(){
 const[state,setState]=useState<UpdateState|null>(null),[failure,setFailure]=useState(false)
 useEffect(()=>{const api=window.desktop?.updates;if(!api)return;let active=true,received=false;const off=api.onStateChanged(next=>{received=true;if(active)setState(next)});void api.getState().then(next=>{if(active&&!received)setState(next)}).catch(()=>{});return()=>{active=false;off()}},[])
 if(!state)return null
 const busy=['disabled','checking','downloading','installing'].includes(state.status)
 const run=(task:()=>Promise<unknown>)=>{setFailure(false);void task().catch(()=>setFailure(true))}
 return <section className="update-settings" aria-label="软件更新">
  <div className="update-heading"><strong>软件更新</strong><span>v{state.currentVersion}{state.version&&` → v${state.version}`}</span></div>
  <SettingsSwitch rowClassName="update-switch" label="启动时检查更新" checked={state.enabled}
   disabled={state.status==='disabled'||state.status==='installing'} onChange={enabled=>run(()=>window.desktop!.updates.setEnabled(enabled))}/>
  {state.status!=='disabled'&&<div className="update-policy" role="group" aria-label="更新下载策略"><span>下载方式</span><div>{([['auto','自动选择','有合适的文件时使用差量下载'],['full','完整包','下载完整的主包']] as const).map(([id,label,description])=><button type="button" key={id} title={description} aria-pressed={(state.downloadPolicy??'auto')===id} disabled={['downloading','installing'].includes(state.status)} onClick={()=>run(()=>window.desktop!.updates.setDownloadPolicy(id))}>{label}</button>)}</div></div>}
  <p role="status">{failure?'操作暂时未完成，请重试。':state.message}</p>
  {state.status==='downloading'&&<progress aria-label="更新下载进度" max={100} value={state.percent}/>}
  {['downloading','ready'].includes(state.status)&&state.downloadMode&&<p className="update-transfer">{state.downloadMode==='cached'?'使用已校验的本地更新包':`${state.downloadMode==='differential'?'增量下载':'完整下载'} · ${megabytes(state.transferredBytes??0)}${state.totalBytes?` / ${megabytes(state.totalBytes)}`:''}`}{state.status==='ready'&&Boolean(state.reusedBytes)&&` · 复用本地 ${megabytes(state.reusedBytes!)}`}</p>}
  <div className="update-buttons"><button className="game-button small" disabled={busy} onClick={()=>run(()=>window.desktop!.updates.check())}>检查更新</button>
   {state.status==='available'&&<button className="game-button small" onClick={()=>run(()=>window.desktop!.updates.download())}>确认下载更新</button>}
   {state.status==='downloading'&&window.mobile&&<button className="game-button small" onClick={()=>run(()=>window.mobile!.cancelUpdate())}>取消下载</button>}
   {state.status==='ready'&&<button className="game-button small" onClick={()=>run(()=>window.desktop!.updates.install())}>{state.automaticInstall?'确认更新并重启':window.desktop?.platform==='darwin'?'打开 DMG 安装':'确认打开安装包'}</button>}
   {state.status==='error'&&window.mobile&&<button className="game-button small" onClick={()=>run(()=>window.desktop!.updates.download())}>重试下载</button>}
   {state.status==='error'&&<button className="game-button small" onClick={()=>run(()=>window.desktop!.updates.openRelease())}>打开下载页</button>}
  </div>
 </section>
}

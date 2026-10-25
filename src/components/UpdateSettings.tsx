import{useEffect,useState}from'react'
import './UpdateSettings.css'
export default function UpdateSettings(){
 const[state,setState]=useState<UpdateState|null>(null),[failure,setFailure]=useState(false)
 useEffect(()=>{const api=window.desktop?.updates;if(!api)return;let active=true,received=false;const off=api.onStateChanged(next=>{received=true;if(active)setState(next)});void api.getState().then(next=>{if(active&&!received)setState(next)}).catch(()=>{});return()=>{active=false;off()}},[])
 if(!state)return null
 const busy=['disabled','checking','downloading','installing'].includes(state.status)
 const run=(task:()=>Promise<unknown>)=>{setFailure(false);void task().catch(()=>setFailure(true))}
 return <section className="update-settings" aria-label="软件更新">
  <div className="update-heading"><strong>软件更新</strong><span>v{state.currentVersion}{state.version&&` → v${state.version}`}</span></div>
  <label className="update-switch"><span>启动时自动更新</span><input type="checkbox" aria-label="启动时自动更新" checked={state.enabled} disabled={state.status==='disabled'||state.status==='installing'} onChange={e=>run(()=>window.desktop!.updates.setEnabled(e.target.checked))}/></label>
  <p role="status">{failure?'操作暂时未完成，请重试。':state.message}</p>
  {state.status==='downloading'&&<progress aria-label="更新下载进度" max={100} value={state.percent}/>}
  <div className="update-buttons"><button className="game-button small" disabled={busy} onClick={()=>run(()=>window.desktop!.updates.check())}>检查更新</button>
   {state.status==='available'&&<button className="game-button small" onClick={()=>run(()=>window.desktop!.updates.download())}>下载更新</button>}
   {state.status==='ready'&&<button className="game-button small" onClick={()=>run(()=>window.desktop!.updates.install())}>{state.automaticInstall?'立即更新并重启':'打开更新安装包'}</button>}
  </div>
  {!state.automaticInstall&&state.status!=='disabled'&&<p className="update-note">{window.desktop?.platform==='darwin'?'此 Mac 版本会自动下载；请打开安装包完成更新。':'便携版会自动下载；安装后即可自动完成后续更新。'}</p>}
 </section>
}

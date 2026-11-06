import {localDebugAvailable,localDebugEnabled,setLocalDebug} from '../local-debug';
import './LocalDebugSwitch.css';
export default function LocalDebugSwitch(){
 if(!localDebugAvailable())return null;
 const enabled=localDebugEnabled();
 return <aside className="local-debug-switch" aria-label="本地调试工具">
  {enabled&&<span>调试中 · 独立测试存档 · 全形态已解锁</span>}
  <label><input type="checkbox" role="switch" aria-label="本地调试" checked={enabled} onChange={e=>setLocalDebug(e.target.checked)}/>本地调试</label>
 </aside>;
}

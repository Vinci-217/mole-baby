import {useEffect,useRef,useState} from 'react';
import {parseSave} from '../game';
import {PET_SAVE_KEY} from '../pet-backup';

type Inspection=Awaited<ReturnType<NonNullable<NonNullable<Window['desktop']>['localSaves']>['inspect']>>;
export default function LocalSaveInspector({onRestore,busy=false}:{onRestore:(text:string)=>Promise<boolean>;busy?:boolean}){
 const [info,setInfo]=useState<Inspection|null>(null),[status,setStatus]=useState(''),[error,setError]=useState(''),[checking,setChecking]=useState(false),[restoring,setRestoring]=useState(false);
 const errorNotice=useRef<HTMLParagraphElement>(null),checked=useRef(false),checkRequest=useRef(0);
 useEffect(()=>{if(error)errorNotice.current?.scrollIntoView({block:'nearest'})},[error]);
 const check=async()=>{
  const request=++checkRequest.current;checked.current=true;
  setError('');setChecking(true);setStatus('正在检查本地存档…');
  try{const raw=localStorage.getItem(PET_SAVE_KEY),pet=raw?parseSave(raw):null;
   const local=await window.desktop?.localSaves?.inspect();
   if(checkRequest.current!==request)return;
   setStatus(pet?`已找到存档 · ${pet.name}`:raw?'存档暂时无法读取，请先导出原始记录。':'当前未找到拉姆存档。');
   setInfo(local??null);
  }catch{if(checkRequest.current===request){setInfo(null);setStatus('');setError('检查暂未完成，请重试。')}}
  finally{if(checkRequest.current===request)setChecking(false)}
 };
 useEffect(()=>{
  const refreshed=()=>{if(checked.current)void check()};
  window.addEventListener('ram-save-imported',refreshed);
  return()=>{checkRequest.current++;window.removeEventListener('ram-save-imported',refreshed)};
 },[]);
 const open=async(kind:'profile'|'backups')=>{setError('');try{const message=await window.desktop!.localSaves!.openFolder(kind);if(message)throw Error(message)}catch{setError('暂时无法打开目录，请复制下方路径在文件管理器中打开。')}};
 const restore=async(profile:string)=>{setError('');setRestoring(true);try{const text=await window.desktop!.localSaves!.read(profile);if(!text)throw Error();await onRestore(text)}catch{setError('这份备份暂时无法读取。')}finally{setRestoring(false)}};
 return <div className="local-save-inspector">
  <button type="button" className="game-button small" disabled={busy||checking||restoring} onClick={()=>void check()}>{checking?'正在检查…':'检查本地存档'}</button>
  {status&&<p role="status" className="settings-hint">{status}</p>}
  {info?<><dl className="local-save-paths"><dt>当前存档目录</dt><dd>{info.profileDirectory}</dd><dt>独立备份目录</dt><dd>{info.backupDirectory}</dd></dl>
   <div className="settings-actions"><button type="button" className="game-button small" onClick={()=>void open('profile')}>打开存档目录</button><button type="button" className="game-button small" onClick={()=>void open('backups')}>打开备份目录</button></div>
   {!info.profiles.some(profile=>profile.hasBackup)&&<p className="settings-hint">未找到可导入的独立备份。可以选择之前导出的 JSON 存档。</p>}
   {info.profiles.filter(profile=>profile.hasBackup).map(profile=><p className="settings-hint" key={profile.directory}>{profile.active?'当前目录备份':'旧版本目录备份'} · {profile.backupAt?new Date(profile.backupAt).toLocaleString():''}<br/>{profile.directory}<br/><button type="button" className="game-button small" disabled={busy||checking||restoring} onClick={()=>void restore(profile.directory)}>导入这份备份</button></p>)}
   {info.profiles.filter(profile=>!profile.active&&profile.hasBrowserData&&!profile.hasBackup).map(profile=><p className="settings-hint" key={profile.directory}>另找到旧版本浏览器存储：{profile.directory}。请先保留整个目录；使用旧版打开后导出 JSON，再在这里导入，勿手动替换正在使用的 LevelDB 文件。</p>)}
  </>:null}
  {error&&<p ref={errorNotice} role="alert">{error}</p>}
 </div>;
}

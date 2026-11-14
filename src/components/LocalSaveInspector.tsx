import {useEffect,useState} from 'react';
import {parseSave} from '../game';
import {PET_SAVE_KEY} from '../pet-backup';

type Inspection=Awaited<ReturnType<NonNullable<NonNullable<Window['desktop']>['localSaves']>['inspect']>>;
export default function LocalSaveInspector({onRestore}:{onRestore:(text:string)=>void|Promise<void>}){
 const [info,setInfo]=useState<Inspection|null>(null),[status,setStatus]=useState(''),[error,setError]=useState('');
 const check=async()=>{
  setError('');
  try{const raw=localStorage.getItem(PET_SAVE_KEY),pet=raw?parseSave(raw):null;
   setStatus(pet?`已找到本地存档 · ${pet.name} · ${new TextEncoder().encode(raw!).length.toLocaleString()} 字节`:raw?'已有存档暂时无法读取；原文件保留，请先导出原始记录。':'当前浏览器存储未找到拉姆存档。');
   if(window.desktop?.localSaves)setInfo(await window.desktop.localSaves.inspect());
  }catch{setError('检查暂未完成，请重试；原存档不会被清理。')}
 };
 useEffect(()=>{void check()},[]);
 const open=async(kind:'profile'|'backups')=>{try{const message=await window.desktop!.localSaves!.openFolder(kind);if(message)throw Error(message)}catch{setError('暂时无法打开目录，请复制下方路径在文件管理器中打开。')}};
 const restore=async(profile:string)=>{try{const text=await window.desktop!.localSaves!.read(profile);if(!text)throw Error();await onRestore(text);await check()}catch{setError('该备份暂时无法读取，当前拉姆保持不变。')}};
 return <div className="local-save-inspector">
  <p role="status" className="settings-hint">{status}</p>
  <button type="button" className="game-button small" onClick={()=>void check()}>检查本地存档</button>
  {info?<><dl className="local-save-paths"><dt>当前存档目录</dt><dd>{info.profileDirectory}</dd><dt>独立备份目录</dt><dd>{info.backupDirectory}</dd></dl>
   <div className="settings-actions"><button type="button" className="game-button small" onClick={()=>void open('profile')}>打开存档目录</button><button type="button" className="game-button small" onClick={()=>void open('backups')}>打开备份目录</button></div>
   {info.profiles.filter(profile=>profile.hasBackup).map(profile=><p className="settings-hint" key={profile.directory}>{profile.active?'当前目录备份':'旧版本目录备份'} · {profile.backupAt?new Date(profile.backupAt).toLocaleString():''}<br/>{profile.directory}<br/><button type="button" className="game-button small" onClick={()=>void restore(profile.directory)}>导入这份备份</button></p>)}
   {info.profiles.filter(profile=>!profile.active&&profile.hasBrowserData&&!profile.hasBackup).map(profile=><p className="settings-hint" key={profile.directory}>另找到旧版本浏览器存储：{profile.directory}。请先保留整个目录；使用旧版打开后导出 JSON，再在这里导入，勿手动替换正在使用的 LevelDB 文件。</p>)}
  </>:<p className="settings-hint">{window.mobile?'手机版存档保存在应用的私有数据区。':'网页版存档保存在当前浏览器的此网站数据中，换浏览器或访问地址会使用不同的记录。'}导出 JSON 后妥善保存，需要迁移时点击“导入存档”。</p>}
  <p className="settings-hint">覆盖安装、完整更新和差量更新都保留存档。导入前会备份现有记录；桌面版也会保存独立备份，浏览器存储意外缺失时先恢复备份。</p>
  {error&&<p role="alert">{error}</p>}
 </div>;
}

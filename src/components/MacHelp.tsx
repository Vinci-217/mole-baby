import { useState } from 'react';
export default function MacHelp(){
 const [message,setMessage]=useState('');
 if(window.desktop?.platform!=='darwin')return null;
 async function open(kind:'security'|'dictation'|'guide'){
  try{if(kind==='guide')await window.desktop?.openMacGuide();else await window.desktop?.openMacSettings(kind);setMessage(kind==='security'?'在隐私与安全中找到拉姆，按系统提示确认。':kind==='dictation'?'在键盘设置中开启中文听写，再回到对话输入框。':'打开说明后可查看安装与首次启动步骤。');}
  catch(error){setMessage(error instanceof Error?error.message:'请从苹果菜单手动进入系统设置。');}
 }
 return <section className="mac-help" aria-label="Mac 使用帮助"><h3>Mac 使用帮助</h3><p>首次打开被拦截，或语音输入不可用时，可从这里进入对应设置。</p><div><button className="game-button small" onClick={()=>void open('security')}>打开隐私与安全</button><button className="game-button small" onClick={()=>void open('dictation')}>打开听写设置</button><button className="game-button small" onClick={()=>void open('guide')}>首次打开说明</button></div>{message&&<p role="status">{message}</p>}</section>;
}

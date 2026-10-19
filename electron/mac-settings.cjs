const fs=require('node:fs'),path=require('node:path');
const SETTINGS={security:'x-apple.systempreferences:com.apple.preference.security?General',dictation:'x-apple.systempreferences:com.apple.preference.keyboard?Dictation'};
function createMacHelp({platform,shell,guidePath,guideDirectory}){
  return {
    async openSettings(kind){
      if(platform!=='darwin')throw Error('这个入口仅在 Mac 上使用。');
      if(!Object.hasOwn(SETTINGS,kind))throw Error('不支持的系统设置入口。');
      try{await shell.openExternal(SETTINGS[kind]);}catch{try{await shell.openExternal('x-apple.systempreferences:');}catch{throw Error('未能打开系统设置，请从苹果菜单手动进入。');}}
      return true;
    },
    async openGuide(){
      if(platform!=='darwin')throw Error('这个入口仅在 Mac 上使用。');
      // External browsers cannot read Electron's virtual app.asar paths.
      const directory=guideDirectory();fs.mkdirSync(directory,{recursive:true});const target=path.join(directory,'Mac 打开说明.html');fs.copyFileSync(guidePath,target);
      const error=await shell.openPath(target);if(error)throw Error('说明未能打开，请查看 GitHub 发布页的 Mac 安装指引。');return true;
    },
  };
}
module.exports={SETTINGS,createMacHelp};

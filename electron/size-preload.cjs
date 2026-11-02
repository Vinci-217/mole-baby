const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('petSize',Object.freeze({get:()=>ipcRenderer.invoke('desktop:size-dialog-get'),save:percent=>ipcRenderer.invoke('desktop:size-dialog-save',percent)}));

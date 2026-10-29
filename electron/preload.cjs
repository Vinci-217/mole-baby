const { contextBridge, ipcRenderer } = require('electron');

function subscribeToState(channel, callback, selectInitial) {
  if (typeof callback !== 'function') throw new TypeError('A callback is required');
  let active = true;
  let receivedEvent = false;
  const listener = (_event, value) => {
    receivedEvent = true;
    if (active) callback(value);
  };
  ipcRenderer.on(channel, listener);
  ipcRenderer.invoke('desktop:get-state').then((state) => {
    if (active && !receivedEvent) callback(selectInitial(state));
  }).catch(() => {});
  return () => {
    active = false;
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  isElectron: true,
  updates:Object.freeze({
    openRelease:()=>ipcRenderer.invoke('updates:open-release'),
    getState:()=>ipcRenderer.invoke('updates:get-state'),check:()=>ipcRenderer.invoke('updates:check'),download:()=>ipcRenderer.invoke('updates:download'),install:()=>ipcRenderer.invoke('updates:install'),setEnabled:enabled=>ipcRenderer.invoke('updates:set-enabled',enabled),
    setDownloadPolicy:policy=>ipcRenderer.invoke('updates:set-download-policy',policy),
    setBusy:busy=>{if(typeof busy==='boolean')ipcRenderer.send('updates:busy',busy)},
    onStateChanged:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('updates:state',listener);return()=>ipcRenderer.removeListener('updates:state',listener)},
    onPrepare:callback=>{const listener=(_event,id)=>{if(typeof id!=='string')return;Promise.resolve().then(callback).then(ok=>ipcRenderer.send('updates:prepared',id,ok===true)).catch(()=>ipcRenderer.send('updates:prepared',id,false))};ipcRenderer.on('updates:prepare',listener);return()=>ipcRenderer.removeListener('updates:prepare',listener)},
  }),
  platform: process.platform,
  setMusicState: state=>ipcRenderer.invoke('desktop:set-music-state',state),
  onMusicToggle: callback=>{const listener=(_event,enabled)=>callback(enabled);ipcRenderer.on('desktop:music-toggle',listener);return()=>ipcRenderer.removeListener('desktop:music-toggle',listener)},
  openMacSettings: kind=>ipcRenderer.invoke('desktop:open-mac-settings',kind),
  openMacGuide: ()=>ipcRenderer.invoke('desktop:open-mac-guide'),
  getState: () => ipcRenderer.invoke('desktop:get-state'),
  minimize: () => ipcRenderer.send('desktop:minimize'),
  close: () => ipcRenderer.send('desktop:close'),
  hideToTray: () => ipcRenderer.send('desktop:hide-to-tray'),
  readyToShow: (hasPet) => {
    if (typeof hasPet !== 'boolean') throw new TypeError('Adoption state must be a boolean');
    ipcRenderer.send('desktop:ready-to-show', hasPet);
  },
  preparePetDrag:()=>ipcRenderer.invoke('desktop:prepare-pet-drag'),
  dragPetToCursor:()=>ipcRenderer.invoke('desktop:drag-pet-to-cursor'),
  setMouseThrough:enabled=>ipcRenderer.invoke('desktop:set-mouse-through',enabled),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('desktop:toggle-always-on-top'),
  setPetMode: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Pet mode must be a boolean'));
    return ipcRenderer.invoke('desktop:set-pet-mode', enabled);
  },
  setCompanionPanel: (open, layout = 'compact') => {
    if (typeof open !== 'boolean') return Promise.reject(new TypeError('Companion panel visibility must be a boolean'));
    if (!['compact', 'classic', 'profile'].includes(layout)) return Promise.reject(new TypeError('Unknown companion layout'));
    return ipcRenderer.invoke('desktop:set-companion-panel', open, layout);
  },
  setPetCanMove: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Pet mobility must be a boolean'));
    return ipcRenderer.invoke('desktop:set-pet-can-move', enabled);
  },
  setPetStatus:status=>ipcRenderer.invoke('desktop:set-pet-status',status),
  setPetEffectBounds:bounds=>ipcRenderer.invoke('desktop:set-pet-effect-bounds',bounds),
  setPetAppearance:form=>ipcRenderer.invoke('desktop:set-pet-appearance',form),
  setRoomFullscreen:enabled=>ipcRenderer.invoke('desktop:set-room-fullscreen',enabled),
  startRoomResize:edge=>ipcRenderer.invoke('desktop:start-room-resize',edge),
  endRoomResize:()=>ipcRenderer.invoke('desktop:end-room-resize'),
  adjustRoomSize:(dx,dy)=>ipcRenderer.invoke('desktop:adjust-room-size',dx,dy),
  openManorSite:()=>ipcRenderer.invoke('desktop:open-manor-site'),
  setEdgeHiding: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Edge hiding must be a boolean'));
    return ipcRenderer.invoke('desktop:set-edge-hiding', enabled);
  },
  revealPet: () => ipcRenderer.invoke('desktop:reveal-pet'),
  setEdgeHovered: (hovered) => {
    if(typeof hovered!=='boolean')return Promise.reject(new TypeError('Edge hover must be a boolean'));
    return ipcRenderer.invoke('desktop:set-edge-hovered',hovered);
  },
  setInteracting: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Interaction state must be a boolean'));
    return ipcRenderer.invoke('desktop:set-interacting', enabled);
  },
  setMousePassthrough: (ignore) => {
    if (typeof ignore !== 'boolean') throw new TypeError('Mouse passthrough must be a boolean');
    ipcRenderer.send('desktop:set-mouse-passthrough', ignore);
  },
  onPetModeChanged: (callback) => subscribeToState('desktop:pet-mode-changed', callback, (state) => state.petMode),
  onStateChanged: (callback) => subscribeToState('desktop:state-changed', callback, (state) => state),
  startPetDrag: (paintedOffset) => {
    if (paintedOffset !== undefined && (!paintedOffset || Array.isArray(paintedOffset)
      || typeof paintedOffset.x !== 'number' || typeof paintedOffset.y !== 'number'
      || !Number.isFinite(paintedOffset.x) || !Number.isFinite(paintedOffset.y)
      || Math.abs(paintedOffset.x) > 82 || Math.abs(paintedOffset.y) > 92)) {
      return Promise.reject(new TypeError('Painted pet offset must be a finite bounded screen-coordinate vector'));
    }
    return ipcRenderer.invoke('desktop:start-pet-drag', paintedOffset);
  },
  endPetDrag: () => ipcRenderer.invoke('desktop:end-pet-drag'),
  movePet: (dx, dy) => {
    if (typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy)) {
      return Promise.reject(new TypeError('Pet movement must use finite screen-coordinate deltas'));
    }
    return ipcRenderer.invoke('desktop:move-pet', dx, dy);
  },
  wander: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Wandering must be a boolean'));
    return ipcRenderer.invoke('desktop:wander', enabled);
  },
  notify: (title, body) => {
    if (typeof title === 'string' && typeof body === 'string') {
      ipcRenderer.send('desktop:notify', title, body);
    }
  },
}));

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('companionSpeech', Object.freeze({
  getAvailability: () => ipcRenderer.invoke('companion-speech:get-availability'),
  listen: () => ipcRenderer.invoke('companion-speech:listen'),
  cancel: () => ipcRenderer.send('companion-speech:cancel'),
}));

contextBridge.exposeInMainWorld('companionAI', Object.freeze({
  getSettings: () => ipcRenderer.invoke('companion-ai:get-settings'),
  setKey: (key) => {
    if (typeof key !== 'string') return Promise.reject(new TypeError('请输入 DeepSeek API Key。'));
    return ipcRenderer.invoke('companion-ai:set-key', key);
  },
  clearKey: () => ipcRenderer.invoke('companion-ai:clear-key'),
  chat: (messages) => ipcRenderer.invoke('companion-ai:chat', messages),
  cancel: () => ipcRenderer.send('companion-ai:cancel'),
}));

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
  getState: () => ipcRenderer.invoke('desktop:get-state'),
  minimize: () => ipcRenderer.send('desktop:minimize'),
  close: () => ipcRenderer.send('desktop:close'),
  hideToTray: () => ipcRenderer.send('desktop:hide-to-tray'),
  readyToShow: (hasPet) => {
    if (typeof hasPet !== 'boolean') throw new TypeError('Adoption state must be a boolean');
    ipcRenderer.send('desktop:ready-to-show', hasPet);
  },
  toggleAlwaysOnTop: () => ipcRenderer.invoke('desktop:toggle-always-on-top'),
  setPetMode: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Pet mode must be a boolean'));
    return ipcRenderer.invoke('desktop:set-pet-mode', enabled);
  },
  setCompanionPanel: (open) => {
    if (typeof open !== 'boolean') return Promise.reject(new TypeError('Companion panel visibility must be a boolean'));
    return ipcRenderer.invoke('desktop:set-companion-panel', open);
  },
  setPetCanMove: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Pet mobility must be a boolean'));
    return ipcRenderer.invoke('desktop:set-pet-can-move', enabled);
  },
  setEdgeHiding: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Edge hiding must be a boolean'));
    return ipcRenderer.invoke('desktop:set-edge-hiding', enabled);
  },
  revealPet: () => ipcRenderer.invoke('desktop:reveal-pet'),
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
  startPetDrag: () => ipcRenderer.invoke('desktop:start-pet-drag'),
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

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
  getState: () => ipcRenderer.invoke('desktop:get-state'),
  minimize: () => ipcRenderer.send('desktop:minimize'),
  close: () => ipcRenderer.send('desktop:close'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('desktop:toggle-always-on-top'),
  setPetMode: (enabled) => {
    if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('Pet mode must be a boolean'));
    return ipcRenderer.invoke('desktop:set-pet-mode', enabled);
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

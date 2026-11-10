// A small visible application for exercising the real NSIS/Shell entrypoints.
// Only the diagnostic workflow packages this file, never a product release.
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 400, height: 300 });
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><title>Windows entrypoint check</title><p>Windows shortcut launch check</p>'));
});
app.on('window-all-closed', () => app.quit());

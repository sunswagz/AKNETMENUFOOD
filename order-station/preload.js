const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aknet', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Window controls cho custom title bar
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
});

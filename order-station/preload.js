const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aknet', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
});

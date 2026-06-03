const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aknet', {
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  onServerInfo: (cb) => ipcRenderer.on('server-info', (_, d) => cb(d)),
  getOrders: () => ipcRenderer.invoke('get-orders'),
  updateStatus: (id, status) => ipcRenderer.invoke('update-status', { id, status }),
  deleteOrder: (id) => ipcRenderer.invoke('delete-order', { id }),
  clearDone: () => ipcRenderer.invoke('clear-done'),
  onNewOrder: (cb) => ipcRenderer.on('new-order', (_, o) => cb(o)),
  onBroadcast: (cb) => ipcRenderer.on('ws-broadcast', (_, m) => cb(m)),
  getMenu: () => ipcRenderer.invoke('get-menu'),
  saveMenu: (menu) => ipcRenderer.invoke('save-menu', menu),
  broadcastMenu: (menu) => ipcRenderer.invoke('broadcast-menu', menu),
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  broadcastSettings: (s) => ipcRenderer.invoke('broadcast-settings', s),
  // Categories
  getCategories: () => ipcRenderer.invoke('get-categories'),
  saveCategories: (cats) => ipcRenderer.invoke('save-categories', cats),
  broadcastCategories: (cats) => ipcRenderer.invoke('broadcast-categories', cats),
  // Fee
  getFeeSettings: () => ipcRenderer.invoke('get-fee-settings'),
  saveFeeSettings: (fee) => ipcRenderer.invoke('save-fee-settings', fee),
  broadcastFeeSettings: (fee) => ipcRenderer.invoke('broadcast-fee-settings', fee),
  // Window
  minimize: () => ipcRenderer.send('cashier-minimize'),
  maximize: () => ipcRenderer.send('cashier-maximize'),
  close: () => ipcRenderer.send('cashier-close'),
});

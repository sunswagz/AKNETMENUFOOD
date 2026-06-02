const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aknet', {
  // Server info
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  onServerInfo: (cb) => ipcRenderer.on('server-info', (_, data) => cb(data)),

  // Orders
  getOrders: () => ipcRenderer.invoke('get-orders'),
  updateStatus: (id, status) => ipcRenderer.invoke('update-status', { id, status }),
  deleteOrder: (id) => ipcRenderer.invoke('delete-order', { id }),
  clearDone: () => ipcRenderer.invoke('clear-done'),
  onNewOrder: (cb) => ipcRenderer.on('new-order', (_, order) => cb(order)),
  onBroadcast: (cb) => ipcRenderer.on('ws-broadcast', (_, msg) => cb(msg)),

  // Menu management
  getMenu: () => ipcRenderer.invoke('get-menu'),
  saveMenu: (menu) => ipcRenderer.invoke('save-menu', menu),
  broadcastMenu: (menu) => ipcRenderer.invoke('broadcast-menu', menu),

  // Window controls cho custom title bar
  minimize: () => ipcRenderer.send('cashier-minimize'),
  maximize: () => ipcRenderer.send('cashier-maximize'),
  close: () => ipcRenderer.send('cashier-close'),
});

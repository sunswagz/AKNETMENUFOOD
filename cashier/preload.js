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

  // Real-time events from server
  onNewOrder: (cb) => ipcRenderer.on('new-order', (_, order) => cb(order)),
  onBroadcast: (cb) => ipcRenderer.on('ws-broadcast', (_, msg) => cb(msg)),
});

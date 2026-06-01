const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');

// ─── Data Storage ─────────────────────────────────────────────────────────────
const DATA_FILE = path.join(app.getPath('userData'), 'orders.json');
const CONFIG_FILE = path.join(app.getPath('userData'), 'server-config.json');
let orders = [];

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE))
      orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { orders = []; }
}

function saveOrders() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(orders), 'utf8'); } catch (e) {}
}

// Lưu port đang dùng để máy trạm biết
function saveServerConfig(port) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify({ port }), 'utf8'); } catch (e) {}
}

// ─── Get Local IP ─────────────────────────────────────────────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// ─── Tìm cổng trống tự động ───────────────────────────────────────────────────
function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const tryPort = (port) => {
      if (port > startPort + 20) {
        reject(new Error('Khong tim duoc cong trong!'));
        return;
      }
      const tester = net.createServer();
      tester.once('error', () => tryPort(port + 1)); // cổng bị chiếm → thử cổng tiếp
      tester.once('listening', () => {
        tester.close(() => resolve(port)); // cổng trống → dùng cổng này
      });
      tester.listen(port, '0.0.0.0');
    };
    tryPort(startPort);
  });
}

// ─── Express + WebSocket Server ───────────────────────────────────────────────
const expressApp = express();
expressApp.use(express.json());
expressApp.use(express.static(path.join(__dirname, 'public')));

expressApp.get('/api/menu', (req, res) => res.json(getMenuData()));
expressApp.get('/api/orders', (req, res) => res.json(orders));

expressApp.post('/api/orders/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    saveOrders();
    broadcast({ type: 'status_update', id, status });
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

expressApp.delete('/api/orders/:id', (req, res) => {
  const id = parseInt(req.params.id);
  orders = orders.filter(o => o.id !== id);
  saveOrders();
  broadcast({ type: 'order_deleted', id });
  res.json({ ok: true });
});

expressApp.delete('/api/orders/clear/done', (req, res) => {
  orders = orders.filter(o => o.status !== 'done');
  saveOrders();
  broadcast({ type: 'refresh', orders });
  res.json({ ok: true });
});

const server = http.createServer(expressApp);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'init', orders }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'call_staff') {
        const callOrder = {
          id: Date.now(),
          machine: msg.machine,
          type: 'call_staff',
          status: 'pending',
          items: [],
          total: 0,
          note: 'Khách gọi nhân viên',
          time: new Date().toLocaleTimeString('vi-VN')
        };
        orders.push(callOrder);
        saveOrders();
        broadcast({ type: 'new_order', order: callOrder });
        if (mainWindow) {
          mainWindow.webContents.send('new-order', callOrder);
          if (!mainWindow.isFocused()) { mainWindow.flashFrame(true); mainWindow.once('focus', () => mainWindow.flashFrame(false)); }
        }
      } else if (msg.type === 'new_order') {
        const order = {
          ...msg.order,
          id: Date.now(),
          status: 'pending',
          time: new Date().toLocaleTimeString('vi-VN')
        };
        orders.push(order);
        saveOrders();
        broadcast({ type: 'new_order', order });
        if (mainWindow) {
          mainWindow.webContents.send('new-order', order);
          if (!mainWindow.isFocused()) {
            mainWindow.flashFrame(true);
            mainWindow.once('focus', () => mainWindow.flashFrame(false));
          }
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => clients.delete(ws));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });
  if (mainWindow) mainWindow.webContents.send('ws-broadcast', msg);
}

let mainWindow = null;
let tray = null;
let ACTUAL_PORT = 3456;

// ─── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
  // Thử cổng 3456 trước, nếu bị chiếm thì tự tìm cổng trống
  try {
    ACTUAL_PORT = await findFreePort(3456);
  } catch (e) {
    ACTUAL_PORT = 3456; // fallback
  }

  return new Promise((resolve) => {
    server.listen(ACTUAL_PORT, '0.0.0.0', () => {
      const ip = getLocalIP();
      saveServerConfig(ACTUAL_PORT); // lưu port thực tế
      console.log(`AKNet Server: http://${ip}:${ACTUAL_PORT}`);
      resolve({ ip, port: ACTUAL_PORT });
    });

    server.on('error', (err) => {
      // Nếu vẫn lỗi, thử cổng ngẫu nhiên
      ACTUAL_PORT = Math.floor(Math.random() * 1000) + 3000;
      server.listen(ACTUAL_PORT, '0.0.0.0', () => {
        const ip = getLocalIP();
        saveServerConfig(ACTUAL_PORT);
        resolve({ ip, port: ACTUAL_PORT });
      });
    });
  });
}

// ─── Electron Window ──────────────────────────────────────────────────────────
function createWindow(serverInfo) {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 900, minHeight: 600,
    title: 'AKNet Cashier',
    backgroundColor: '#020b08',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'cashier.html'));
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('server-info', serverInfo);
  });

  mainWindow.on('close', (e) => { e.preventDefault(); mainWindow.hide(); });

  // System tray
  try {
    tray = new Tray(path.join(__dirname, 'assets', 'icon.ico'));
    const menu = Menu.buildFromTemplate([
      { label: `AKNet Cashier - Cong ${serverInfo.port}`, enabled: false },
      { label: `IP: ${serverInfo.ip}`, enabled: false },
      { type: 'separator' },
      { label: 'Mo cua so', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: 'Thoat', click: () => app.quit() }
    ]);
    tray.setToolTip(`AKNet Cashier - ${serverInfo.ip}:${serverInfo.port}`);
    tray.setContextMenu(menu);
    tray.on('click', () => mainWindow.show());
  } catch (e) {}
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.handle('update-status', (e, { id, status }) => {
  const order = orders.find(o => o.id === id);
  if (order) { order.status = status; saveOrders(); broadcast({ type: 'status_update', id, status }); return true; }
  return false;
});

ipcMain.handle('delete-order', (e, { id }) => {
  orders = orders.filter(o => o.id !== id);
  saveOrders(); broadcast({ type: 'order_deleted', id }); return true;
});

ipcMain.handle('clear-done', () => {
  orders = orders.filter(o => o.status !== 'done');
  saveOrders(); broadcast({ type: 'refresh', orders }); return true;
});

ipcMain.handle('get-orders', () => orders);
ipcMain.handle('get-server-info', () => ({ ip: getLocalIP(), port: ACTUAL_PORT }));

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Ngăn mở nhiều instance cùng lúc
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  loadOrders();
  const serverInfo = await startServer();
  createWindow(serverInfo);
});

app.on('before-quit', () => {
  if (mainWindow) mainWindow.removeAllListeners('close');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Menu Data ────────────────────────────────────────────────────────────────
function getMenuData() {
  return [
    { id:1,  cat:'Đồ Uống',  name:'Trà Tắc',        price:15000, emoji:'🍋', desc:'Mát lạnh nhiều đá' },
    { id:2,  cat:'Đồ Uống',  name:'Coca Cola',       price:15000, emoji:'🥤', desc:'Coca lon lạnh' },
    { id:3,  cat:'Đồ Uống',  name:'Nước Suối',       price:10000, emoji:'💧', desc:'Aquafina 500ml' },
    { id:4,  cat:'Đồ Uống',  name:'Trà Đào',         price:20000, emoji:'🍑', desc:'Đường phèn mát' },
    { id:5,  cat:'Đồ Uống',  name:'Hồng Trà Sữa',    price:25000, emoji:'🧋', desc:'Trân châu ít đá' },
    { id:6,  cat:'Đồ Uống',  name:'Cà Phê Sữa',      price:20000, emoji:'☕', desc:'Đá đậm đà' },
    { id:7,  cat:'Ăn Vặt',   name:'Mì Ly',           price:12000, emoji:'🍜', desc:'Hảo hảo ly' },
    { id:8,  cat:'Ăn Vặt',   name:'Bánh Mì Thịt',    price:20000, emoji:'🥖', desc:'Thịt nguội pate' },
    { id:9,  cat:'Ăn Vặt',   name:'Xúc Xích',        price:15000, emoji:'🌭', desc:'Chiên nóng x2' },
    { id:10, cat:'Ăn Vặt',   name:'Snack O\'Star',   price:10000, emoji:'🍟', desc:'Khoai tây giòn' },
    { id:11, cat:'Ăn Vặt',   name:'Khô Bò',          price:20000, emoji:'🥩', desc:'Cay, gói 30g' },
    { id:12, cat:'Giờ Chơi', name:'Nạp 1 Tiếng',     price:10000, emoji:'⏱', desc:'Thêm 1 giờ' },
    { id:13, cat:'Giờ Chơi', name:'Nạp 2 Tiếng',     price:18000, emoji:'⏰', desc:'Tiết kiệm hơn' },
    { id:14, cat:'Giờ Chơi', name:'Nạp 5 Tiếng',     price:40000, emoji:'🕐', desc:'Siêu tiết kiệm' },
    { id:15, cat:'Dịch Vụ',  name:'In Tài Liệu',     price:2000,  emoji:'🖨', desc:'Đen trắng /trang' },
    { id:16, cat:'Dịch Vụ',  name:'Scan Giấy',       price:5000,  emoji:'📄', desc:'A4 /trang' },
    { id:17, cat:'Dịch Vụ',  name:'Lưu File USB',    price:5000,  emoji:'💾', desc:'Copy vào USB' },
  ];
}

// ─── Menu Management ──────────────────────────────────────────────────────────
const MENU_FILE = path.join(app.getPath('userData'), 'menu.json');

function loadMenuFromFile() {
  try {
    if (fs.existsSync(MENU_FILE))
      return JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
  } catch(e){}
  return null;
}

ipcMain.handle('get-menu', () => {
  return loadMenuFromFile();
});

ipcMain.handle('save-menu', (e, menu) => {
  try { fs.writeFileSync(MENU_FILE, JSON.stringify(menu), 'utf8'); return true; } catch(e){ return false; }
});

ipcMain.handle('broadcast-menu', (e, menu) => {
  broadcast({ type: 'menu_updated', menu });
  return true;
});

// Gửi menu khi máy trạm kết nối (thêm vào ws connection handler)
// Override ws init message để kèm menu

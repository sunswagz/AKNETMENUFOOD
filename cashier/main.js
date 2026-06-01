const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');

// ─── Data Storage ───────────────────────────────────────────────────────────
const DATA_FILE = path.join(app.getPath('userData'), 'orders.json');
let orders = [];

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) { orders = []; }
}

function saveOrders() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(orders), 'utf8');
  } catch (e) {}
}

// ─── Get Local IP ────────────────────────────────────────────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// ─── Express + WebSocket Server ──────────────────────────────────────────────
const expressApp = express();
expressApp.use(express.json());
expressApp.use(express.static(path.join(__dirname, 'public')));

// Serve menu data
expressApp.get('/api/menu', (req, res) => {
  res.json(getMenuData());
});

// Serve orders
expressApp.get('/api/orders', (req, res) => {
  res.json(orders);
});

// Update order status
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

// Delete order
expressApp.delete('/api/orders/:id', (req, res) => {
  const id = parseInt(req.params.id);
  orders = orders.filter(o => o.id !== id);
  saveOrders();
  broadcast({ type: 'order_deleted', id });
  res.json({ ok: true });
});

// Clear done orders
expressApp.delete('/api/orders/clear/done', (req, res) => {
  orders = orders.filter(o => o.status !== 'done');
  saveOrders();
  broadcast({ type: 'refresh', orders });
  res.json({ ok: true });
});

const server = http.createServer(expressApp);

// WebSocket
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  // Send current orders on connect
  ws.send(JSON.stringify({ type: 'init', orders }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'new_order') {
        const order = {
          ...msg.order,
          id: Date.now(),
          status: 'pending',
          time: new Date().toLocaleTimeString('vi-VN')
        };
        orders.push(order);
        saveOrders();
        broadcast({ type: 'new_order', order });
        // Notify main window
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
  // Also update cashier window via IPC
  if (mainWindow) {
    mainWindow.webContents.send('ws-broadcast', msg);
  }
}

const PORT = 3456;
let mainWindow = null;
let tray = null;
let serverStarted = false;

// ─── Start Server ────────────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    server.listen(PORT, '0.0.0.0', () => {
      serverStarted = true;
      const ip = getLocalIP();
      console.log(`AKNet Server running at http://${ip}:${PORT}`);
      resolve({ ip, port: PORT });
    });
  });
}

// ─── Electron Window ─────────────────────────────────────────────────────────
function createWindow(serverInfo) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AKNet Cashier – Quản lý Order',
    backgroundColor: '#020b08',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'cashier.html'));

  // Pass server info to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('server-info', serverInfo);
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  // Tray
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    tray = new Tray(iconPath);
    const menu = Menu.buildFromTemplate([
      { label: 'Mở AKNet Cashier', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: 'Thoát', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('AKNet Cashier');
    tray.setContextMenu(menu);
    tray.on('click', () => mainWindow.show());
  } catch(e) {}
}

// IPC: cashier window → update status
ipcMain.handle('update-status', (event, { id, status }) => {
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    saveOrders();
    broadcast({ type: 'status_update', id, status });
    return true;
  }
  return false;
});

ipcMain.handle('delete-order', (event, { id }) => {
  orders = orders.filter(o => o.id !== id);
  saveOrders();
  broadcast({ type: 'order_deleted', id });
  return true;
});

ipcMain.handle('clear-done', () => {
  orders = orders.filter(o => o.status !== 'done');
  saveOrders();
  broadcast({ type: 'refresh', orders });
  return true;
});

ipcMain.handle('get-orders', () => orders);

ipcMain.handle('get-server-info', () => ({
  ip: getLocalIP(),
  port: PORT
}));

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
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
    { id:1,  cat:'🥤 Đồ Uống',   name:'Trà Tắc',       price:15000, emoji:'🍋', desc:'Trà tắc mát lạnh, nhiều đá' },
    { id:2,  cat:'🥤 Đồ Uống',   name:'Coca Cola',      price:15000, emoji:'🥤', desc:'Coca lon lạnh mát' },
    { id:3,  cat:'🥤 Đồ Uống',   name:'Nước Suối',      price:10000, emoji:'💧', desc:'Aquafina 500ml' },
    { id:4,  cat:'🥤 Đồ Uống',   name:'Trà Đào',        price:20000, emoji:'🍑', desc:'Trà đào đường phèn' },
    { id:5,  cat:'🥤 Đồ Uống',   name:'Hồng Trà Sữa',   price:25000, emoji:'🧋', desc:'Trân châu, ít đá' },
    { id:6,  cat:'🥤 Đồ Uống',   name:'Cà Phê Sữa',     price:20000, emoji:'☕', desc:'Cà phê sữa đá đậm đà' },
    { id:7,  cat:'🍜 Ăn Vặt',    name:'Mì Ly',          price:12000, emoji:'🍜', desc:'Mì tôm hảo hảo ly' },
    { id:8,  cat:'🍜 Ăn Vặt',    name:'Bánh Mì Thịt',   price:20000, emoji:'🥖', desc:'Bánh mì thịt nguội pate' },
    { id:9,  cat:'🍜 Ăn Vặt',    name:'Xúc Xích',       price:15000, emoji:'🌭', desc:'Xúc xích chiên nóng x2' },
    { id:10, cat:'🍜 Ăn Vặt',    name:'Snack O\'Star',  price:10000, emoji:'🍟', desc:'Snack khoai tây giòn' },
    { id:11, cat:'🍜 Ăn Vặt',    name:'Khô Bò',         price:20000, emoji:'🥩', desc:'Khô bò cay, gói 30g' },
    { id:12, cat:'⏱ Giờ Chơi',   name:'Nạp 1 Tiếng',   price:10000, emoji:'⏱', desc:'Nạp thêm 1 giờ chơi' },
    { id:13, cat:'⏱ Giờ Chơi',   name:'Nạp 2 Tiếng',   price:18000, emoji:'⏰', desc:'Nạp 2 giờ, tiết kiệm' },
    { id:14, cat:'⏱ Giờ Chơi',   name:'Nạp 5 Tiếng',   price:40000, emoji:'🕐', desc:'Gói 5 giờ siêu tiết kiệm' },
    { id:15, cat:'🖨 Dịch Vụ',   name:'In Tài Liệu',    price:2000,  emoji:'🖨', desc:'In đen trắng /trang' },
    { id:16, cat:'🖨 Dịch Vụ',   name:'Scan Giấy',      price:5000,  emoji:'📄', desc:'Scan A4/trang' },
    { id:17, cat:'🖨 Dịch Vụ',   name:'Lưu File USB',   price:5000,  emoji:'💾', desc:'Copy file vào USB' },
  ];
}

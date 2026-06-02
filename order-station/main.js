const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE))
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch(e){}
  return { serverIP:'', serverPort:3456, machineId:'01' };
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg), 'utf8'); } catch(e){}
}

let config = loadConfig();
let mainWindow;

// ─── Auto Updater ────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.on('error', () => {});
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 30 * 60 * 1000);
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'AKNet – Gọi Món',
    backgroundColor: '#0d0d0d',

    // ── Xóa title bar Windows, dùng custom title bar trong HTML ──
    frame: false,           // Tắt hoàn toàn khung Windows
    titleBarStyle: 'hidden', // Ẩn title bar native

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'order.html'));


  // Tắt menu bar hoàn toàn (File/Edit/View/Window/Help)
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (e, cfg) => {
  config = { ...config, ...cfg };
  saveConfig(config);
  return true;
});
ipcMain.handle('get-version', () => app.getVersion());

// Window controls từ custom title bar
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) { app.quit(); return; }
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  createWindow();
  if (app.isPackaged) setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

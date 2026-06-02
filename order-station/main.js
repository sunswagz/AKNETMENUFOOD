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

function setupAutoUpdater() {
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(true, true));
  autoUpdater.on('error', () => {});
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 30 * 60 * 1000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'AKNet – Gọi Món',
    backgroundColor: '#0d0d0d',
    // KHÔNG dùng frame:false - giữ frame Windows bình thường
    // Chỉ ẩn menu bar thôi
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // KHÔNG dùng webSecurity:false
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  // Ẩn menu bar (File/Edit/View...) nhưng GIỮ frame Windows
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();

  mainWindow.loadFile(path.join(__dirname, 'public', 'order.html'));
}

ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (e, cfg) => {
  config = { ...config, ...cfg };
  saveConfig(config);
  return true;
});
ipcMain.handle('get-version', () => app.getVersion());

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

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch(e){}
  return { serverIP: '', serverPort: 3456, machineId: '01' };
}

function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg), 'utf8'); } catch(e){}
}

let config = loadConfig();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'AKNet – Order',
    backgroundColor: '#050a14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'order.html'));
}

ipcMain.handle('get-config', () => config);
ipcMain.handle('save-config', (e, cfg) => { config = { ...config, ...cfg }; saveConfig(config); return true; });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

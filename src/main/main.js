const { app, BrowserWindow } = require('electron');
const path = require('path');

// Log errori silenziosi
process.on('uncaughtException', (err) => console.error('[Main] UncaughtException:', err));
process.on('unhandledRejection', (r) => console.error('[Main] UnhandledRejection:', r));

// Registra i canali IPC e DB
require('./ipc-training');

let mainWindow;

function createMainWindow() {
    console.log('[Main] createMainWindow');
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        center: true,
        webPreferences: {
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log('[Main] Loading file:', indexPath);
    mainWindow.loadFile(indexPath);

    mainWindow.on('ready-to-show', () => {
        console.log('[Main] ready-to-show -> show()');
        mainWindow.show();
    });

    mainWindow.on('closed', () => (mainWindow = null));
}

app.whenReady().then(() => {
    console.log('[Main] app ready');
    createMainWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
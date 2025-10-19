const { app, BrowserWindow } = require('electron');
const path = require('path');


try {
    if (require('electron-squirrel-startup')) app.quit();
} catch { }

// Log errori silenziosi
process.on('uncaughtException', (err) => console.error('[Main] UncaughtException:', err));
process.on('unhandledRejection', (r) => console.error('[Main] UnhandledRejection:', r));

// Registra i canali IPC e DB
const training = require('./ipc-training');

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

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        } else {
            createMainWindow();
        }
    });

    app.whenReady().then(() => {
        console.log('[Main] app ready');
        app.setAppUserModelId('com.iron.clientmanagement');
        // Backup giornaliero al bootstrap
        training.backupDatabaseDaily && training.backupDatabaseDaily();
        createMainWindow();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
        });
    });

    app.on('before-quit', () => {
        // Prova backup veloce e chiudi DB
        try { training.backupDatabaseAuto && training.backupDatabaseAuto(); } catch {}
        try { training.closeDb && training.closeDb(); } catch {}
    });


    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}
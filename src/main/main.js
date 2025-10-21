const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fssync = require('fs');
const { pathToFileURL, fileURLToPath } = require('url');


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
        try { training.backupDatabaseAuto && training.backupDatabaseAuto(); } catch { }
        try { training.closeDb && training.closeDb(); } catch { }
    });


    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}

// Helper: safe folder name for Windows
function safeName(name = '') {
    return String(name).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 150);
}
function normalizeName(n) { return String(n || '').trim(); }
function isPlaceholderName(n) {
    const s = normalizeName(n);
    return s.length === 0 || /^client[ei]$/i.test(s); // "Cliente" o "Clienti"
}
function clientPhotosDir(clientName) {
    // Pictures/IRON_GESTIONALE[/<ClientName>]
    const base = path.join(app.getPath('pictures'), 'IRON_GESTIONALE');
    const name = normalizeName(clientName);
    return isPlaceholderName(name) ? base : path.join(base, safeName(name));
}
async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
function toFileUrl(p) {
    return pathToFileURL(p).href;
}
function isImageFile(filename) {
    return /\.(jpe?g|png|gif|webp|bmp|tiff)$/i.test(filename);
}

// Open Photos window (called from renderer via window.api.openPhotosWindow)
function createPhotosWindow(clientName) {
    const win = new BrowserWindow({
        width: 900,
        height: 650,
        show: true,
        webPreferences: {
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    const photosPath = path.join(__dirname, '../renderer/photos.html');
    // Passa vuoto se mancante, non "Cliente"
    win.loadFile(photosPath, { query: { client: clientName || '' } });
}

// IPC: open the Photos window
ipcMain.on('photos:open', (_evt, payload) => {
    try {
        const name = typeof payload === 'string' ? payload : payload?.clientName;
        console.log('[IPC] photos:open clientName=', name);
        createPhotosWindow(isPlaceholderName(name) ? '' : name);
    } catch (e) { console.error(e); }
});

// IPC: list client photos -> returns array of file:// URLs
ipcMain.handle('get-client-photos', async (_evt, clientName) => {
    try {
        console.log('[IPC] get-client-photos clientName=', clientName);
        const dir = clientPhotosDir(clientName);
        await ensureDir(dir);
        const files = await fs.readdir(dir);
        return files.filter(isImageFile).map((f) => toFileUrl(path.join(dir, f)));
    } catch (e) {
        console.error('[IPC] get-client-photos error:', e);
        return [];
    }
});

// IPC: upload photos via file picker -> copies into client folder, returns file:// URLs
ipcMain.handle('upload-client-photos', async (_evt, clientName) => {
    try {
        console.log('[IPC] upload-client-photos clientName=', clientName);
        if (isPlaceholderName(clientName)) {
            dialog.showErrorBox('Seleziona cliente', 'Apri le foto da un cliente specifico.');
            return [];
        }
        const pick = await dialog.showOpenDialog({
            title: 'Seleziona foto',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Immagini', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'] }],
        });
        if (pick.canceled || !pick.filePaths?.length) return [];

        const dir = clientPhotosDir(clientName);
        await ensureDir(dir);

        const outputs = [];
        for (const src of pick.filePaths) {
            const base = path.basename(src);
            let dest = path.join(dir, base);
            if (fssync.existsSync(dest)) {
                const ext = path.extname(base);
                const name = path.basename(base, ext);
                let i = 1;
                while (fssync.existsSync(dest)) {
                    dest = path.join(dir, `${name} (${i})${ext}`);
                    i++;
                }
            }
            await fs.copyFile(src, dest);
            outputs.push(toFileUrl(dest));
        }
        return outputs;
    } catch (e) {
        console.error('[IPC] upload-client-photos error:', e);
        return [];
    }
});

// IPC: open the client folder in Explorer
ipcMain.handle('open-client-photos-folder', async (_evt, clientName) => {
    try {
        console.log('[IPC] open-client-photos-folder clientName=', clientName);
        if (isPlaceholderName(clientName)) return false;
        const dir = clientPhotosDir(clientName);
        await ensureDir(dir);
        await shell.openPath(dir);
        return true;
    } catch (e) {
        console.error('[IPC] open-client-photos-folder error:', e);
        return false;
    }
});

// IPC: open a single photo with the default app
ipcMain.handle('open-client-photo', async (_evt, fileUrl) => {
    try {
        if (typeof fileUrl !== 'string') return false;

        if (fileUrl.startsWith('file://')) {
            const fsPath = fileURLToPath(fileUrl);
            // openPath returns '' on success, otherwise an error string
            const res = await shell.openPath(fsPath);
            return res === '';
        } else {
            await shell.openExternal(fileUrl);
            return true;
        }
    } catch (e) {
        console.error('[IPC] open-client-photo error:', e);
        return false;
    }
});
const { ipcMain, BrowserWindow, dialog, shell, app } = require('electron'); // aggiunti
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Log helper
function logDbPaths({ dbPath, defaultDbPath }) {
  console.log('[DB] isPackaged:', app.isPackaged);
  console.log('[DB] cwd:', process.cwd());
  console.log('[DB] resourcesPath:', process.resourcesPath);
  console.log('[DB] userData:', app.getPath('userData'));
  console.log('[DB] defaultDbPath exists:', fs.existsSync(defaultDbPath), '->', defaultDbPath);
  console.log('[DB] dbPath (writable):', dbPath);
}

// Resolve paths
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'clients.db');
const defaultDbPath = app.isPackaged
  // assets copiati fuori dall'asar (vedi package.json extraResources)
  ? path.join(process.resourcesPath, 'assets', 'clients.db')
  // in sviluppo: assets in root progetto
  : path.resolve(__dirname, '../../assets/clients.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Copy default DB if missing
if (!fs.existsSync(dbPath)) {
  if (fs.existsSync(defaultDbPath)) {
    fs.copyFileSync(defaultDbPath, dbPath);
  } else {
    console.warn('[DB] Default DB not found. A new empty DB will be created.');
  }
}

logDbPaths({ dbPath, defaultDbPath });

// Open DB
let db;
try {
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.error('[DB] Open error:', err);
  throw err;
}

// Ensure schema
db.exec(`
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  surname TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// Example exports (adatta se già presenti)
function insertClient(client) {
  const stmt = db.prepare('INSERT INTO clients (name, surname, phone) VALUES (?, ?, ?)');
  const info = stmt.run(client.name, client.surname || null, client.phone || null);
  return info.lastInsertRowid;
}

function getClient(id) {
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
}

function listClients() {
  return db.prepare('SELECT * FROM clients ORDER BY id DESC').all();
}

function updateClient(id, data) {
  const stmt = db.prepare(`
    UPDATE clients
       SET name = ?, surname = ?, phone = ?
     WHERE id = ?
  `);
  const info = stmt.run(data.name, data.surname || null, data.phone || null, id);
  return info.changes > 0;
}

function deleteClient(id) {
  const info = db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  return info.changes > 0;
}

module.exports = { insertClient, getClient, listClients, updateClient, deleteClient, db };

// ------- IPC CLIENT CRUD -------

// Leggi tutti i clienti
ipcMain.on('client:read', (event) => {
  try {
    const rows = db.prepare('SELECT id, name, surname, phone FROM clients ORDER BY id DESC').all();
    event.sender.send('client:read:success', rows);
  } catch (err) {
    event.sender.send('client:read:error', err.message || 'Errore lettura clienti');
  }
});

// Crea cliente
ipcMain.on('client:create', (event, payload = {}) => {
  try {
    const name = String(payload.name || '').trim();
    const surname = String(payload.surname || '').trim();
    const phone = String(payload.phone || '').trim();
    if (!name) throw new Error('Nome obbligatorio');

    db.prepare('INSERT INTO clients (name, surname, phone) VALUES (?, ?, ?)').run(name, surname, phone);
    event.sender.send('client:create:success');
  } catch (err) {
    event.sender.send('client:create:error', err.message || 'Errore creazione cliente');
  }
});

// Aggiorna cliente
ipcMain.on('client:update', (event, payload = {}) => {
  try {
    const id = Number(payload.id);
    if (!id) throw new Error('ID mancante');

    const name = String(payload.name || '').trim();
    const surname = String(payload.surname || '').trim();
    const phone = String(payload.phone || '').trim();
    if (!name) throw new Error('Nome obbligatorio');

    const info = db.prepare('UPDATE clients SET name=?, surname=?, phone=? WHERE id=?')
      .run(name, surname, phone, id);
    if (info.changes === 0) throw new Error('Cliente non trovato');

    event.sender.send('client:update:success');
  } catch (err) {
    event.sender.send('client:update:error', err.message || 'Errore aggiornamento cliente');
  }
});

// Elimina cliente
ipcMain.on('client:delete', (event, arg) => {
  try {
    const id = typeof arg === 'object' ? Number(arg.id) : Number(arg);
    if (!id) throw new Error('ID mancante');

    const info = db.prepare('DELETE FROM clients WHERE id=?').run(id);
    if (info.changes === 0) throw new Error('Cliente non trovato');

    event.sender.send('client:delete:success');
  } catch (err) {
    event.sender.send('client:delete:error', err.message || 'Errore eliminazione cliente');
  }
});

// ------- Funzioni esistenti sistemate -------

function getClientById(id) {
  const row = db.prepare('SELECT id, name, surname, phone FROM clients WHERE id = ?').get(id);
  return row || null;
}

function listTrainingsByClient(clientId) {
  return db.prepare('SELECT * FROM training_plans WHERE client_id = ? ORDER BY created_at DESC').all(clientId);
}

function createTraining(t) {
  const cols = ['client_id'];
  const placeholders = ['?'];
  const vals = [t.clientId];

  for (const k of TRAINING_FIELDS) {
    if (t[k] !== undefined && t[k] !== null && t[k] !== '') {
      cols.push(k);
      placeholders.push('?');
      vals.push(t[k]);
    }
  }
  if (!cols.includes('title')) throw new Error('Titolo richiesto');

  const sql = `INSERT INTO training_plans (${cols.join(',')}) VALUES (${placeholders.join(',')})`;
  const info = db.prepare(sql).run(...vals);
  return info.lastInsertRowid;
}

// Campi consentiti per training
const TRAINING_FIELDS = [
  'title','notes','date','exercises',
  'Altezza','Peso',
  'CirconferenzaTorace','CirconferenzaVita','CirconferenzaOmbelicale','CirconferenzaFianchi',
  'CirconferenzaBraccioDx','CirconferenzaBraccioSx','CirconferenzaGambaDx','CirconferenzaGambaSx',
  'Idratazione','OreDiSonno','Alimentazione','Obbiettivo','FrequenzaAllenamento',
  'SitAndReach','SideBend','FlessibilitaSpalla','FlamingoDx','FlamingoSx',
  'PiegamentiBraccia','Squat','SitUp','Trazioni'
];

// ---- Apertura finestre ----
function createChildWindow(htmlPath, query = '') {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    }
  });
  win.loadFile(htmlPath, { search: query });
  return win;
}

ipcMain.on('client:detail:open', (_e, { clientId }) => {
  const file = path.join(__dirname, '../renderer/client-detail.html');
  createChildWindow(file, `?id=${encodeURIComponent(clientId)}`);
});

ipcMain.on('photos:open', (_e, { clientName }) => {
  const file = path.join(__dirname, '../renderer/photos.html');
  createChildWindow(file, `?client=${encodeURIComponent(clientName || 'Cliente')}`);
});

// ---- Client get per dettaglio ----
ipcMain.on('client:get', (event, { clientId }) => {
  try {
    const id = Number(clientId);
    if (!id) throw new Error('ID mancante');
    const row = getClientById(id);
    if (!row) throw new Error('Cliente non trovato');
    event.sender.send('client:get:success', row);
  } catch (err) {
    event.sender.send('client:get:error', err.message || 'Errore');
  }
});

// ---- Training CRUD/list ----
ipcMain.on('training:list', (event, { clientId }) => {
  try {
    const rows = listTrainingsByClient(Number(clientId));
    event.sender.send('training:list:success', rows);
  } catch (err) {
    event.sender.send('training:list:error', err.message || 'Errore lista schede');
  }
});

ipcMain.on('training:create', (event, payload = {}) => {
  try {
    const id = createTraining(payload);
    if (!id) throw new Error('Creazione fallita');
    event.sender.send('training:create:success');
  } catch (err) {
    event.sender.send('training:create:error', err.message || 'Errore creazione scheda');
  }
});

ipcMain.on('training:update', (event, payload = {}) => {
  try {
    const id = Number(payload.id);
    if (!id) throw new Error('ID mancante');
    const sets = [];
    const vals = [];
    for (const k of TRAINING_FIELDS) {
      if (k in payload) { sets.push(`${k}=?`); vals.push(payload[k]); }
    }
    if (!sets.length) throw new Error('Nessun campo da aggiornare');
    vals.push(id);
    const info = db.prepare(`UPDATE training_plans SET ${sets.join(',')} WHERE id=?`).run(...vals);
    if (info.changes === 0) throw new Error('Scheda non trovata');
    event.sender.send('training:update:success');
  } catch (err) {
    event.sender.send('training:update:error', err.message || 'Errore aggiornamento scheda');
  }
});

ipcMain.on('training:delete', (event, { id }) => {
  try {
    const info = db.prepare('DELETE FROM training_plans WHERE id=?').run(Number(id));
    if (info.changes === 0) throw new Error('Scheda non trovata');
    event.sender.send('training:delete:success');
  } catch (err) {
    event.sender.send('training:delete:error', err.message || 'Errore eliminazione scheda');
  }
});

// ---- Foto: filesystem handlers usati da photos.js ----
function safeFolderName(name) {
  return String(name || 'Cliente').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80);
}
function clientPhotosDir(name) {
  return path.join(app.getPath('userData'), 'photos', safeFolderName(name));
}

ipcMain.handle('get-client-photos', async (_e, name) => {
  const dir = clientPhotosDir(name);
  if (!fs.existsSync(dir)) return [];
  const exts = new Set(['.png','.jpg','.jpeg','.gif','.webp','.bmp']);
  const files = fs.readdirSync(dir)
    .filter(f => exts.has(path.extname(f).toLowerCase()))
    .map(f => pathToFileURL(path.join(dir, f)).href);
  return files;
});

ipcMain.handle('upload-client-photos', async (_e, name) => {
  const dir = clientPhotosDir(name);
  fs.mkdirSync(dir, { recursive: true });
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleziona foto',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Immagini', extensions: ['png','jpg','jpeg','gif','webp','bmp'] }]
  });
  if (canceled || !filePaths?.length) return [];
  for (const src of filePaths) {
    const dst = path.join(dir, path.basename(src));
    fs.copyFileSync(src, dst);
  }
  return true;
});

ipcMain.handle('open-client-photos-folder', async (_e, name) => {
  const dir = clientPhotosDir(name);
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return true;
});

ipcMain.handle('open-client-photo', async (_e, fileUrl) => {
  if (!fileUrl) return false;
  await shell.openExternal(fileUrl);
  return true;
});
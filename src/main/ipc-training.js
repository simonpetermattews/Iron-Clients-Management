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

// Ensure schema (clients + training_plans con migrazione colonne)
function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      surname TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS training_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      date TEXT,
      exercises TEXT,
      Altezza REAL, Peso REAL,
      CirconferenzaTorace REAL, CirconferenzaVita REAL, CirconferenzaOmbelicale REAL, CirconferenzaFianchi REAL,
      CirconferenzaBraccioDx REAL, CirconferenzaBraccioSx REAL, CirconferenzaGambaDx REAL, CirconferenzaGambaSx REAL,
      Idratazione REAL, OreDiSonno REAL, Alimentazione TEXT, Obbiettivo TEXT, FrequenzaAllenamento TEXT,
      SitAndReach REAL, SideBendDx REAL, SideBendSx REAL, FlessibilitaSpalla REAL, FlamingoDx REAL, FlamingoSx REAL,
      PiegamentiBraccia INTEGER, Squat INTEGER, SitUp INTEGER, Trazioni INTEGER,CooperFreq TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_training_plans_client_id ON training_plans(client_id);
  `);

  // Migrazione colonne mancanti (se DB già esiste)
  const colTypes = new Map([
    ['client_id', 'INTEGER'], ['title', 'TEXT'], ['notes', 'TEXT'], ['date', 'TEXT'], ['exercises', 'TEXT'],
    ['Altezza', 'REAL'], ['Peso', 'REAL'],
    ['CirconferenzaTorace', 'REAL'], ['CirconferenzaVita', 'REAL'], ['CirconferenzaOmbelicale', 'REAL'], ['CirconferenzaFianchi', 'REAL'],
    ['CirconferenzaBraccioDx', 'REAL'], ['CirconferenzaBraccioSx', 'REAL'], ['CirconferenzaGambaDx', 'REAL'], ['CirconferenzaGambaSx', 'REAL'],
    ['Idratazione', 'REAL'], ['OreDiSonno', 'REAL'], ['Alimentazione', 'TEXT'], ['Obbiettivo', 'TEXT'], ['FrequenzaAllenamento', 'TEXT'],
    ['SitAndReach', 'REAL'], ['SideBendDx', 'REAL'],['SideBendSx', 'REAL'], ['FlessibilitaSpalla', 'REAL'], ['FlamingoDx', 'REAL'], ['FlamingoSx', 'REAL'],
    ['PiegamentiBraccia', 'INTEGER'], ['Squat', 'INTEGER'], ['SitUp', 'INTEGER'], ['Trazioni', 'INTEGER'],['CooperFreq', 'TEXT'],
    ['created_at', 'DATETIME'], ['updated_at', 'DATETIME'],
  ]);
  const existing = new Set(db.prepare("PRAGMA table_info('training_plans')").all().map(r => r.name));
  for (const [col, type] of colTypes) {
    if (!existing.has(col)) {
      db.exec(`ALTER TABLE training_plans ADD COLUMN ${col} ${type}`);
    }
  }
}
ensureSchema(db);

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

const backupsDir = path.join(userDataPath, 'backups');
fs.mkdirSync(backupsDir, { recursive: true });

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function backupDatabase(toFilePath) {
  // Snapshot consistente, anche con WAL attivo
  // Evita errori se il DB è già chiuso
  if (!db || db.open === false) return null;
  await db.backup(toFilePath);
  return toFilePath;
}

async function rotateBackups(dir, keep = 10) {
  const files = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.db'))
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (let i = keep; i < files.length; i++) {
    try { fs.unlinkSync(path.join(dir, files[i].f)); } catch { }
  }
}

async function backupDatabaseAuto() {
  const target = path.join(backupsDir, `clients-${ts()}.db`);
  const res = await backupDatabase(target);
  if (res) {
    await rotateBackups(backupsDir, 10);
    return target;
  }
  return null;
}

// Backup giornaliero (una volta al giorno)
const metaPath = path.join(backupsDir, 'meta.json');
async function backupDatabaseDaily() {
  try {
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
    const last = meta.lastBackup || 0;
    const dayMs = 24 * 60 * 60 * 1000;
    if (Date.now() - last > dayMs) {
      const file = await backupDatabaseAuto();
      fs.writeFileSync(metaPath, JSON.stringify({ lastBackup: Date.now(), lastFile: file }, null, 2));
      console.log('[DB] Daily backup ->', file);
    }
  } catch (e) {
    console.error('[DB] Daily backup error:', e);
  }
}

// IPC: backup manuale (scegli percorso)
ipcMain.handle('db:backup:manual', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Salva backup database',
    defaultPath: path.join(app.getPath('documents'), `IRON-Clients-backup-${ts()}.db`),
    filters: [{ name: 'SQLite DB', extensions: ['db', 'sqlite'] }]
  });
  if (canceled || !filePath) return null;
  await backupDatabase(filePath);
  return filePath;
});

module.exports = {
  // ...existing exports...
  insertClient, getClient, listClients, updateClient, deleteClient,
  db,
  closeDb: () => { try { db.close(); } catch { } },
  backupDatabaseAuto,
  backupDatabaseDaily
};

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

// Leggi singolo cliente per id (usato da client-detail)
ipcMain.on('client:get', (event, payload = {}) => {
  try {
    const id = Number(payload?.clientId ?? payload?.id ?? payload);
    if (!id) throw new Error('ID mancante');
    const row = db.prepare('SELECT id, name, surname, phone FROM clients WHERE id = ?').get(id);
    if (!row) throw new Error('Cliente non trovato');
    event.sender.send('client:get:success', row);
  } catch (err) {
    event.sender.send('client:get:error', err.message || 'Errore lettura cliente');
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

// ---- Training: schema helpers coerenti con ensureSchema ----
const TRAINING_FIELDS = [
  'title', 'notes', 'date', 'exercises',
  'Altezza', 'Peso',
  'CirconferenzaTorace', 'CirconferenzaVita', 'CirconferenzaOmbelicale', 'CirconferenzaFianchi',
  'CirconferenzaBraccioDx', 'CirconferenzaBraccioSx', 'CirconferenzaGambaDx', 'CirconferenzaGambaSx',
  'Idratazione', 'OreDiSonno', 'Alimentazione', 'Obbiettivo', 'FrequenzaAllenamento',
  'SitAndReach', 'SideBendDx', 'SideBendSx', 'FlessibilitaSpalla', 'FlamingoDx', 'FlamingoSx',
  'PiegamentiBraccia', 'Squat', 'SitUp', 'Trazioni','CooperFreq'
];

const NUM_FIELDS = new Set([
  'Altezza','Peso',
  'CirconferenzaTorace','CirconferenzaVita','CirconferenzaOmbelicale','CirconferenzaFianchi',
  'CirconferenzaBraccioDx','CirconferenzaBraccioSx','CirconferenzaGambaDx','CirconferenzaGambaSx',
  'Idratazione','OreDiSonno',
  'SitAndReach','SideBendDx','SideBendSx','FlessibilitaSpalla','FlamingoDx','FlamingoSx',
  'PiegamentiBraccia','Squat','SitUp','Trazioni'
]);

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTrainingPayload(p = {}) {
  const out = { ...p };

  // alias
  if (out.side_bend_dx !== undefined && out.SideBendDx === undefined) out.SideBendDx = out.side_bend_dx;
  if (out.side_bend_sx !== undefined && out.SideBendSx === undefined) out.SideBendSx = out.side_bend_sx;

  // accetta cooperHRs o CooperFrequenze ma salva in CooperFreq
  if (out.cooperHRs !== undefined && out.CooperFreq === undefined) out.CooperFreq = out.cooperHRs;
  if (out.CooperFrequenze !== undefined && out.CooperFreq === undefined) out.CooperFreq = out.CooperFrequenze;

  // coerci numerici singoli
  for (const k of TRAINING_FIELDS) {
    if (NUM_FIELDS.has(k) && k in out) out[k] = numOrNull(out[k]);
  }

  // CooperFreq: accetta array o stringa JSON e salva come JSON pulito
  if (out.CooperFreq !== undefined) {
    const toArray = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; }
      }
      return [];
    };
    const arr = toArray(out.CooperFreq)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    out.CooperFreq = JSON.stringify(arr);
  }

  // client id
  out.client_id = Number(out.clientId ?? out.client_id);
  delete out.clientId;

  // titolo di default
  if (out.title === undefined || out.title === null || String(out.title).trim() === '') {
    out.title = `Scheda ${new Date().toLocaleDateString('it-IT')}`;
  }

  return out;
}

function createTraining(payload = {}) {
  const p = normalizeTrainingPayload(payload);
  if (!p.client_id) throw new Error('clientId mancante');

  const cols = ['client_id'];
  const vals = [p.client_id];
  const placeholders = ['?'];

  for (const k of TRAINING_FIELDS) {
    if (p[k] !== undefined) {
      cols.push(k);
      vals.push(p[k]);
      placeholders.push('?');
    }
  }

  const sql = `INSERT INTO training_plans (${cols.join(',')}) VALUES (${placeholders.join(',')})`;
  const info = db.prepare(sql).run(...vals);
  return info.lastInsertRowid;
}

// ---- Training CRUD/list unificati ----
ipcMain.on('training:list', (event, { clientId } = {}) => {
  try {
    const rows = db.prepare(`
      SELECT *
      FROM training_plans
      WHERE client_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(Number(clientId));
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
    const p = normalizeTrainingPayload(payload);
    const id = Number(p.id);
    if (!id) throw new Error('ID mancante');

    const sets = [];
    const vals = [];
    for (const k of TRAINING_FIELDS) {
      if (k in p) { sets.push(`${k}=?`); vals.push(p[k]); }
    }
    if (!sets.length) throw new Error('Nessun campo da aggiornare');

    sets.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(id);

    const sql = `UPDATE training_plans SET ${sets.join(', ')} WHERE id = ?`;
    const info = db.prepare(sql).run(...vals);
    if (info.changes === 0) throw new Error('Scheda non trovata');

    event.sender.send('training:update:success');
  } catch (err) {
    event.sender.send('training:update:error', err.message || 'Errore aggiornamento scheda');
  }
});

ipcMain.on('training:delete', (event, payload = {}) => {
  try {
    const id = Number(payload?.id);
    if (!id) throw new Error('ID mancante');
    const info = db.prepare('DELETE FROM training_plans WHERE id=?').run(id);
    if (info.changes === 0) throw new Error('Scheda non trovata');
    event.sender.send('training:delete:success');
  } catch (err) {
    event.sender.send('training:delete:error', err.message || 'Errore eliminazione scheda');
  }
});

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
  createChildWindow(file, `?client=${encodeURIComponent(clientName)}`);
});

// ---- Foto clienti: IPC handlers ----
function sanitizeName(s) {
  return String(s || 'Cliente').trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
}

const PHOTOS_BASE_DIR = path.join(app.getPath('pictures'), 'IRON-Clients-Photos');

function getClientFolder(clientName) {
  const safe = sanitizeName(clientName);
  const dir = path.join(PHOTOS_BASE_DIR, safe);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isImageFile(name) {
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(name);
}

ipcMain.handle('get-client-photos', async (_e, clientName) => {
  try {
    const dir = getClientFolder(clientName);
    const files = fs.readdirSync(dir)
      .filter(isImageFile)
      .map(f => pathToFileURL(path.join(dir, f)).href);
    return files;
  } catch (err) {
    console.error('[Photos] get-client-photos:', err);
    return [];
  }
});

ipcMain.handle('upload-client-photos', async (event, clientName) => {
  try {
    const dir = getClientFolder(clientName);
    const bw = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(bw, {
      title: 'Seleziona immagini',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Immagini', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'] }]
    });
    if (canceled || !filePaths?.length) return [];

    const copied = [];
    for (const src of filePaths) {
      const base = path.basename(src);
      let dest = path.join(dir, base);

      // Evita conflitti di nome
      if (fs.existsSync(dest)) {
        const ext = path.extname(base);
        const name = path.basename(base, ext);
        dest = path.join(dir, `${name}-${Date.now()}${ext}`);
      }

      fs.copyFileSync(src, dest);
      copied.push(pathToFileURL(dest).href);
    }
    return copied;
  } catch (err) {
    console.error('[Photos] upload-client-photos:', err);
    return [];
  }
});

ipcMain.handle('open-client-photos-folder', async (_e, clientName) => {
  try {
    const dir = getClientFolder(clientName);
    await shell.openPath(dir);
    return true;
  } catch (err) {
    console.error('[Photos] open-client-photos-folder:', err);
    return false;
  }
});

ipcMain.handle('open-client-photo', async (_e, fileUrl) => {
  try {
    if (!fileUrl) return false;
    await shell.openExternal(fileUrl);
    return true;
  } catch (err) {
    console.error('[Photos] open-client-photo:', err);
    return false;
  }
});
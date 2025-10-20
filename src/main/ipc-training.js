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
      SitAndReach REAL, SideBend REAL, FlessibilitaSpalla REAL, FlamingoDx REAL, FlamingoSx REAL,
      PiegamentiBraccia INTEGER, Squat INTEGER, SitUp INTEGER, Trazioni INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_training_plans_client_id ON training_plans(client_id);
  `);

  // Migrazione colonne mancanti (se DB già esiste)
  const colTypes = new Map([
    ['client_id','INTEGER'], ['title','TEXT'], ['notes','TEXT'], ['date','TEXT'], ['exercises','TEXT'],
    ['Altezza','REAL'], ['Peso','REAL'],
    ['CirconferenzaTorace','REAL'], ['CirconferenzaVita','REAL'], ['CirconferenzaOmbelicale','REAL'], ['CirconferenzaFianchi','REAL'],
    ['CirconferenzaBraccioDx','REAL'], ['CirconferenzaBraccioSx','REAL'], ['CirconferenzaGambaDx','REAL'], ['CirconferenzaGambaSx','REAL'],
    ['Idratazione','REAL'], ['OreDiSonno','REAL'], ['Alimentazione','TEXT'], ['Obbiettivo','TEXT'], ['FrequenzaAllenamento','TEXT'],
    ['SitAndReach','REAL'], ['SideBend','REAL'], ['FlessibilitaSpalla','REAL'], ['FlamingoDx','REAL'], ['FlamingoSx','REAL'],
    ['PiegamentiBraccia','INTEGER'], ['Squat','INTEGER'], ['SitUp','INTEGER'], ['Trazioni','INTEGER'],
    ['created_at','DATETIME'], ['updated_at','DATETIME'],
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
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function backupDatabase(toFilePath) {
  // Snapshot consistente, anche con WAL attivo
  await db.backup(toFilePath);
  return toFilePath;
}

async function rotateBackups(dir, keep = 10) {
  const files = fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.db'))
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (let i = keep; i < files.length; i++) {
    try { fs.unlinkSync(path.join(dir, files[i].f)); } catch {}
  }
}

async function backupDatabaseAuto() {
  const target = path.join(backupsDir, `clients-${ts()}.db`);
  await backupDatabase(target);
  await rotateBackups(backupsDir, 10);
  return target;
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
  closeDb: () => { try { db.close(); } catch {} },
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

ipcMain.on('training:delete', (event, payload = {}) => {
  try {
    const id = Number(payload.id);
    if (!id) throw new Error('ID mancante');

    const info = db.prepare('DELETE FROM training_plans WHERE id=?').run(id);
    if (info.changes === 0) throw new Error('Scheda non trovata');

    event.sender.send('training:delete:success');
  } catch (err) {
    event.sender.send('training:delete:error', err.message || 'Errore eliminazione scheda');
  }
});
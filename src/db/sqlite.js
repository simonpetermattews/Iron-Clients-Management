const fs = require('fs');
const { app } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(app.getPath('userData'), 'clients.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Abilita FK (opzionale ma consigliato)
db.pragma('foreign_keys = ON');

// Creazione tabelle (idempotente)
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
  name TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
`);

console.log('[DB] Path:', dbPath);
console.log('[DB] Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());

// Esempi funzioni
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

module.exports = {
    insertClient,
    getClient,
    listClients,
    updateClient,
    deleteClient,
    db
};
const fs = require('fs');
const path = require('path');
const dbFile = path.join(__dirname, '..', 'data', 'database.sqlite');
const Database = require('better-sqlite3');

const db = new Database(dbFile);
const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations');

const applied = db.prepare(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)`);
applied.run();

const hasMigration = db.prepare('SELECT name FROM _migrations WHERE name = ?');
const saveMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

for (const file of fs.readdirSync(migrationsDir).sort()) {
  if (!file.endsWith('.sql')) continue;
  if (hasMigration.get(file)) continue;
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  db.exec(sql);
  saveMigration.run(file);
  console.log('Applied', file);
}

console.log('Done.');
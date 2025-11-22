const db = require('../db/sqlite');
const Client = require('../models/client');

function createClient(data) {
  const stmt = db.prepare(
    `INSERT INTO clients (name, email, phone, birth_date)
     VALUES (?, ?, ?, ?)`
  );
  const info = stmt.run(
    data.name,
    data.email,
    data.phone,
    data.birth_date || null
  );
  return getClientById(info.lastInsertRowid);
}

function getAllClients() {
  return db
    .prepare(`SELECT * FROM clients ORDER BY id DESC`)
    .all()
    .map(row => new Client(row));
}

function getClientById(id) {
  const row = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  return row ? new Client(row) : null;
}

function updateClient(id, data) {
  const stmt = db.prepare(
    `UPDATE clients
     SET name = ?, email = ?, phone = ?, birth_date = ?
     WHERE id = ?`
  );
  stmt.run(
    data.name,
    data.email,
    data.phone,
    data.birth_date || null,
    id
  );
  return getClientById(id);
}

function deleteClient(id) {
  db.prepare(`DELETE FROM clients WHERE id = ?`).run(id);
}

module.exports = {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
};
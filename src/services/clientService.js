const db = require('../db/sqlite');
const Client = require('../models/client');

const createClient = async (clientData) => {
    const client = new Client(clientData);
    if (!client.isValid()) {
        throw new Error('Invalid client data');
    }
    const query = 'INSERT INTO clients (name,  phone) VALUES (?, ?, ?)';
    const params = [client.name, client. client.phone];
    await db.run(query, params);
};

const getClients = async () => {
    const query = 'SELECT * FROM clients';
    return await db.all(query);
};

const updateClient = async (id, clientData) => {
    const client = new Client(clientData);
    if (!client.isValid()) {
        throw new Error('Invalid client data');
    }
    const query = 'UPDATE clients SET name = ? , phone = ? WHERE id = ?';
    const params = [client.name, client.phone, id];
    await db.run(query, params);
};

const deleteClient = async (id) => {
    const query = 'DELETE FROM clients WHERE id = ?';
    await db.run(query, [id]);
};

module.exports = {
    createClient,
    getClients,
    updateClient,
    deleteClient
};
const { ipcMain } = require('electron');
const clientService = require('../../services/clientService');

ipcMain.on('client:create', async (event, clientData) => {
    try {
        const newClient = await clientService.createClient(clientData);
        event.reply('client:created', newClient);
    } catch (error) {
        event.reply('client:error', error.message);
    }
});

ipcMain.on('client:read', async (event, clientId) => {
    try {
        const client = await clientService.getClientById(clientId);
        event.reply('client:read', client);
    } catch (error) {
        event.reply('client:error', error.message);
    }
});

ipcMain.on('client:update', async (event, clientId, updatedData) => {
    try {
        const updatedClient = await clientService.updateClient(clientId, updatedData);
        event.reply('client:updated', updatedClient);
    } catch (error) {
        event.reply('client:error', error.message);
    }
});

ipcMain.on('client:delete', async (event, clientId) => {
    try {
        await clientService.deleteClient(clientId);
        event.reply('client:deleted', clientId);
    } catch (error) {
        event.reply('client:error', error.message);
    }
});

ipcMain.on('client:list', async (event) => {
    try {
        const clients = await clientService.getAllClients();
        event.reply('client:list', clients);
    } catch (error) {
        event.reply('client:error', error.message);
    }
});
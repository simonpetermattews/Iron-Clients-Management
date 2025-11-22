const { ipcMain } = require('electron');
const clientService = require('../../services/clientService');

ipcMain.on('client:create', (event, clientData) => {
  try {
    const newClient = clientService.createClient({
      ...clientData,
      birth_date: clientData.birth_date || null
    });
    event.reply('client:created', newClient);
  } catch (error) {
    event.reply('client:error', error.message);
  }
});

ipcMain.on('client:read', (event, clientId) => {
  try {
    const client = clientService.getClientById(clientId);
    event.reply('client:read', client);
  } catch (error) {
    event.reply('client:error', error.message);
  }
});

ipcMain.on('client:update', (event, clientId, updatedData) => {
  try {
    const updatedClient = clientService.updateClient(clientId, updatedData);
    event.reply('client:updated', updatedClient);
  } catch (error) {
    event.reply('client:error', error.message);
  }
});

ipcMain.on('client:delete', (event, clientId) => {
  try {
    clientService.deleteClient(clientId);
    event.reply('client:deleted', clientId);
  } catch (error) {
    event.reply('client:error', error.message);
  }
});

ipcMain.on('client:list', (event) => {
  try {
    const clients = clientService.getAllClients();
    event.reply('client:list', clients);
  } catch (error) {
    event.reply('client:error', error.message);
  }
});
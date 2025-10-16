const { contextBridge, ipcRenderer } = require('electron');
console.log('[Preload] loaded');

contextBridge.exposeInMainWorld('api', {
  send: (channel, payload) => ipcRenderer.send(channel, payload),
  on: (channel, listener) => {
    const wrapped = (_e, ...args) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  once: (channel, listener) => {
    ipcRenderer.once(channel, (_e, ...args) => listener(...args));
  },

  // Foto: metodi usati in photos.js
  getClientPhotos: (name) => ipcRenderer.invoke('get-client-photos', name),
  uploadClientPhotos: (name) => ipcRenderer.invoke('upload-client-photos', name),
  openClientPhotosFolder: (name) => ipcRenderer.invoke('open-client-photos-folder', name),
  openClientPhoto: (fileUrl) => ipcRenderer.invoke('open-client-photo', fileUrl),

  // Apertura finestra Foto dal renderer principale
  openPhotosWindow: (clientName) => ipcRenderer.send('photos:open', { clientName }),
});
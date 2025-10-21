  const { contextBridge, ipcRenderer } = require('electron');
console.log('[Preload] loaded');

contextBridge.exposeInMainWorld('api', {
  send: (channel, payload) => ipcRenderer.send(channel, payload),
  on: (channel, fn) => ipcRenderer.on(channel, (_e, data) => fn(data)),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Finestra foto (usata da renderer.js)
  openPhotosWindow: (clientName) => ipcRenderer.send('photos:open', { clientName }),

  // Foto: usate da photos.js
  getClientPhotos: (name) => ipcRenderer.invoke('get-client-photos', name),
  uploadClientPhotos: (name) => ipcRenderer.invoke('upload-client-photos', name),
  openClientPhotosFolder: (name) => ipcRenderer.invoke('open-client-photos-folder', name),
  openClientPhoto: (fileUrl) => ipcRenderer.invoke('open-client-photo', fileUrl),
});
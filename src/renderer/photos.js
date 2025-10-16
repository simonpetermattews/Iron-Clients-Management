(function () {
  const api = (() => {
    if (window.api) return window.api;
    try {
      const { ipcRenderer } = require('electron');
      return {
        getClientPhotos: (name) => ipcRenderer.invoke('get-client-photos', name),
        uploadClientPhotos: (name) => ipcRenderer.invoke('upload-client-photos', name),
        openClientPhotosFolder: (name) => ipcRenderer.invoke('open-client-photos-folder', name),
        openClientPhoto: (fileUrl) => ipcRenderer.invoke('open-client-photo', fileUrl),
      };
    } catch {
      return null;
    }
  })();

  if (!api) {
    console.error('IPC API non disponibile. Abilita nodeIntegration o esponi window.api nel preload.');
    return;
  }

  const params = new URLSearchParams(location.search);
  const clientName = params.get('client') || 'Cliente';
  const title = document.getElementById('client-title');
  const uploadBtn = document.getElementById('upload-btn');
  const openFolderBtn = document.getElementById('open-folder-btn');
  const gallery = document.getElementById('gallery');
  const emptyMsg = document.getElementById('empty-msg');

  title.textContent = `Foto: ${clientName}`;

  const render = (files) => {
    gallery.innerHTML = '';
    if (!files || files.length === 0) {
      emptyMsg.hidden = false;
      return;
    }
    emptyMsg.hidden = true;
    for (const url of files) {
      const img = document.createElement('img');
      img.src = url; // file:// URL restituita dal main
      img.alt = clientName;
      img.addEventListener('dblclick', () => api.openClientPhoto(url));
      gallery.appendChild(img);
    }
  };

  const load = async () => {
    try {
      const files = await api.getClientPhotos(clientName);
      render(files);
    } catch (e) {
      console.error(e);
    }
  };

  uploadBtn.addEventListener('click', async () => {
    try {
      const files = await api.uploadClientPhotos(clientName);
      if (files && files.length) await load();
    } catch (e) {
      console.error(e);
    }
  });

  openFolderBtn?.addEventListener('click', () => {
    api.openClientPhotosFolder(clientName);
  });

  load();
})();
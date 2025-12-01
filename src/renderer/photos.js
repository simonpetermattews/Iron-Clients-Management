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
  const rawClient = (params.get('client') || '').trim();
  const clientName = rawClient || null;

  const title = document.getElementById('client-title');
  const uploadBtn = document.getElementById('upload-btn');
  const openFolderBtn = document.getElementById('open-folder-btn');
  const gallery = document.getElementById('gallery');
  const emptyMsg = document.getElementById('empty-msg');

  title.textContent = `Foto: ${rawClient || 'Cliente'}`;

  const requireClient = () => {
    if (!clientName) {
      alert('Nessun cliente selezionato.');
      return false;
    }
    return true;
  };

  // --- Nuove funzioni per data/caption ---
  const loadPhotoDate = (url) => localStorage.getItem('photoDate:' + url) || '';
  const savePhotoDate = (url, date) => {
    if (!date) {
      localStorage.removeItem('photoDate:' + url);
    } else {
      localStorage.setItem('photoDate:' + url, date);
    }
  };
  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium' }).format(new Date(iso));
    } catch {
      return iso;
    }
  };
  // ---------------------------------------

  const render = (files) => {
    gallery.innerHTML = '';
    if (!files || files.length === 0) {
      emptyMsg.hidden = false;
      return;
    }
    emptyMsg.hidden = true;
    for (const url of files) {
      const figure = document.createElement('figure');
      figure.className = 'photo-item';
      figure.style.display = 'inline-flex';
      figure.style.flexDirection = 'column';
      figure.style.alignItems = 'center';
      figure.style.margin = '8px';
      figure.style.maxWidth = '180px';

      const img = document.createElement('img');
      img.src = url;
      img.alt = clientName;
      img.style.maxWidth = '160px';
      img.style.cursor = 'pointer';
      img.addEventListener('dblclick', () => api.openClientPhoto(url));

      const storedDate = loadPhotoDate(url);

      // Input date nascosto
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.value = storedDate;
      dateInput.style.position = 'absolute';
      dateInput.style.opacity = '0';
      dateInput.style.pointerEvents = 'none';
      dateInput.tabIndex = -1;
      dateInput.addEventListener('change', () => {
        savePhotoDate(url, dateInput.value);
        dateSpan.textContent = formatDate(dateInput.value);
      });

      const caption = document.createElement('figcaption');
      caption.style.fontSize = '0.75rem';
      caption.style.color = '#d1d1d1ff';
      caption.style.minHeight = '1.2em';
      caption.style.marginTop = '4px';
      caption.style.display = 'flex';
      caption.style.alignItems = 'center';
      caption.style.gap = '4px';

      const dateSpan = document.createElement('span');
      dateSpan.textContent = formatDate(storedDate) || '—';

      const arrowBtn = document.createElement('button');
      arrowBtn.type = 'button';
      arrowBtn.textContent = '▾';
      arrowBtn.title = 'Imposta data';
      arrowBtn.style.cursor = 'pointer';
      arrowBtn.style.background = 'transparent';
      arrowBtn.style.border = '1px solid #444';
      arrowBtn.style.borderRadius = '4px';
      arrowBtn.style.padding = '0 4px';
      arrowBtn.style.lineHeight = '1.1';
      arrowBtn.style.color = '#d1d1d1ff';
      arrowBtn.addEventListener('click', () => {
        // Mostra il picker nativo
        if (dateInput.showPicker) {
          dateInput.showPicker();
        } else {
          dateInput.click();
        }
      });

      caption.appendChild(dateSpan);
      caption.appendChild(arrowBtn);

      figure.appendChild(img);
      figure.appendChild(caption);
      figure.appendChild(dateInput); // rimane nel DOM, ma invisibile
      gallery.appendChild(figure);
    }
  };

  const load = async () => {
    try {
      const files = await api.getClientPhotos(clientName ?? undefined);
      render(files);
    } catch (e) {
      console.error(e);
    }
  };

  uploadBtn.addEventListener('click', async () => {
    if (!requireClient()) return;
    try {
      const files = await api.uploadClientPhotos(clientName);
      if (files && files.length) await load();
    } catch (e) {
      console.error(e);
    }
  });

  openFolderBtn?.addEventListener('click', () => {
    if (!requireClient()) return;
    api.openClientPhotosFolder(clientName);
  });

  load();
})();
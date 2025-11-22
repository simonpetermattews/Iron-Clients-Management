// Usa solo il bridg
//  esposto dal preload
const ipc = window.api;

document.addEventListener('DOMContentLoaded', () => {
  if (!ipc) {
    console.error('IPC bridge non disponibile. Controlla preload.js e webPreferences.');
    return;
  }

  // Riferimenti DOM
  const tbody = document.getElementById('clients-tbody');
  const modal = document.getElementById('client-modal');
  const openModalBtn = document.getElementById('open-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const container = document.getElementById('form-container');
  const modalTitle = document.getElementById('modal-title');
  let editingClientId = null;

  if (!tbody) {
    console.warn('#clients-tbody non trovato. Verifica index.html.');
  }

  // Modal helpers
  function openModal() {
    modal?.classList.add('show');
    modal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    setTimeout(() => {
      const firstField = document.querySelector('#form-container input, #form-container select, #form-container textarea');
      firstField?.focus();
    }, 0);
  }
  function closeModal() {
    modal?.classList.remove('show');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }

  openModalBtn?.addEventListener('click', () => {
    editingClientId = null;
    ensureForm();
    modalTitle && (modalTitle.textContent = 'Registra Cliente');
    document.getElementById('register-client-form')?.reset();
    openModal();
  });
  closeModalBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal?.classList.contains('show')) closeModal(); });

  // Costruisci il form nel modale (una sola volta)
  function ensureForm() {
    if (!container) return;
    if (container.children.length) return;
    container.innerHTML = `
      <form id="register-client-form" class="p-2">
        <div class="mb-2">
          <label class="form-label">Nome</label>
          <input class="form-control" type="text" name="name" required />
        </div>
        <div class="mb-2">
          <label class="form-label">Cognome</label>
          <input class="form-control" type="text" name="surname" />
        </div>
        <div class="mb-2">
          <label class="form-label">Data di nascita</label>
          <input class="form-control" type="date" name="birth_date" />
        </div>
        <div class="mb-2">
          <label class="form-label">Telefono</label>
          <input class="form-control" type="text" name="phone" />
        </div>
        <button type="submit" class="btn btn-primary">Salva</button>
      </form>
    `;
  }
  ensureForm();

  // Submit form: crea/aggiorna e chiudi al successo
  container?.addEventListener('submit', (e) => {
    const form = e.target;
    if (form?.id !== 'register-client-form') return;
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {
      name: (data.name || '').trim(),
      surname: (data.surname || '').trim(),
      phone: (data.phone || '').trim(),
      birth_date: data.birth_date || null
    };

    if (editingClientId) {
      ipc.send('client:update', { id: editingClientId, ...payload });
    } else {
      ipc.send('client:create', payload);
    }
  });

  // IPC listeners (il preload passa solo i dati, non l'evento)
  ipc.on('client:read:success', (rows) => renderClients(rows));
  ipc.on('client:read:error', (msg) => {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Errore: ${escapeHtml(msg)}</td></tr>`;
  });

  ipc.on('client:create:success', () => {
    document.getElementById('register-client-form')?.reset();
    closeModal();
    ipc.send('client:read');
  });
  ipc.on('client:create:error', (msg) => alert('Errore creazione cliente: ' + msg));

  ipc.on('client:update:success', () => {
    editingClientId = null;
    closeModal();
    ipc.send('client:read');
  });
  ipc.on('client:update:error', (msg) => alert('Errore aggiornamento cliente: ' + msg));

  ipc.on('client:delete:success', () => ipc.send('client:read'));
  ipc.on('client:delete:error', (msg) => alert('Errore eliminazione cliente: ' + msg));

  // Tabella clienti
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function renderClients(rows = []) {
    if (!tbody) return;
    const safe = Array.isArray(rows) ? rows : [];
    tbody.innerHTML = safe.map(r => {
      const rawDate = r.birth_date || '';
      const dateDisplay = rawDate ? new Date(rawDate).toLocaleDateString('it-IT') : '';
      return `
      <tr data-id="${r.id}">
        <td>${escapeHtml(r.name || '')}</td>
        <td>${escapeHtml(r.surname || '')}</td>
        <td data-raw-date="${escapeHtml(rawDate)}">${escapeHtml(dateDisplay)}</td>
        <td>${escapeHtml(r.phone || '')}</td>
        <td>
          <button class="btn btn-sm btn-primary" data-action="detail"><i class="bi bi-clipboard-data-fill"></i></button>
          <button class="btn btn-sm btn-warning ms-3" data-action="edit"><i class="bi bi-pen"></i></button>
          <button class="btn btn-sm btn-danger ms-3" data-action="delete"><i class="bi bi-trash3"></i></button>
        </td>
        <td>
          <button class="btn btn-sm btn-success" data-action="photos"><i class="bi bi-camera-fill"></i></button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6">Nessun cliente presente</td></tr>`;
  }

  // Delegation per azioni sulla tabella
  tbody?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = Number(tr?.dataset.id);
    const action = btn.dataset.action;
    if (!id) return;

    switch (action) {
      case 'detail':
        ipc.send('client:detail:open', { clientId: id });
        break;
      case 'edit': {
        editingClientId = id;
        modalTitle && (modalTitle.textContent = 'Modifica Cliente');
        ensureForm();
        const form = document.getElementById('register-client-form');
        const tds = tr.querySelectorAll('td');
        if (form) {
          form.name.value = tds[0]?.textContent?.trim() || '';
          form.surname.value = tds[1]?.textContent?.trim() || '';
          form.birth_date.value = tds[2]?.dataset?.rawDate || '';
          form.phone.value = tds[3]?.textContent?.trim() || '';
        }
        openModal();
        break;
      }
      case 'delete':
        if (confirm('Eliminare questo cliente?')) ipc.send('client:delete', id);
        break;
      case 'photos': {
        const first = tr.cells?.[0]?.textContent?.trim() || '';
        const last = tr.cells?.[1]?.textContent?.trim() || '';
        const displayName = [first, last].filter(Boolean).join(' ');
        ipc.openPhotosWindow?.(displayName);
        break;
      }
    }
  });

  // Caricamento iniziale
  ipc.send('client:read');

  if (!window.api) {
    console.warn('IPC bridge non disponibile. Controlla preload.js e webPreferences.');
  } else {
    // esempio: chiedi le schede
    window.api.send('training:list', { clientId: 1 });
    window.api.on('training:list:success', (rows) => {
      console.table(rows); // più leggibile di [object Object]
      // console.log(JSON.stringify(rows, null, 2));
    });
    window.api.on('training:list:error', (msg) => {
      console.error('Errore:', msg);
    });
  }

  const formEl = document.getElementById('client-form');
  formEl?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(formEl);
    const payload = {
      name: fd.get('name')?.trim(),
      surname: fd.get('surname')?.trim(),
      phone: fd.get('phone')?.trim() || null,
      DataNascita: fd.get('data_nascita') || null
    };
    window.api.send('client:create', payload);
  });

  const form = document.getElementById('client-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const clientData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        birth_date: document.getElementById('birth_date').value || null
      };
      window.electronAPI.send('client:create', clientData);
    });
  }
});
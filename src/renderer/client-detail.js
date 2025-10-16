// Sostituisce l'uso di require con il bridge
const ipc = window.api;

function getClientIdFromQuery() {
  const p = new URLSearchParams(location.search);
  return p.get('id');
}

const clientId = getClientIdFromQuery();
const clientNameEl = document.getElementById('client-name');
const clientSurnameEl = document.getElementById('client-surname');
const clientMetaEl = document.getElementById('client-meta');
const trainingsListEl = document.getElementById('trainings-list');
const backBtn = document.getElementById('back-btn');

// Modal elements
const modal = document.getElementById('training-modal');
const openModalBtn = document.getElementById('new-training-btn');
const closeModalBtn = document.getElementById('training-modal-close');
const cancelModalBtn = document.getElementById('cancel-training-btn');
const form = document.getElementById('training-form');
let editingTrainingId = null;
let currentTrainings = [];

backBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  window.close();
});

// Helpers
function openModal() {
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  setTimeout(() => {
    const first = modal.querySelector('input, select, textarea, button');
    first?.focus();
  }, 0);
}
function closeModal() {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}

openModalBtn?.addEventListener('click', openModal);
closeModalBtn?.addEventListener('click', closeModal);
cancelModalBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
});

function safeToLocale(str) {
  if (!str) return '';
  // SQLite returns "YYYY-MM-DD HH:MM:SS"; make it ISO-ish for Date()
  const isoish = str.replace(' ', 'T');
  const d = new Date(isoish);
  return isNaN(d.getTime()) ? str : d.toLocaleString();
}

function renderTrainings(trainings = []) {
  currentTrainings = Array.isArray(trainings) ? trainings : [];
  trainingsListEl.innerHTML = '';
  if (!Array.isArray(trainings) || trainings.length === 0) {
    trainingsListEl.innerHTML = '<div class="muted">Nessuna scheda creata.</div>';
    return;
  }

  const groups = [
    {
      title: 'Dati Anagrafici',
      fields: [
        ['Altezza', 'Altezza'],
        ['Peso', 'Peso']
      ]
    },
    {
      title: 'Circonferenze',
      fields: [
        ['CirconferenzaTorace', 'Circonferenza Torace'],
        ['CirconferenzaVita', 'Circonferenza Vita'],
        ['CirconferenzaOmbelicale', 'Circonferenza Ombelicale'],
        ['CirconferenzaFianchi', 'Circonferenza Fianchi'],
        ['CirconferenzaBraccioDx', 'Circonferenza Braccio Dx'],
        ['CirconferenzaBraccioSx', 'Circonferenza Braccio Sx'],
        ['CirconferenzaGambaDx', 'Circonferenza Gamba Dx'],
        ['CirconferenzaGambaSx', 'Circonferenza Gamba Sx']
      ]
    },
    {
      title: 'Stile di vita',
      fields: [
        ['Idratazione', 'Idratazione'],
        ['OreDiSonno', 'Ore di sonno'],
        ['Alimentazione', 'Alimentazione'],
        ['Obbiettivo', 'Obiettivo'],
        ['FrequenzaAllenamento', 'Frequenza Allenamento']
      ]
    },
    {
      title: 'Test Fisici',
      fields: [
        ['SitAndReach', 'Sit and Reach'],
        ['SideBend', 'Side Bend'],
        ['FlessibilitaSpalla', 'Flessibilità spalla'],
        ['FlamingoDx', 'Flamingo Dx'],
        ['FlamingoSx', 'Flamingo Sx'],
        ['PiegamentiBraccia', 'Piegamenti braccia'],
        ['Squat', 'Squat'],
        ['SitUp', 'Sit up'],
        ['Trazioni', 'Trazioni']
      ]
    }
  ];

  trainings.forEach(t => {
    const div = document.createElement('div');
    div.className = 'card';
    const createdAt = safeToLocale(t.created_at);

    const sectionsHtml = groups.map(g => {
      const items = g.fields
        .filter(([key]) => t[key] !== undefined && t[key] !== null && String(t[key]).trim() !== '')
        .map(([key, label]) => `
          <div class="kv">
            <div class="k">${label}</div>
            <div class="v">${t[key]}</div>
          </div>
        `)
        .join('');
      if (!items) return '';
      return `
        <div class="card-section">
          <div class="card-section-title">${g.title}</div>
          <div class="kv-grid">${items}</div>
        </div>
      `;
    }).join('');

    div.innerHTML = `
      <div class="card-title">
        <span>${createdAt || 'Scheda'}</span>
        <span>
          <button type="button" class="training-edit" data-id="${t.id}">Modifica</button>
          <button type="button" class="training-delete" data-id="${t.id}" style="margin-left:6px;">Elimina</button>
        </span>
      </div>
      ${sectionsHtml || '<div class="muted">Nessun valore inserito</div>'}
    `;
    trainingsListEl.appendChild(div);

    div.querySelector('.training-edit')?.addEventListener('click', () => {
      startEditTraining(t.id);
    });
    div.querySelector('.training-delete')?.addEventListener('click', () => {
      if (confirm('Eliminare questa scheda?')) {
        ipc.send('training:delete', { id: t.id, clientId });
      }
    });
  });
}

function setTrainingFormValues(t) {
  const set = (name, val) => { const el = form.elements[name]; if (el) el.value = val ?? ''; };
  set('altezza', t.Altezza);
  set('peso', t.Peso);
  set('circonferenza_torace', t.CirconferenzaTorace);
  set('circonferenza_vita', t.CirconferenzaVita);
  set('circonferenza_ombelicale', t.CirconferenzaOmbelicale);
  set('circonferenza_fianchi', t.CirconferenzaFianchi);
  set('circonferenza_braccio_dx', t.CirconferenzaBraccioDx);
  set('circonferenza_braccio_sx', t.CirconferenzaBraccioSx);
  set('circonferenza_gamba_dx', t.CirconferenzaGambaDx);
  set('circonferenza_gamba_sx', t.CirconferenzaGambaSx);
  set('idratazione', t.Idratazione);
  set('ore_di_sonno', t.OreDiSonno);
  set('alimentazione', t.Alimentazione);
  set('obiettivo', t.Obbiettivo);
  set('frequenza_allenamento', t.FrequenzaAllenamento);
  set('sit_and_reach', t.SitAndReach);
  set('side_bend', t.SideBend);
  set('flessibilita_spalla', t.FlessibilitaSpalla);
  set('flamingo_dx', t.FlamingoDx);
  set('flamingo_sx', t.FlamingoSx);
  set('piegamenti_braccia', t.PiegamentiBraccia);
  set('squat', t.Squat);
  set('sit_up', t.SitUp);
  set('trazioni', t.Trazioni);
}

function startEditTraining(id) {
  const t = currentTrainings.find(x => String(x.id) === String(id));
  if (!t) return;
  editingTrainingId = id;
  document.getElementById('modal-title').textContent = 'Modifica scheda allenamento';
  setTrainingFormValues(t);
  openModal();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!clientId) {
    clientNameEl.textContent = 'Cliente non trovato';
    if (clientSurnameEl) clientSurnameEl.textContent = '';
    return;
  }
  ipc.send('client:get', { clientId });
  ipc.send('training:list', { clientId });
});

ipc.on('client:get:success', (client) => {
  clientNameEl.textContent = client?.name || 'Cliente';
  if (clientSurnameEl) clientSurnameEl.textContent = client?.surname || '';
  const parts = [];
  if (client?.phone) parts.push(client.phone);
  clientMetaEl.textContent = parts.join(' • ');
});

ipc.on('client:get:error', (message) => {
  clientNameEl.textContent = 'Errore caricamento cliente';
  if (clientSurnameEl) clientSurnameEl.textContent = '';
  clientMetaEl.textContent = message || '';
});

ipc.on('training:list:success', (trainings) => {
  renderTrainings(trainings);
});

ipc.on('training:list:error', (message) => {
  trainingsListEl.innerHTML = `<div class="muted">Errore: ${message}</div>`;
});

ipc.on('training:create:error', (message) => alert('Errore salvataggio scheda: ' + message));
ipc.on('training:update:error', (message) => alert('Errore aggiornamento scheda: ' + message));

ipc.on('training:create:success', () => {
  form.reset();
  closeModal();
  ipc.send('training:list', { clientId });
});

ipc.on('training:update:success', () => {
  editingTrainingId = null;
  form.reset();
  closeModal();
  ipc.send('training:list', { clientId });
});

ipc.on('training:delete:success', () => {
  if (editingTrainingId) { editingTrainingId = null; form.reset(); closeModal(); }
  ipc.send('training:list', { clientId });
});

function toIntOrNull(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  // Mappa campi form -> colonne DB
  const payload = {
    clientId,
    title: `Scheda ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    notes: '',
    date: null,
    exercises: null,
    Altezza: toIntOrNull(data.altezza),
    Peso: toIntOrNull(data.peso),
    CirconferenzaTorace: toIntOrNull(data.circonferenza_torace),
    CirconferenzaVita: toIntOrNull(data.circonferenza_vita),
    CirconferenzaOmbelicale: toIntOrNull(data.circonferenza_ombelicale),
    CirconferenzaFianchi: toIntOrNull(data.circonferenza_fianchi),
    CirconferenzaBraccioDx: toIntOrNull(data.circonferenza_braccio_dx),
    CirconferenzaBraccioSx: toIntOrNull(data.circonferenza_braccio_sx),
    CirconferenzaGambaDx: toIntOrNull(data.circonferenza_gamba_dx),
    CirconferenzaGambaSx: toIntOrNull(data.circonferenza_gamba_sx),
    Idratazione: toIntOrNull(data.idratazione),
    OreDiSonno: toIntOrNull(data.ore_di_sonno),
    Alimentazione: data.alimentazione || '',
    Obbiettivo: data.obiettivo || '',
    FrequenzaAllenamento: data.frequenza_allenamento || '',
    SitAndReach: toIntOrNull(data.sit_and_reach),
    SideBend: toIntOrNull(data.side_bend),
    FlessibilitaSpalla: toIntOrNull(data.flessibilita_spalla),
    FlamingoDx: toIntOrNull(data.flamingo_dx),
    FlamingoSx: toIntOrNull(data.flamingo_sx),
    PiegamentiBraccia: toIntOrNull(data.piegamenti_braccia),
    Squat: toIntOrNull(data.squat),
    SitUp: toIntOrNull(data.sit_up),
    Trazioni: toIntOrNull(data.trazioni)
  };
  if (editingTrainingId) {
    ipc.send('training:update', { id: editingTrainingId, ...payload });
  } else {
    ipc.send('training:create', payload);
  }
});
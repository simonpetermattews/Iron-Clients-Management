// =========================
// SEZIONE: Bridge IPC e utilità base
// - Collega il renderer all'IPC esposto dal preload
// - Recupera l'id cliente dalla querystring
// =========================
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
const clientDobEl = document.getElementById('client-dob');
const trainingsListEl = document.getElementById('trainings-list');
const backBtn = document.getElementById('back-btn');

// =========================
// SEZIONE: Riferimenti DOM e modale
// - Puntatori agli elementi
// - Stato di editing
// =========================
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

// =========================
// SEZIONE: Helper di UI e formattazione
// - open/close modale
// - parsing date
// - coercizione numeri
// =========================
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

openModalBtn?.addEventListener('click', () => {
  // nuovo: reset tabella Cooper quando si apre una nuova scheda
  editingTrainingId = null;
  setCooperHRs([]);
  openModal();
});
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
  const isoish = str.replace(' ', 'T');
  const d = new Date(isoish);
  return isNaN(d.getTime()) ? str : d.toLocaleString();
}

// Aggiungi: helper per titolo automatico basato sulla data
function itDateString(s) {
  if (!s) return new Date().toLocaleDateString('it-IT');
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('it-IT') : d.toLocaleDateString('it-IT');
}
function isAutoTitle(t) {
  const base = t?.date || t?.created_at;
  const expected = `${itDateString(base)}`;
  return String(t?.title || '').trim() === expected;
}

// Converte numerico o restituisce null
function toIntOrNull(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// =========================
// SEZIONE: Render schede salvate
// - Raggruppa i campi in sezioni
// - Ogni sezione è una tabella Bootstrap
// - Aggiunge unità di misura dove opportuno
// =========================
function renderTrainings(trainings = []) {
  currentTrainings = Array.isArray(trainings) ? trainings : [];
  trainingsListEl.innerHTML = '';
  if (!Array.isArray(trainings) || trainings.length === 0) {
    trainingsListEl.innerHTML = '<div class="muted">Nessuna scheda creata.</div>';
    return;
  }

  // Formatter per unità di misura nelle schede salvate
  const formatWithUnit = (key, val) => {
    if (val === undefined || val === null || String(val).trim() === '') return '';
    const cmKeys = [
      'CirconferenzaTorace', 'CirconferenzaVita', 'CirconferenzaOmbelicale', 'CirconferenzaFianchi',
      'CirconferenzaBraccioDx', 'CirconferenzaBraccioSx', 'CirconferenzaGambaDx', 'CirconferenzaGambaSx'
    ];
    if (cmKeys.includes(key)) return `${val} cm`;
    if (key === 'Peso') return `${val} kg`;
    if (key === 'Idratazione') return `${val} lt`;
    return val;
  };

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
      title: 'Infortuni e Patologie',
      fields: [
        ['Infortuni', 'Infortuni'],
        ['Patologie', 'Patologie'],
        ['EsperienzeSportive', 'Esperienze sportive']
      ]
    },
    {
      title: 'Test Fisici',
      fields: [
        ['SitAndReach', 'Sit and Reach'],
        ['SideBendDx', 'Side Bend Dx'],
        ['SideBendSx', 'Side Bend Sx'],
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
    const displayTitle = t.title || createdAt || '';

    const sectionsHtml = groups.map(g => {
      const rows = g.fields
        .filter(([key]) => t[key] !== undefined && t[key] !== null && String(t[key]).trim() !== '')
        .map(([key, label]) => {
          let raw = formatWithUnit(key, t[key]);
          // Campi multilinea: converti <,>,& e \n -> <br>
          const multilineKeys = [
            'Alimentazione','Obbiettivo','FrequenzaAllenamento',
            'Infortuni','Patologie','EsperienzeSportive'
          ];
          const isMultiline = multilineKeys.includes(key);
          if (isMultiline) {
            raw = String(raw)
              .replace(/&/g,'&amp;')
              .replace(/</g,'&lt;')
              .replace(/>/g,'&gt;')
              .replace(/\r\n|\r|\n/g,'<br>');
          } else {
            raw = String(raw)
              .replace(/&/g,'&amp;')
              .replace(/</g,'&lt;')
              .replace(/>/g,'&gt;');
          }
          const wrapClass = isMultiline ? ' class="text-multiline"' : '';
          return `
            <tr>
              <th scope="row">${label}</th>
              <td${wrapClass}>${raw}</td>
            </tr>
          `;
        })
        .join('');
      if (!rows) return '';
      return `
        <div class="card-section">
          <div class="card-section-title">${g.title}</div>
          <div class="table-responsive">
            <table class="table table-dark table-striped table-hover table-sm mb-2">
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    // Tabella Test Cooper (risultati)
    const cooperHtml = cooperTableHtmlFromJSON(t.CooperFreq);

    div.innerHTML = `
      <div class="card-title">
        <span>${displayTitle}</span>
        <span>
          <button type="button" class="training-edit" data-id="${t.id}">Modifica</button>
          <button type="button" class="training-delete" data-id="${t.id}" style="margin-left:6px;">Elimina</button>
        </span>
      </div>
      ${sectionsHtml || '<div class="muted">Nessun valore inserito</div>'}
      ${cooperHtml}
    `;
    trainingsListEl.appendChild(div);

    div.querySelector('.training-edit')?.addEventListener('click', () => {
      startEditTraining(t.id);
    });
    div.querySelector('.training-delete')?.addEventListener('click', () => {
      if (confirm('Eliminare questa scheda?')) {
        ipc.send('training:delete', { id: t.id }); // clientId non necessario
      }
    });
  });
}

function setTrainingFormValues(t) {
  const set = (name, val) => { const el = form.elements[name]; if (el) el.value = val ?? ''; };
  // nuovi campi titolo/data
  set('date', t.date ? t.date.split('T')[0] : '');   // assume formato ISO/AAAA-MM-GG
  set('title', t.title);
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
  set('infortuni', t.Infortuni);
  set('patologie', t.Patologie);
  set('esperienze_sportive', t.EsperienzeSportive);
  set('sit_and_reach', t.SitAndReach);
  set('side_bend_dx', t.SideBendDx);   // FIX
  set('side_bend_sx', t.SideBendSx);   // FIX
  set('flessibilita_spalla', t.FlessibilitaSpalla);
  set('flamingo_dx', t.FlamingoDx);
  set('flamingo_sx', t.FlamingoSx);
  set('piegamenti_braccia', t.PiegamentiBraccia);
  set('squat', t.Squat);
  set('sit_up', t.SitUp);
  set('trazioni', t.Trazioni);
  set('infortuni', t.Infortuni);
  set('patologie', t.Patologie);
  set('esperienze_sportive', t.EsperienzeSportive);
}

function startEditTraining(id) {
  // =========================
  // SEZIONE: Avvio modifica scheda
  // - Carica valori nel form
  // - Carica righe Test Cooper
  // - Apre la modale
  // =========================
  const t = currentTrainings.find(x => String(x.id) === String(id));
  if (!t) return;
  editingTrainingId = id;
  document.getElementById('modal-title').textContent = 'Modifica scheda allenamento';
  setTrainingFormValues(t);

  // nuovo: carica tabella Cooper in modifica
  try {
    const arr = t?.CooperFreq ? JSON.parse(t.CooperFreq) : [];
    setCooperHRs(Array.isArray(arr) ? arr : []);
  } catch {
    setCooperHRs([]);
  }

  openModal();
}

document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // SEZIONE: Bootstrap caricamento iniziale
  // - Carica dati cliente e lista schede
  // =========================
  if (!clientId) {
    clientNameEl.textContent = 'Cliente non trovato';
    if (clientSurnameEl) clientSurnameEl.textContent = '';
    return;
  }
  ipc.send('client:get', { clientId });
  ipc.send('training:list', { clientId });
});

// =========================
// SEZIONE: Handler IPC
// - Success/Errore per cliente, lista, create/update/delete
// =========================
ipc.on('client:get:success', (client) => {
  const fullName = [client?.name, client?.surname].filter(Boolean).join(' ');
  clientNameEl.textContent = fullName || 'Cliente';
  const parts = [];
  if (client?.phone) parts.push(client.phone);
  clientMetaEl.textContent = parts.join(' • ');
  if (clientDobEl) clientDobEl.textContent = client?.DataNascita ? `Data di nascita: ${client.DataNascita}` : '';
  document.getElementById('client-birth-date').textContent =
    client.birth_date || '—';
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

// AGGIUNGERE: refresh dopo delete e gestione errori
ipc.on('training:delete:success', () => {
  ipc.send('training:list', { clientId });
});
ipc.on('training:delete:error', (message) => {
  alert('Errore eliminazione scheda: ' + (message || ''));
});

ipc.on('training:create:success', () => {
  form.reset();
  setCooperHRs([]); // nuovo: reset tabella dopo salvataggio
  closeModal();
  ipc.send('training:list', { clientId });
});

ipc.on('training:update:success', () => {
  editingTrainingId = null;
  form.reset();
  setCooperHRs([]); // nuovo: reset tabella dopo salvataggio
  closeModal();
  ipc.send('training:list', { clientId });
});

// =========================
// SEZIONE: Submit form scheda
// - Costruzione payload
// - Serializzazione Test Cooper
// - Create/Update in base allo stato
// =========================
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());

  const rawDate = (data.date || '').trim();
  const rawTitle = (data.title || '').trim();

  // Se in modifica e il titolo era "automatico" e non toccato, forza rigenerazione
  let titleToSend = rawTitle;
  if (editingTrainingId) {
    const original = currentTrainings.find(x => String(x.id) === String(editingTrainingId));
    if (original && isAutoTitle(original) && rawTitle === (original.title || '')) {
      titleToSend = ''; // il backend lo rigenera usando la nuova data
    }
  }

  const payload = {
    clientId,
    title: titleToSend || '',
    date: rawDate || null,
    notes: '',
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
    Infortuni: data.infortuni || '',
    Patologie: data.patologie || '',
    EsperienzeSportive: data.esperienze_sportive || '',
    SitAndReach: toIntOrNull(data.sit_and_reach),
    SideBendDx: toIntOrNull(data.side_bend_dx),
    SideBendSx: toIntOrNull(data.side_bend_sx),
    FlessibilitaSpalla: toIntOrNull(data.flessibilita_spalla),
    FlamingoDx: toIntOrNull(data.flamingo_dx),
    FlamingoSx: toIntOrNull(data.flamingo_sx),
    PiegamentiBraccia: toIntOrNull(data.piegamenti_braccia),
    Squat: toIntOrNull(data.squat),
    SitUp: toIntOrNull(data.sit_up),
    Trazioni: toIntOrNull(data.trazioni)
  };

  const cooper = getCooperHRs();
  payload.CooperFreq = JSON.stringify(Array.isArray(cooper) ? cooper : []);

  if (editingTrainingId) {
    ipc.send('training:update', { id: editingTrainingId, ...payload });
  } else {
    ipc.send('training:create', payload);
  }
});

// =========================
// SEZIONE: Test Cooper (modale) - versione con TRE riposi finali
// =========================
const cooperRowsTbody = document.getElementById('cooper-rows-tbody');
const cooperAddBtn = document.getElementById('cooper-add-btn');

function cooperSpeedAt(stepIndex) { return 8 + stepIndex * 1; }      // adattabile
function cooperTimeAt(stepIndex) { return (stepIndex + 1) * 2; }      // adattabile

function createHRInput(initialHR) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.className = 'form-control form-control-sm';
  input.placeholder = 'bpm';
  if (typeof initialHR === 'number' && Number.isFinite(initialHR)) input.value = String(initialHR);
  return input;
}

function addCooperExerciseRow(initialHR) {
  if (!cooperRowsTbody) return;
  const tr = document.createElement('tr');
  tr.dataset.type = 'exercise';

  tr.innerHTML = `
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
  `;
  const hrInput = createHRInput(initialHR);
  tr.children[3].appendChild(hrInput);

  const rm = document.createElement('button');
  rm.type = 'button';
  rm.textContent = 'Rimuovi';
  rm.className = 'btn btn-outline-danger btn-sm';
  rm.addEventListener('click', () => {
    tr.remove();
    if (!hasExerciseRows()) {
      addCooperExerciseRow(); // mantieni almeno uno
    }
    renumberCooperRows();
  });
  tr.children[4].appendChild(rm);

  // Inserisci prima della prima riga di riposo (ora sono 3)
  const firstRestRow = cooperRowsTbody.querySelector('tr[data-type="rest"]');
  if (firstRestRow) cooperRowsTbody.insertBefore(tr, firstRestRow);
  else cooperRowsTbody.appendChild(tr);

  ensureRestRow(); // ora garantisce 3 righe di riposo
  renumberCooperRows();
}

// Garantisce 3 righe "Riposo": "Riposo 1", "Riposo 2", "Riposo 3"
// initialHRs può essere: undefined | number (compat) | number[3]
function ensureRestRow(initialHRs) {
  if (!cooperRowsTbody) return;
  // Rimuovi eventuali extra
  let restRows = [...cooperRowsTbody.querySelectorAll('tr[data-type="rest"]')];
  while (restRows.length > 3) {
    restRows.pop().remove();
  }
  // Crea mancanti
  for (let i = restRows.length; i < 3; i++) {
    const tr = document.createElement('tr');
    tr.dataset.type = 'rest';
    tr.innerHTML = `
      <td></td>
      <td>—</td>
      <td>—</td>
      <td></td>
      <td></td>
    `;
    tr.children[3].appendChild(createHRInput());
    cooperRowsTbody.appendChild(tr);
  }
  // Aggiorna etichette e valori
  restRows = [...cooperRowsTbody.querySelectorAll('tr[data-type="rest"]')];
  restRows.forEach((tr, i) => {
    tr.children[0].textContent = `Riposo ${i + 1}`;
    const inp = tr.querySelector('input');
    if (Array.isArray(initialHRs)) {
      const v = initialHRs[i];
      if (v !== undefined) inp.value = Number.isFinite(v) ? String(v) : '';
    } else if (initialHRs !== undefined) {
      // retrocompatibilità: singolo valore -> Riposo 1
      inp.value = Number.isFinite(initialHRs) ? String(initialHRs) : '';
    }
  });
}

function hasExerciseRows() {
  return !!cooperRowsTbody.querySelector('tr[data-type="exercise"]');
}

function renumberCooperRows() {
  if (!cooperRowsTbody) return;
  const exerciseRows = [...cooperRowsTbody.querySelectorAll('tr[data-type="exercise"]')];
  exerciseRows.forEach((tr, i) => {
    tr.children[0].textContent = String(i + 1);
    tr.children[1].textContent = `${cooperSpeedAt(i).toFixed(1)} Km/h`;
    tr.children[2].textContent = `${cooperTimeAt(i)} min`;
  });
}

function getCooperHRs() {
  if (!cooperRowsTbody) return [];
  const exerciseHR = [...cooperRowsTbody.querySelectorAll('tr[data-type="exercise"] input')]
    .map(inp => {
      const n = Number(inp.value);
      return Number.isFinite(n) ? n : null;
    })
    .filter(v => v !== null);

  const restInputs = [...cooperRowsTbody.querySelectorAll('tr[data-type="rest"] input')].slice(0, 3);
  const restHRs = restInputs.map(inp => {
    const n = Number(inp.value);
    return Number.isFinite(n) ? n : null; // mantieni slot con null se vuoto
  });

  return [...exerciseHR, ...restHRs];
}

// Array: [HR esercizio 1, ..., HR esercizio N, HR riposo 1, HR riposo 2, HR riposo 3]
function setCooperHRs(arr = []) {
  if (!cooperRowsTbody) return;
  cooperRowsTbody.innerHTML = '';

  const list = Array.isArray(arr) ? arr : [];
  const len = list.length;

  const exerciseValues = len > 3 ? list.slice(0, -3) : [];
  const restSlice = len >= 1 ? list.slice(-3) : [];
  const restValues = [undefined, undefined, undefined];
  for (let i = 0; i < restSlice.length; i++) {
    restValues[i] = restSlice[i];
  }

  if (exerciseValues.length === 0) {
    addCooperExerciseRow();
  } else {
    exerciseValues.forEach(v => addCooperExerciseRow(v));
  }
  ensureRestRow(restValues);
  renumberCooperRows();
}

cooperAddBtn?.addEventListener('click', () => addCooperExerciseRow());

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
  if (cooperRowsTbody && cooperRowsTbody.children.length === 0) setCooperHRs([]);
});

// Rendering in card (interpreta ultimi 3 elementi come riposi)
function cooperTableHtmlFromJSON(cooperJson) {
  let arr = [];
  try { arr = JSON.parse(cooperJson || '[]'); } catch { arr = []; }
  if (!Array.isArray(arr) || arr.length === 0) return '';

  const restValues = arr.length >= 3 ? arr.slice(-3) : [];
  const exerciseHR = arr.length > 3 ? arr.slice(0, -3) : [];

  const exerciseRows = exerciseHR.map((hr, i) => {
    return `<tr><td>${i + 1}</td><td>${cooperSpeedAt(i).toFixed(1)} Km/h</td><td>${cooperTimeAt(i)} min</td><td>${hr} bpm</td></tr>`;
  }).join('');

  const restRows = restValues.map((hr, i) => {
    if (!Number.isFinite(hr)) return '';
    return `<tr><td>Riposo ${i + 1}</td><td>—</td><td>—</td><td>${hr} bpm</td></tr>`;
  }).join('');

  const rows = `${exerciseRows}${restRows}`;
  if (!rows) return '';

  return `
    <div class="card-section">
      <div class="card-section-title">Test Cooper</div>
      <div class="table-responsive">
        <table class="table table-dark table-striped table-hover table-sm mb-2">
          <thead>
            <tr>
              <th>#</th><th>Velocità (Km/h)</th><th>Tempo (min)</th><th>FC (bpm)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTraining(t) {
  const card = document.createElement('div');
  card.className = 'training-card';

  const alimentazioneEl = document.createElement('div');
  alimentazioneEl.className = 'training-text';
  alimentazioneEl.textContent = t.alimentazione || '';

  const obiettivoEl = document.createElement('div');
  obiettivoEl.className = 'training-text';
  obiettivoEl.textContent = t.obiettivo || '';

  // aggiungi gli altri campi textarea allo stesso modo...

  card.appendChild(alimentazioneEl);
  card.appendChild(obiettivoEl);
  // ...append altri campi
  return card;
}
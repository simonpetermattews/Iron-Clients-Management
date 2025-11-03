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
      'CirconferenzaTorace',
      'CirconferenzaVita',
      'CirconferenzaOmbelicale',
      'CirconferenzaFianchi',
      'CirconferenzaBraccioDx',
      'CirconferenzaBraccioSx',
      'CirconferenzaGambaDx',
      'CirconferenzaGambaSx'
    ];
    if (cmKeys.includes(key)) return `${val} cm`;
    if (key === 'Peso') return `${val} kg`;
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
      title: 'Test Fisici',
      fields: [
        ['SitAndReach', 'Sit and Reach'],
        ['SideBendDx', 'Side Bend Dx'],   // FIX
        ['SideBendSx', 'Side Bend Sx'],   // FIX
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
      const rows = g.fields
        .filter(([key]) => t[key] !== undefined && t[key] !== null && String(t[key]).trim() !== '')
        .map(([key, label]) => {
          const value = formatWithUnit(key, t[key]);
          const wrapClass = (key === 'Alimentazione' || key === 'Obbiettivo') ? ' class="text-wrap text-break"' : '';
          return `
            <tr>
              <th scope="row">${label}</th>
              <td${wrapClass}>${value}</td>
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
        <span>${createdAt || 'Scheda'}</span>
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
  // =========================
  // SEZIONE: Popolamento form (modifica)
  // - Mappa i campi del record alle input del form
  // =========================
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
  set('side_bend_dx', t.SideBendDx);   // FIX
  set('side_bend_sx', t.SideBendSx);   // FIX
  set('flessibilita_spalla', t.FlessibilitaSpalla);
  set('flamingo_dx', t.FlamingoDx);
  set('flamingo_sx', t.FlamingoSx);
  set('piegamenti_braccia', t.PiegamentiBraccia);
  set('squat', t.Squat);
  set('sit_up', t.SitUp);
  set('trazioni', t.Trazioni);
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

  // Frequenze Cooper -> JSON
  const cooper = getCooperHRs();
  payload.CooperFreq = JSON.stringify(Array.isArray(cooper) ? cooper : []);

  if (editingTrainingId) {
    ipc.send('training:update', { id: editingTrainingId, ...payload });
  } else {
    ipc.send('training:create', payload);
  }
});

// =========================
// SEZIONE: Test Cooper (modale)
// - Config step
// - Aggiunta/rinumerazione righe
// - Get/Set array frequenze cardiache
// =========================
const cooperCfg = { baseSpeed: 8.5, baseTime: 0, stepSpeed: 1, stepTime: 2 };
const cooperRowsTbody = document.getElementById('cooper-rows');
const cooperAddBtn = document.getElementById('cooper-add');

function cooperSpeedAt(i) { return cooperCfg.baseSpeed + i * cooperCfg.stepSpeed; }
function cooperTimeAt(i) { return cooperCfg.baseTime + i * cooperCfg.stepTime; }

// type: 'exercise' | 'rest'
function addCooperRow(type = 'exercise', initialHR) {
  if (!cooperRowsTbody) return;

  const tr = document.createElement('tr');
  tr.dataset.type = type;

  const tdIdxOrLabel = document.createElement('td');
  const tdSpeed = document.createElement('td');
  const tdTime = document.createElement('td');
  const tdHR = document.createElement('td');
  const tdActions = document.createElement('td');

  // Input HR
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.placeholder = 'bpm';
  if (typeof initialHR === 'number' && Number.isFinite(initialHR)) input.value = String(initialHR);
  tdHR.appendChild(input);

  // Actions
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.textContent = 'Rimuovi';

  if (type === 'exercise') {
    // Rimuove anche il successivo 'rest' (se presente)
    rm.addEventListener('click', () => {
      const next = tr.nextElementSibling;
      tr.remove();
      if (next && next.dataset.type === 'rest') next.remove();
      renumberCooperRows();
    });
  } else {
    // Nessun pulsante rimuovi per il riposo per mantenere le coppie consistenti
    rm.style.display = 'none';
  }
  tdActions.appendChild(rm);

  tr.append(tdIdxOrLabel, tdSpeed, tdTime, tdHR, tdActions);
  cooperRowsTbody.appendChild(tr);
  renumberCooperRows();
}

function addCooperPair(exHR, restHR) {
  addCooperRow('exercise', exHR);
  addCooperRow('rest', restHR);
}

function renumberCooperRows() {
  if (!cooperRowsTbody) return;
  let exerciseIndex = 0;
  [...cooperRowsTbody.children].forEach((tr) => {
    const type = tr.dataset.type;
    if (type === 'exercise') {
      const i = exerciseIndex++;
      tr.children[0].textContent = String(i + 1);
      tr.children[1].textContent = `${cooperSpeedAt(i).toFixed(1)} Km/h`;
      tr.children[2].textContent = `${cooperTimeAt(i)} min`;
    } else {
      tr.children[0].textContent = 'Riposo';
      tr.children[1].textContent = '—';
      tr.children[2].textContent = '—';
    }
  });
}

function getCooperHRs() {
  if (!cooperRowsTbody) return [];
  const vals = [];
  [...cooperRowsTbody.querySelectorAll('input[type="number"]')].forEach((inp) => {
    const n = Number(inp.value);
    if (Number.isFinite(n)) vals.push(n);
  });
  return vals;
}

function setCooperHRs(arr = []) {
  if (!cooperRowsTbody) return;
  cooperRowsTbody.innerHTML = '';
  const list = Array.isArray(arr) ? arr : [];
  if (list.length === 0) {
    // default: una coppia Step + Riposo
    addCooperPair();
  } else {
    for (let i = 0; i < list.length; i += 2) {
      const ex = Number(list[i]);
      const rest = Number(list[i + 1]);
      addCooperPair(Number.isFinite(ex) ? ex : undefined, Number.isFinite(rest) ? rest : undefined);
    }
  }
}

cooperAddBtn?.addEventListener('click', () => addCooperPair());

document.addEventListener('DOMContentLoaded', () => {
  // se nuovo form, almeno una riga
  if (cooperRowsTbody && cooperRowsTbody.children.length === 0) setCooperHRs([]);
});

// --- Integrazione caricamento scheda nel form (se presente) ---
function loadTrainingIntoForm(training) {
  // ...existing code...
  try {
    const arr = training?.CooperFreq ? JSON.parse(training.CooperFreq) : [];
    setCooperHRs(Array.isArray(arr) ? arr : []);
  } catch {
    setCooperHRs([]);
  }
  // ...existing code...
}
// Se la tua implementazione usa un altro loader, inserisci il blocco sopra dove valorizzi gli input del form

// --- Integrazione nel submit del form: aggiungi CooperFreq al payload ---
// RIMUOVERE il listener duplicato qui sotto (usava "payload" non definito)
// const trainingForm = document.getElementById('training-form');
// trainingForm?.addEventListener('submit', (e) => { ... });

// --- Rendering nella card della scheda salvata ---
// =========================
// SEZIONE: Render Test Cooper (card)
// - Converte il JSON salvato in tabella Bootstrap
// =========================
function cooperTableHtmlFromJSON(cooperJson) {
  let arr = [];
  try { arr = JSON.parse(cooperJson || '[]'); } catch { arr = []; }
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const rows = arr.map((hr, i) => {
    if (i % 2 === 0) {
      // esercizio
      const step = Math.floor(i / 2);
      const v = cooperSpeedAt(step).toFixed(1);
      const t = cooperTimeAt(step);
      return `<tr><td>${step + 1}</td><td>${v} Km/h</td><td>${t} min</td><td>${hr} bpm</td></tr>`;
    }
    // riposo
    return `<tr><td>Riposo</td><td>—</td><td>—</td><td>${hr} bpm</td></tr>`;
  }).join('');
  return `
    <div class="card-section-title">Test Cooper</div>
    <div class="table-responsive">
      <table class="table table-dark table-striped table-hover table-sm mb-2">
        <thead>
          <tr>
            <th>#</th>
            <th>Velocità (Km/h)</th>
            <th>Tempo (min)</th>
            <th>FC (bpm)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// Integra nella funzione che rende la card (aggiungi dove compili l’HTML della scheda)
// (Esempio opzionale) Render alternativo della card singola
function renderTrainingCard(training) {
  // ...existing code che costruisce html della card...
  const cooperHtml = cooperTableHtmlFromJSON(training.CooperFreq);
  html += cooperHtml;
  // ...existing code...
}
// Se usi un template diverso, inserisci cooperHtml nel punto in cui mostri i dettagli della scheda
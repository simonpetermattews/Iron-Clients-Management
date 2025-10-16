-- DROP TABLE IF EXISTS training_plans;
CREATE TABLE IF NOT EXISTS training_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,

  -- Campi usati dalla UI attuale
  title TEXT NOT NULL,
  notes TEXT,
  date TEXT,          -- ISO yyyy-mm-dd dal form
  exercises TEXT,     -- JSON string

  -- Misure aggiuntive
  Altezza INTEGER,
  Peso INTEGER,
  CirconferenzaTorace INTEGER,
  CirconferenzaVita INTEGER,
  CirconferenzaOmbelicale INTEGER,
  CirconferenzaFianchi INTEGER,
  CirconferenzaBraccioDx INTEGER,
  CirconferenzaBraccioSx INTEGER,
  CirconferenzaGambaDx INTEGER,
  CirconferenzaGambaSx INTEGER,
  Idratazione INTEGER,
  OreDiSonno INTEGER,
  Alimentazione TEXT,
  Obbiettivo TEXT,
  FrequenzaAllenamento TEXT,
  Infortuni TEXT,
  Patologie TEXT,
  EsperienzeSportive TEXT,
  SitAndReach INTEGER,
  SideBend INTEGER,
  FlessibilitaSpalla INTEGER,
  FlamingoDx INTEGER,
  FlamingoSx INTEGER,
  PiegamentiBraccia INTEGER,
  Squat INTEGER,
  SitUp INTEGER,
  Trazioni INTEGER,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_plans_client_id ON training_plans(client_id);
# 02 · Schema SQLite

DDL completo para las 12 entidades del Modelo del Estudiante (`docs/research/03-modelo-estudiante.md`). Sin ORM. `better-sqlite3` con queries explícitas en repositories. Append-only para `Attempts` enforced por trigger + adapter (defense in depth).

---

## Decisiones globales del schema

- **Sin ORM**. Usamos `better-sqlite3` (síncrono, en-proceso, ideal para CLI). Las queries viven en los `Sqlite*Repository.ts`. Trade-off: más código, pero schema visible, control total de índices, sin "magia" de migraciones automáticas que en SQLite siempre es frágil.
- **Migraciones**: archivos SQL numerados (`0001_initial.sql`, `0002_xxx.sql`) ejecutados idempotentemente al arranque. Una tabla `_migrations(id, applied_at)` registra estado.
- **Tipos**: SQLite tiene dynamic typing, pero declaramos tipos para legibilidad y para `STRICT` tables (SQLite 3.37+) cuando aplique.
- **JSON-as-TEXT**: vectores multidimensionales (`MasteryState`) y listas pequeñas van como JSON `TEXT`. Trade-off: no se puede indexar por campo interno, pero queries por `concept_id` siguen siendo rápidas y evitamos N tablas adicionales. Para campos JSON consultados frecuentemente, usamos `json_extract` en views.
- **UUIDs**: IDs como `TEXT` (UUIDv7 para orden lexicográfico temporal). Justificación: exportar/sincronizar proyectos entre máquinas requiere IDs globalmente únicos.
- **Foreign keys ON**: `PRAGMA foreign_keys = ON` al abrir conexión.
- **Append-only para Attempts**: enforced por **trigger** + por adapter (defense in depth). El trigger es el "guard rail" que sobrevive a bugs del adapter.

---

## DDL completo — `migrations/0001_initial.sql`

```sql
-- ============================================
-- 0001_initial.sql
-- ============================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---- Project ----
CREATE TABLE projects (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  domain                TEXT,                          -- math | programming | humanities | languages | other
  agent_language        TEXT NOT NULL DEFAULT 'auto',  -- override del usuario
  material_language     TEXT,                          -- auto-detectado del RAG
  granularity_default   TEXT NOT NULL DEFAULT 'section'
                        CHECK (granularity_default IN ('section','document','atomic_concept')),
  exam_anchor_path      TEXT,                          -- path al archivo de pauta/parcial si aplica
  bootstrap_mode        INTEGER NOT NULL DEFAULT 0     -- bool
                        CHECK (bootstrap_mode IN (0,1)),
  retention_level       TEXT NOT NULL DEFAULT 'strict'
                        CHECK (retention_level IN ('strict','standard','full')),
  source_config_json    TEXT NOT NULL DEFAULT '{}',    -- {rag:bool, web:bool, llm:bool, priorities:[...]}
  created_at            TEXT NOT NULL,                 -- ISO 8601 UTC
  last_active_at        TEXT NOT NULL,
  archived_at           TEXT
);
CREATE INDEX idx_projects_last_active ON projects(last_active_at DESC);

-- ---- Knowledge Source ----
CREATE TABLE knowledge_sources (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('rag_document','web_result','llm_generated')),
  confidence_tier   TEXT NOT NULL CHECK (confidence_tier IN ('primary','secondary','tertiary')),
  provenance_json   TEXT NOT NULL,                     -- {file, section} | {url, fetched_at} | {model, prompt_hash}
  freshness_at      TEXT NOT NULL,
  validity_status   TEXT NOT NULL DEFAULT 'active'
                    CHECK (validity_status IN ('active','superseded','refuted','expired')),
  chunk_index       INTEGER,                           -- nullable, solo para RAG
  superseded_by_id  TEXT REFERENCES knowledge_sources(id),
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_ks_project ON knowledge_sources(project_id);
CREATE INDEX idx_ks_validity ON knowledge_sources(project_id, validity_status);
CREATE INDEX idx_ks_tier ON knowledge_sources(project_id, confidence_tier);

-- ---- Curriculum (1 por proyecto) ----
CREATE TABLE curriculums (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ---- Curriculum Node ----
CREATE TABLE curriculum_nodes (
  id                  TEXT PRIMARY KEY,
  curriculum_id       TEXT NOT NULL REFERENCES curriculums(id) ON DELETE CASCADE,
  objective           TEXT NOT NULL,                   -- enunciado verificable
  bloom_target        TEXT NOT NULL
                      CHECK (bloom_target IN ('recall','understand','apply','analyze','evaluate','create')),
  status              TEXT NOT NULL DEFAULT 'locked'
                      CHECK (status IN ('locked','available','in_progress','mastered','decayed')),
  duration_estimate   TEXT,                            -- "2-4 horas"
  closure_criterion   TEXT,
  risk_flag           INTEGER NOT NULL DEFAULT 0 CHECK (risk_flag IN (0,1)),
  risk_reasons_json   TEXT NOT NULL DEFAULT '[]',      -- ["weak_rag","high_error_rate","llm_only"]
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_nodes_curriculum ON curriculum_nodes(curriculum_id);
CREATE INDEX idx_nodes_status ON curriculum_nodes(curriculum_id, status);

-- ---- Curriculum Node Prerequisites (M:N) ----
CREATE TABLE curriculum_node_prereqs (
  node_id     TEXT NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
  prereq_id   TEXT NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (node_id, prereq_id),
  CHECK (node_id <> prereq_id)
);

-- ---- Concept ----
CREATE TABLE concepts (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_concept_id   TEXT REFERENCES concepts(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  granularity         TEXT NOT NULL
                      CHECK (granularity IN ('section','document','atomic')),
  bloom_levels_seen_json TEXT NOT NULL DEFAULT '[]',   -- ["recall","apply"]
  created_at          TEXT NOT NULL
);
CREATE INDEX idx_concepts_project ON concepts(project_id);
CREATE INDEX idx_concepts_parent ON concepts(parent_concept_id);

-- ---- Concept ↔ Curriculum Node (M:N) ----
CREATE TABLE concept_node_links (
  concept_id  TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  node_id     TEXT NOT NULL REFERENCES curriculum_nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, node_id)
);

-- ---- Concept ↔ Knowledge Source (M:N, "source_anchors") ----
CREATE TABLE concept_source_anchors (
  concept_id  TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  source_id   TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, source_id)
);

-- ---- Item ----
CREATE TABLE items (
  id                          TEXT PRIMARY KEY,
  project_id                  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prompt_text                 TEXT NOT NULL,
  origin                      TEXT NOT NULL
                              CHECK (origin IN ('rag_curated','bank_curated','llm_improvised')),
  bloom_level                 TEXT NOT NULL
                              CHECK (bloom_level IN ('recall','recognition','application','transfer','analysis')),
  mode_affinity_json          TEXT NOT NULL DEFAULT '[]',  -- ["socratic","explorer"]
  expected_difficulty         REAL NOT NULL DEFAULT 0.5
                              CHECK (expected_difficulty BETWEEN 0 AND 1),
  observed_difficulty         REAL,                         -- nullable, cache lazy según D-A2
  scaffold_levels_available_json TEXT NOT NULL DEFAULT '[]', -- [1,2,3,4,5] o subset
  expected_error_taxonomy_json TEXT NOT NULL DEFAULT '[]',
  validity_status             TEXT NOT NULL DEFAULT 'active'
                              CHECK (validity_status IN ('active','under_review','retired')),
  pool_membership             INTEGER NOT NULL DEFAULT 0 CHECK (pool_membership IN (0,1)),
  promoted_from_attempt_id    TEXT,                          -- si fue promovido del banco improvisado
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL
);
CREATE INDEX idx_items_project ON items(project_id);
CREATE INDEX idx_items_origin ON items(project_id, origin);
CREATE INDEX idx_items_pool ON items(project_id, pool_membership, validity_status);

-- ---- Item ↔ Concept (M:N) ----
CREATE TABLE item_concepts (
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  concept_id  TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, concept_id)
);

-- ---- Item ↔ Knowledge Source (provenance del ítem) ----
CREATE TABLE item_sources (
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  source_id   TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, source_id)
);

-- ---- Session ----
CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  started_at          TEXT NOT NULL,
  ended_at            TEXT,
  end_reason          TEXT CHECK (end_reason IN ('user_exit','inactivity','crash_recovered')),
  mode_timeline_json  TEXT NOT NULL DEFAULT '[]',      -- [{mode,entered_at,exited_at,exit_reason}]
  attempts_count      INTEGER NOT NULL DEFAULT 0,
  concepts_touched_json TEXT NOT NULL DEFAULT '[]',
  fatigue_indicator   REAL,                            -- derivado al cierre
  off_ramps_triggered_json TEXT NOT NULL DEFAULT '[]',
  summary_for_user    TEXT
);
CREATE INDEX idx_sessions_project ON sessions(project_id, started_at DESC);

-- ---- Attempt ⭐ INMUTABLE ----
-- outcome es 5-valued automático (D-S1): el agente lo deduce, NO el usuario.
CREATE TABLE attempts (
  id                      TEXT PRIMARY KEY,
  project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id              TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id                 TEXT NOT NULL REFERENCES items(id),  -- NO CASCADE: el item puede retirarse, la evidencia queda
  mode                    TEXT NOT NULL
                          CHECK (mode IN ('socratic','architect','simulacro','explorer')),
  started_at              TEXT NOT NULL,
  submitted_at            TEXT NOT NULL,
  latency_ms              INTEGER NOT NULL CHECK (latency_ms >= 0),
  response_text           TEXT NOT NULL,
  outcome                 TEXT NOT NULL
                          CHECK (outcome IN ('correct','partial','incorrect','skipped','gave_up')),
  scaffold_level_reached  INTEGER NOT NULL DEFAULT 0
                          CHECK (scaffold_level_reached BETWEEN 0 AND 5),
  scaffold_requested_by   TEXT CHECK (scaffold_requested_by IN ('user','agent_offered')),
  error_type              TEXT
                          CHECK (error_type IN ('conceptual','procedural','notational','careless','off-topic','partial-correct')),
  pre_confidence          INTEGER CHECK (pre_confidence BETWEEN 0 AND 100),
  post_confidence         INTEGER CHECK (post_confidence BETWEEN 0 AND 100),
  retry_count             INTEGER NOT NULL DEFAULT 0,
  affective_snapshot_json TEXT NOT NULL DEFAULT '{}'   -- copia inline del AffectiveLog en el momento
);
CREATE INDEX idx_attempts_session ON attempts(session_id, started_at);
CREATE INDEX idx_attempts_item ON attempts(item_id, started_at DESC);
CREATE INDEX idx_attempts_project ON attempts(project_id, started_at DESC);

-- TRIGGERS: append-only (defense in depth)
CREATE TRIGGER attempts_no_update
BEFORE UPDATE ON attempts
BEGIN
  SELECT RAISE(ABORT, 'attempts are immutable: updates not allowed');
END;

CREATE TRIGGER attempts_no_delete
BEFORE DELETE ON attempts
WHEN (SELECT count(*) FROM _privacy_purges WHERE attempt_id = OLD.id) = 0
BEGIN
  SELECT RAISE(ABORT, 'attempts can only be deleted via explicit privacy purge');
END;

-- Tabla de "permisos" para delete (sólo populada por PurgePrivacy use case)
CREATE TABLE _privacy_purges (
  attempt_id  TEXT PRIMARY KEY,
  purged_at   TEXT NOT NULL,
  reason      TEXT NOT NULL
);

-- ---- Mastery State (1 por concepto + proyecto) ----
CREATE TABLE mastery_states (
  concept_id              TEXT PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
  -- SM-2 (paramsHash incluido en raw del SchedulingState serializado)
  ease_factor             REAL NOT NULL DEFAULT 2.5,
  interval_days           INTEGER NOT NULL DEFAULT 0,
  repetitions             INTEGER NOT NULL DEFAULT 0,
  next_due_at             TEXT,
  scheduling_state_json   TEXT NOT NULL DEFAULT '{}',  -- SchedulingState serializado completo
  -- accuracy window
  accuracy_window_json    TEXT NOT NULL DEFAULT '[]',  -- ring buffer [{outcome, weight, at}]
  -- scaffold trajectory
  scaffold_trajectory_json TEXT NOT NULL DEFAULT '[]', -- [{at, avg_level}]
  -- bloom coverage
  bloom_coverage_json     TEXT NOT NULL DEFAULT '[]',
  -- confidence
  confidence_interval     REAL NOT NULL DEFAULT 0.0    -- [0,1], 0 = sin evidencia
                          CHECK (confidence_interval BETWEEN 0 AND 1),
  -- label derivado
  mastery_label           TEXT NOT NULL DEFAULT 'not_started'
                          CHECK (mastery_label IN ('not_started','learning','practicing','mastered','mastered_decaying','needs_review')),
  last_review_at          TEXT,
  updated_at              TEXT NOT NULL
);
CREATE INDEX idx_mastery_due ON mastery_states(next_due_at)
  WHERE next_due_at IS NOT NULL;

-- ---- Metacognitive Signal ----
CREATE TABLE metacognitive_signals (
  id              TEXT PRIMARY KEY,
  attempt_id      TEXT REFERENCES attempts(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  signal_kind     TEXT NOT NULL
                  CHECK (signal_kind IN ('pre_confidence','post_confidence','judgment_of_learning','feeling_of_knowing','strategy_choice')),
  predicted_value REAL,
  actual_value    REAL,
  calibration_gap REAL,
  prompted_by     TEXT NOT NULL CHECK (prompted_by IN ('agent_question','user_initiated')),
  captured_at     TEXT NOT NULL
);
CREATE INDEX idx_metacog_session ON metacognitive_signals(session_id);
CREATE INDEX idx_metacog_attempt ON metacognitive_signals(attempt_id);

-- ---- Affective Log ----
-- Schema acepta los 3 niveles de retention (D-A3): el adapter decide qué guardar.
-- En modo strict, esta tabla queda VACÍA al cerrar sesión (detalle vive solo en RAM).
CREATE TABLE affective_logs (
  id                       TEXT PRIMARY KEY,
  session_id               TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  attempt_id               TEXT REFERENCES attempts(id) ON DELETE CASCADE,  -- nullable
  captured_at              TEXT NOT NULL,
  latency_anomaly          REAL,                         -- z-score vs baseline
  length_anomaly           REAL,
  retry_burst              INTEGER NOT NULL DEFAULT 0,
  affective_lexicon_hits_json TEXT NOT NULL DEFAULT '[]', -- [{token, valence, arousal}]
  abandon_signal           INTEGER NOT NULL DEFAULT 0 CHECK (abandon_signal IN (0,1)),
  inferred_state           TEXT
                           CHECK (inferred_state IN ('engaged','flow','frustrated','confused','bored','fatigued','unknown')),
  confidence_of_inference  REAL NOT NULL DEFAULT 0.0
                           CHECK (confidence_of_inference BETWEEN 0 AND 1),
  retention_tier_at_capture TEXT NOT NULL
                            CHECK (retention_tier_at_capture IN ('strict','standard','full'))
);
CREATE INDEX idx_affective_session ON affective_logs(session_id, captured_at);

-- ---- Affective Aggregates (siempre preservados, anónimos por construcción) ----
-- En modo strict, esta es la ÚNICA tabla afectiva que persiste cross-session.
CREATE TABLE affective_aggregates (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_start    TEXT NOT NULL,
  period_end      TEXT NOT NULL,
  pct_frustration REAL,
  pct_flow        REAL,
  pct_fatigue     REAL,
  sample_size     INTEGER NOT NULL,
  computed_at     TEXT NOT NULL
);
CREATE INDEX idx_affective_agg_project ON affective_aggregates(project_id, period_start DESC);

-- ---- Source Attribution Log (P8, NUNCA se purga en strict) ----
CREATE TABLE source_attribution_logs (
  id                  TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index          INTEGER NOT NULL,
  paragraph_index     INTEGER NOT NULL,
  claim_text          TEXT NOT NULL,
  source_kind         TEXT NOT NULL CHECK (source_kind IN ('rag','web','llm','mixed')),
  confidence_tier     TEXT NOT NULL CHECK (confidence_tier IN ('primary','secondary','tertiary')),
  user_visible_label  TEXT NOT NULL,                  -- "[RAG: doc, p.12]"
  emitted_at          TEXT NOT NULL
);
CREATE INDEX idx_attribution_session ON source_attribution_logs(session_id, turn_index);

-- ---- Source References (M:N: una claim cita N sources) ----
CREATE TABLE source_attribution_refs (
  attribution_id  TEXT NOT NULL REFERENCES source_attribution_logs(id) ON DELETE CASCADE,
  source_id       TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (attribution_id, source_id)
);

-- ---- Item Bank Pool (VISTA, no tabla) ----
CREATE VIEW item_bank_pool AS
  SELECT * FROM items
  WHERE origin IN ('rag_curated','bank_curated')
    AND validity_status = 'active'
    AND pool_membership = 1;

-- ---- Migrations registry ----
CREATE TABLE _migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL
);
```

---

## Casos especiales resueltos explícitamente

| Pregunta | Decisión | Razón |
|---|---|---|
| ¿Vector multidim de MasteryState: JSON o tablas? | **JSON columns** en `mastery_states` | Read/write atómico por concepto. No hay queries cross-componente del vector. Tablas separadas multiplicarían joins sin beneficio. Si post-MVP se quiere analytics granular, se materializa una view. |
| `confidence_of_inference` rango | **`REAL` con CHECK [0,1]** | Float64 con check declarativo. Sin enum (la granularidad puede subir con un estimador mejor). |
| Distinguir `rag_curated` vs `bank_curated` vs `llm_improvised` | **Columna `origin` con CHECK enum** | Una sola fuente de verdad, indexable directamente. |
| `pool_membership` | **Columna `INTEGER` (bool) + VIEW `item_bank_pool`** | La columna permite update barato (promoción de improvisados). La view encapsula el filtro completo (membership + validity + origin). Use case `PromoteItemToBank` solo setea `pool_membership=1`. |
| Append-only Attempts | **Trigger SQL + check en adapter** | Defense in depth. El adapter no debería emitir UPDATE/DELETE, pero si lo hace por bug, el trigger aborta. Privacy purge usa la tabla `_privacy_purges` como "permiso" temporal. |
| Migraciones | **SQL numerados + tabla `_migrations`** | Idempotentes. Cada migración chequea si su ID está en `_migrations` antes de aplicar. Sin frameworks. |
| `observed_difficulty` (D-A2) | **Cache lazy en columna `items.observed_difficulty`** | Recalculado en `SelectNextItem` cuando se necesita, no en cada `SubmitAttempt`. Submit barato. |
| Detalle de `affective_logs` (D-A3) | **En modo strict: NO se persiste**. Solo se computa en RAM y se colapsa a `affective_aggregates` al cerrar sesión | Privacy by design. Si el proceso crashea mid-sesión, se pierde inferencia afectiva — costo aceptado. |

---

## Conflicto detectado con el PRD/MdE — resuelto

El MdE §1.5 dice que `Item.observed_difficulty` "se actualiza vía IRT-lite o tasa de error empírica `[REQUIERE VALIDACIÓN POST-MVP]`". El schema lo deja **`nullable`** y el `IMasteryEstimator` puede o no escribirlo. **Resuelto**: D-A2 cierra la decisión — recálculo on-demand en `SelectNextItem` con cache. El campo es `nullable` hasta que el primer attempt+selección lo popule.

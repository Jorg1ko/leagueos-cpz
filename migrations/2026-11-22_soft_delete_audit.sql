-- FASE 1 · Migración aditiva. NO ejecutarla en producción antes de
-- 1) verificar una copia completa, y 2) recibir aprobación explícita.
-- Preparada contra las tablas existentes de noviembre 2026.
-- Ejecutar una sola vez sobre una base con esquema previamente comprobado.
ALTER TABLE cpz_match_results ADD COLUMN deleted_at TEXT DEFAULT NULL;
ALTER TABLE cpz_doubles_results ADD COLUMN deleted_at TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS cpz_result_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition TEXT NOT NULL CHECK (competition IN ('individual','doubles')),
  action TEXT NOT NULL CHECK (action IN ('create','edit','delete','restore')),
  result_id INTEGER NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (before_json IS NULL OR json_valid(before_json)),
  CHECK (after_json IS NULL OR json_valid(after_json))
);
CREATE INDEX IF NOT EXISTS idx_cpz_result_audit_subject
  ON cpz_result_audit(competition, result_id, id DESC);

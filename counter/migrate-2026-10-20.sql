-- Migration of the production database for PROJECT_PLAN §11.64 (nothing is deleted or reset: `lives` and `counter` keep every row).
-- This file only creates a table, and may be run again without effect. Run it BEFORE the new Worker is deployed (the old Worker goes on
-- working while it runs; the new Worker without this table answers 503).
-- The removal of the old index is a separate file (migrate-2026-10-20-index.sql), to be run only after the new Worker has been stable for
-- a day: it is not part of this migration.
CREATE TABLE IF NOT EXISTS rate (
  bucket INTEGER PRIMARY KEY,
  n INTEGER NOT NULL
);

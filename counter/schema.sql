-- The counter of lives begun (PROJECT_PLAN §11.51, §11.64). One row per life (a random id the browser makes: nothing about the player or
-- the life) and one number. The trigger adds 1 only when a NEW id is inserted, in the same statement, so a repeated or retried request
-- never counts twice and a crash cannot leave the number and the rows apart.
CREATE TABLE IF NOT EXISTS lives (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS counter (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO counter (name, value) VALUES ('lives', 0);

-- New lives per bucket of 10 seconds (bucket = the time in ms / 10000): the Worker's limit per minute reads at most 7 of these rows
-- instead of counting every life of the last minute (up to MAX_PER_MINUTE rows read by each request). Only a counting aid: the number is `counter`.
CREATE TABLE IF NOT EXISTS rate (
  bucket INTEGER PRIMARY KEY,
  n INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS lives_counted AFTER INSERT ON lives
BEGIN
  UPDATE counter SET value = value + 1 WHERE name = 'lives';
END;

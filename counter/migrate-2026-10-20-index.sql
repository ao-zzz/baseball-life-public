-- Step 2 of the migration of PROJECT_PLAN §11.64: run only AFTER the new Worker (which no longer counts rows by time) is deployed.
DROP INDEX IF EXISTS lives_created_at;

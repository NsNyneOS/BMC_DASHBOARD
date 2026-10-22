-- 016_rename_owner_team_to_team.sql — tasks.owner_team is now simply tasks.team ('nyneos' = NyneOS side, 'bmc' = the customer's side).
-- Requires 008. Safe to re-run. Deploy it together with the matching backend + frontend (the API field is now "team").
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'tasks' AND column_name = 'owner_team')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'tasks' AND column_name = 'team') THEN
    ALTER TABLE tasks RENAME COLUMN owner_team TO team;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_owner_team_check' AND conrelid = 'tasks'::regclass) THEN
    ALTER TABLE tasks RENAME CONSTRAINT tasks_owner_team_check TO tasks_team_check;
  END IF;
END $$;

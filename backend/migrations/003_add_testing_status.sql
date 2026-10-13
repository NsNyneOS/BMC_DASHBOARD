-- 003_add_testing_status.sql — adds the "Testing/Review" board column.
-- Board columns are now: New (todo), In Progress (in_progress), Testing/Review (testing),
-- Deploying (in_review), Completed (done). Existing rows keep their status values.
-- Run outside a transaction block.
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'testing' BEFORE 'in_review';

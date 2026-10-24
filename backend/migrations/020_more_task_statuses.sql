-- 020_more_task_statuses.sql — new board journey:
-- New (todo) > In Progress (in_progress) > Developing (developing) > Testing (testing) > Review (review)
-- > Completed (completed) > Deploying (in_review) > Rework (rework) > Finished (done, the end of the journey).
-- Existing rows keep their values: old "Completed" tasks (done) are now "Finished"; "Testing/Review" tasks are now "Testing".
-- Run outside a transaction block.
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'developing' BEFORE 'testing';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'review' AFTER 'testing';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'completed' AFTER 'review';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'rework' AFTER 'in_review';

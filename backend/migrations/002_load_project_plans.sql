-- 002_load_project_plans.sql — wipe task data and load the C KYC and BMC Website project plans.
-- Keeps user_data (logins) and projects. C KYC is stored under project EKYC, BMC Website under WEB.
BEGIN;
TRUNCATE task_activity, task_attachments, task_links, project_alerts, tasks;
UPDATE projects SET task_counter=0, start_date=NULL, end_date=NULL;
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-1', 'EKYC'::project_id, 'Gather Business Requirements', 'Owner: BA
Deliverable: Scope Document', 'done'::task_status, 'medium', 0, '2026-09-28'::date, '2026-09-30'::date, 'Requirements', ARRAY[]::text[], ARRAY['Requirements']::text[], now());
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-2', 'EKYC'::project_id, 'Requirement Review & Sign-off', 'Owner: Client/BA
Deliverable: Approved Scope
Milestone: Yes', 'done'::task_status, 'medium', 1, '2026-10-01'::date, '2026-10-01'::date, 'Requirements', ARRAY['milestone']::text[], ARRAY['Requirements']::text[], now());
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-3', 'EKYC'::project_id, 'Solution Architecture', 'Owner: Architect
Deliverable: Solution Diagrams
Milestone: Yes', 'in_progress'::task_status, 'medium', 2, '2026-10-05'::date, '2026-10-10'::date, 'Architecture', ARRAY['milestone']::text[], ARRAY['Architecture']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-4', 'EKYC'::project_id, 'Database Design', 'Owner: Tech Lead
Deliverable: DB Design', 'todo'::task_status, 'medium', 3, '2026-10-07'::date, '2026-10-12'::date, 'Architecture', ARRAY[]::text[], ARRAY['Architecture']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-5', 'EKYC'::project_id, 'API Specifications', 'Owner: Tech Lead
Deliverable: API Documentation
Milestone: Yes', 'in_progress'::task_status, 'medium', 4, '2026-10-06'::date, '2026-10-08'::date, 'Integration', ARRAY['milestone']::text[], ARRAY['Integration']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-6', 'EKYC'::project_id, 'On Boarding Form- New Individual Customer', 'Owner: Dev Team
Deliverable: New Individual Customer', 'todo'::task_status, 'medium', 5, '2026-10-10'::date, '2026-10-14'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-7', 'EKYC'::project_id, 'DB creation', 'Owner: Dev Team', 'todo'::task_status, 'medium', 6, '2026-10-12'::date, '2026-10-14'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-8', 'EKYC'::project_id, 'On Boarding Form- New nonIndividual Customer', 'Owner: Dev Team
Deliverable: New Individual Customer', 'todo'::task_status, 'medium', 7, '2026-10-15'::date, '2026-10-19'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-9', 'EKYC'::project_id, 'On Boarding Form- Existing Individual Customer', 'Owner: Dev Team
Deliverable: Existing Individual Customer', 'todo'::task_status, 'medium', 8, '2026-10-20'::date, '2026-10-20'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-10', 'EKYC'::project_id, 'On Boarding Form- Existing non Individual Customer', 'Owner: Dev Team
Deliverable: Existing non Individual Customer', 'todo'::task_status, 'medium', 9, '2026-10-21'::date, '2026-10-21'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-11', 'EKYC'::project_id, 'Integration with CBS', 'Owner: Dev Team
Dependency/Query: D001', 'todo'::task_status, 'medium', 10, '2026-10-22'::date, '2026-10-22'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-12', 'EKYC'::project_id, 'DMS implementation', 'Owner: Dev Team', 'todo'::task_status, 'medium', 11, '2026-10-22'::date, '2026-10-22'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-13', 'EKYC'::project_id, 'Maker Checker flow', 'Owner: Dev Team', 'todo'::task_status, 'medium', 12, '2026-10-22'::date, '2026-10-22'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-14', 'EKYC'::project_id, 'Integration with CERSAI', 'Owner: Dev Team
Dependency/Query: D001', 'todo'::task_status, 'medium', 13, '2026-10-23'::date, '2026-10-27'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-15', 'EKYC'::project_id, 'UAM', 'Owner: Dev Team', 'todo'::task_status, 'medium', 14, '2026-10-23'::date, '2026-10-24'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-16', 'EKYC'::project_id, 'Ecalation matrix', 'Owner: Dev Team', 'todo'::task_status, 'medium', 15, '2026-10-23'::date, '2026-10-24'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-17', 'EKYC'::project_id, 'Audit trail and Logs', 'Owner: Dev Team', 'todo'::task_status, 'medium', 16, '2026-10-23'::date, '2026-10-24'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-18', 'EKYC'::project_id, 'Global search', 'Owner: Dev Team', 'todo'::task_status, 'medium', 17, '2026-10-25'::date, '2026-10-25'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-19', 'EKYC'::project_id, 'OAuth and Authorization', 'Owner: Dev Team', 'todo'::task_status, 'medium', 18, '2026-10-25'::date, '2026-10-25'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-20', 'EKYC'::project_id, 'Dashboard', 'Owner: Dev Team', 'todo'::task_status, 'medium', 19, '2026-10-26'::date, '2026-10-27'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-21', 'EKYC'::project_id, 'Reports', 'Owner: Dev Team', 'todo'::task_status, 'medium', 20, '2026-10-26'::date, '2026-10-27'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-22', 'EKYC'::project_id, 'creation a guide', 'Owner: Dev Team', 'todo'::task_status, 'medium', 21, '2026-10-28'::date, '2026-10-28'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-23', 'EKYC'::project_id, 'Notification in App', 'Owner: Dev Team', 'todo'::task_status, 'medium', 22, '2026-10-24'::date, '2026-10-26'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-24', 'EKYC'::project_id, 'Test Planning & Test Cases', 'Owner: QA
Deliverable: Test Cases', 'todo'::task_status, 'medium', 23, '2026-10-12'::date, '2026-10-19'::date, 'Testing', ARRAY[]::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-25', 'EKYC'::project_id, 'System Integration Testing', 'Owner: QA
Deliverable: SIT Report
Milestone: Yes', 'todo'::task_status, 'medium', 24, '2026-10-15'::date, '2026-10-29'::date, 'Testing', ARRAY['milestone']::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-26', 'EKYC'::project_id, 'Defect Fixing', 'Owner: Dev Team
Deliverable: Resolved Defects', 'todo'::task_status, 'medium', 25, '2026-10-16'::date, '2026-10-29'::date, 'Testing', ARRAY[]::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-27', 'EKYC'::project_id, 'Regression Testing', 'Owner: QA
Deliverable: Regression Report
Milestone: Yes', 'todo'::task_status, 'medium', 26, '2026-10-30'::date, '2026-10-30'::date, 'Testing', ARRAY['milestone']::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-28', 'EKYC'::project_id, 'UAT Preparation', 'Owner: Dev/QA
Deliverable: UAT Environment', 'todo'::task_status, 'medium', 27, '2026-10-30'::date, '2026-10-31'::date, 'UAT', ARRAY[]::text[], ARRAY['UAT']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-29', 'EKYC'::project_id, 'User Acceptance Testing', 'Owner: Client
Deliverable: UAT Sign-off
Milestone: Yes', 'todo'::task_status, 'medium', 28, '2026-11-02'::date, '2026-11-16'::date, 'UAT', ARRAY['milestone']::text[], ARRAY['UAT']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-30', 'EKYC'::project_id, 'Production Readiness', 'Owner: DevOps
Deliverable: Go-Live Checklist
Milestone: Yes', 'todo'::task_status, 'medium', 29, '2026-11-02'::date, '2026-11-03'::date, 'Deployment', ARRAY['milestone']::text[], ARRAY['Deployment']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('EKYC-31', 'EKYC'::project_id, 'Production Deployment', 'Owner: DevOps
Deliverable: Production Release
Milestone: Yes', 'todo'::task_status, 'medium', 30, NULL::date, NULL::date, 'Deployment', ARRAY['milestone']::text[], ARRAY['Deployment']::text[], NULL);
UPDATE projects SET task_counter=31 WHERE id='EKYC'::project_id;
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-1', 'WEB'::project_id, 'Gather Business Requirements', 'Owner: BA
Deliverable: Scope Document', 'done'::task_status, 'medium', 0, '2026-09-28'::date, '2026-09-30'::date, 'Requirements', ARRAY[]::text[], ARRAY['Requirements']::text[], now());
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-2', 'WEB'::project_id, 'Requirement Review & Sign-off', 'Owner: Client/BA
Deliverable: Approved Scope
Milestone: Yes', 'done'::task_status, 'medium', 1, '2026-10-01'::date, '2026-10-01'::date, 'Requirements', ARRAY['milestone']::text[], ARRAY['Requirements']::text[], now());
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-3', 'WEB'::project_id, 'UI Rewamp- Identification of theme by creating figma''s', 'Owner: Dev Team
Deliverable: UI Design Guidelines', 'in_progress'::task_status, 'medium', 2, '2026-10-06'::date, '2026-10-07'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-4', 'WEB'::project_id, 'UI Rewamp- Implementation', 'Owner: Dev Team', 'todo'::task_status, 'medium', 3, '2026-10-07'::date, '2026-10-21'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-5', 'WEB'::project_id, 'Frontend - responsive Website', 'Owner: Dev Team', 'todo'::task_status, 'medium', 4, '2026-10-07'::date, '2026-10-21'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-6', 'WEB'::project_id, 'Global Search including Voice Assistant- Service discovery', 'Owner: Dev Team
Dependency/Query: Q002, Q001', 'todo'::task_status, 'medium', 5, '2026-10-09'::date, '2026-10-12'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-7', 'WEB'::project_id, 'Multilingual', 'Owner: Dev Team
Dependency/Query: Q003', 'todo'::task_status, 'medium', 6, '2026-10-22'::date, '2026-10-22'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-8', 'WEB'::project_id, 'Backend- DB creation', 'Owner: Dev Team', 'todo'::task_status, 'medium', 7, '2026-10-19'::date, '2026-10-21'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-9', 'WEB'::project_id, 'Backend- Theme changing as per festivals incuding the workflow maker checker', 'Owner: Dev Team', 'todo'::task_status, 'medium', 8, '2026-10-19'::date, '2026-10-21'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-10', 'WEB'::project_id, 'Content management- Conversion file type and cover Page', 'Owner: Dev Team
Dependency/Query: Q004', 'todo'::task_status, 'medium', 9, '2026-10-22'::date, '2026-10-27'::date, 'Development', ARRAY[]::text[], ARRAY['Development']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-11', 'WEB'::project_id, 'Test Planning & Test Cases', 'Owner: QA
Deliverable: Test Cases', 'todo'::task_status, 'medium', 10, '2026-10-15'::date, '2026-10-19'::date, 'Testing', ARRAY[]::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-12', 'WEB'::project_id, 'System Integration Testing', 'Owner: QA
Deliverable: SIT Report
Milestone: Yes', 'todo'::task_status, 'medium', 11, '2026-10-22'::date, '2026-10-28'::date, 'Testing', ARRAY['milestone']::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-13', 'WEB'::project_id, 'Defect Fixing', 'Owner: Dev Team
Deliverable: Resolved Defects', 'todo'::task_status, 'medium', 12, '2026-10-23'::date, '2026-10-29'::date, 'Testing', ARRAY[]::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-14', 'WEB'::project_id, 'Regression Testing', 'Owner: QA
Deliverable: Regression Report
Milestone: Yes', 'todo'::task_status, 'medium', 13, '2026-10-24'::date, '2026-10-30'::date, 'Testing', ARRAY['milestone']::text[], ARRAY['Testing']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-15', 'WEB'::project_id, 'UAT Preparation', 'Owner: Dev/QA
Deliverable: UAT Environment', 'todo'::task_status, 'medium', 14, '2026-10-31'::date, '2026-10-31'::date, 'UAT', ARRAY[]::text[], ARRAY['UAT']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-16', 'WEB'::project_id, 'User Acceptance Testing', 'Owner: Client
Deliverable: UAT Sign-off
Milestone: Yes', 'todo'::task_status, 'medium', 15, '2026-11-02'::date, '2026-11-19'::date, 'UAT', ARRAY['milestone']::text[], ARRAY['UAT']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-17', 'WEB'::project_id, 'UAT support Defect fixes', 'Owner: Dev', 'todo'::task_status, 'medium', 16, '2026-11-03'::date, '2026-11-18'::date, 'UAT', ARRAY[]::text[], ARRAY['UAT']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-18', 'WEB'::project_id, 'Production Readiness', 'Owner: DevOps
Deliverable: Go-Live Checklist
Milestone: Yes', 'todo'::task_status, 'medium', 17, '2026-11-19'::date, '2026-11-19'::date, 'Deployment', ARRAY['milestone']::text[], ARRAY['Deployment']::text[], NULL);
INSERT INTO tasks (key, project, summary, description, status, priority, position, start_date, due_date, sprint, labels, components, completed_at) VALUES ('WEB-19', 'WEB'::project_id, 'Production Deployment', 'Owner: DevOps
Deliverable: Production Release
Milestone: Yes', 'todo'::task_status, 'medium', 18, NULL::date, NULL::date, 'Deployment', ARRAY['milestone']::text[], ARRAY['Deployment']::text[], NULL);
UPDATE projects SET task_counter=19 WHERE id='WEB'::project_id;
COMMIT;

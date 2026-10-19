-- 006_add_kycteam_user.sql — new login "kycteam" with the same permissions as the BMC account
-- (role 'bmc': read-only popup, no kanban board). Password is stored as a bcrypt hash.
INSERT INTO user_data (username, name, initials, email, role, password_hash, can_manage_board) VALUES
  ('kycteam', 'KYC Team', 'KT', NULL, 'bmc', '$2a$10$.rAZPoPBhQtILfmCo0HviuOn1Ij1tuV.Q.Bb11Wm.HtsjfeqDCWKq', FALSE)
ON CONFLICT (username) DO NOTHING;

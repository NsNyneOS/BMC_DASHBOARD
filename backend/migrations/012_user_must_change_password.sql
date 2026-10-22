-- 012_user_must_change_password.sql — users created with the default password (NEWPASSWORD) must set their own
-- password at first sign-in. Requires 011. Safe to re-run; existing users are unaffected (FALSE).
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

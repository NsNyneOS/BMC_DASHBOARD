-- 018_drop_customer_website.sql — the customer form no longer has a website, so the column is removed.
-- Requires 011. Safe to re-run. Deploy it together with the matching backend (the old backend still selects this column).
ALTER TABLE customer_master DROP COLUMN IF EXISTS website;

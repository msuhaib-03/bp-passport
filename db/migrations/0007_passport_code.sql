-- 0007 — Public device passport identifier
--
-- The code is safe to show on the patient's card. It is not an access token;
-- row access remains controlled by Supabase Auth and RLS.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS passport_code text UNIQUE;

ALTER TABLE patients
  DROP CONSTRAINT IF EXISTS patients_passport_code_format;

ALTER TABLE patients
  ADD CONSTRAINT patients_passport_code_format
  CHECK (passport_code IS NULL OR passport_code ~ '^PE-[A-HJ-NP-Z2-9]{4}$');

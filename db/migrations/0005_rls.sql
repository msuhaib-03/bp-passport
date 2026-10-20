-- ═══════════════════════════════════════════════════════════════════════════
-- 0005 — Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RLS is the actual security boundary, not the application. If a route handler
-- has a bug and builds a query without a patient filter, the database still
-- refuses to return rows that the authenticated role may not see. That property
-- is worth more than any amount of careful application code, because application
-- code is edited under deadline pressure and this is not.
--
-- FAIL CLOSED. Enabling RLS with no matching policy denies everything, and
-- auth.uid() returns NULL for an unauthenticated request, so a policy comparing
-- against it can never match. Both defaults are deny.
--
-- ROLES
--   authenticated — a signed-in patient or clinician (Supabase default role)
--   anon          — an unauthenticated visitor. Reads active campaigns only.
--   service_role  — server-side jobs. BYPASSRLS; never exposed to a browser.

DO $$ BEGIN CREATE ROLE anon NOLOGIN;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- campaigns — public read of active campaigns; nobody but a service role writes
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_public_read ON campaigns;
CREATE POLICY campaigns_public_read ON campaigns
  FOR SELECT TO anon, authenticated
  USING (active);

GRANT SELECT ON campaigns TO anon, authenticated;
GRANT ALL ON campaigns TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- patients — a patient sees exactly one row: their own
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_self_read ON patients;
CREATE POLICY patients_self_read ON patients
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS patients_self_update ON patients;
CREATE POLICY patients_self_update ON patients
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  -- WITH CHECK as well as USING: without it a patient could reassign their row
  -- to another auth user, which is account takeover in one UPDATE.
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS patients_self_insert ON patients;
CREATE POLICY patients_self_insert ON patients
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Deliberately no DELETE policy. Erasure requests are handled by a reviewed
-- server-side procedure, because a cascade from here silently destroys the audit
-- trail that proves the erasure was lawful.

GRANT SELECT, INSERT, UPDATE ON patients TO authenticated;
GRANT ALL ON patients TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- consents — a patient may read and append their own; nobody may rewrite them
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consents_self_read ON consents;
CREATE POLICY consents_self_read ON consents
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS consents_self_insert ON consents;
CREATE POLICY consents_self_insert ON consents
  FOR INSERT TO authenticated
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

-- No UPDATE and no DELETE policy at all: the ledger is append-only, and a
-- withdrawal is a new row.
GRANT SELECT, INSERT ON consents TO authenticated;
GRANT ALL ON consents TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- checkins — patient owns; a clinician with a live share may read
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkins_self_read ON checkins;
CREATE POLICY checkins_self_read ON checkins
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS checkins_clinician_read ON checkins;
CREATE POLICY checkins_clinician_read ON checkins
  FOR SELECT TO authenticated
  USING (clinician_has_access(patient_id));

DROP POLICY IF EXISTS checkins_self_insert ON checkins;
CREATE POLICY checkins_self_insert ON checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid())
    AND has_consent(patient_id, 'essential')
  );

-- No UPDATE: a screening event is a historical fact. Correcting a mistyped
-- reading means recording a new checkin, not editing the past.
GRANT SELECT, INSERT ON checkins TO authenticated;
GRANT ALL ON checkins TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- readings — the same split, and the table the whole portal depends on
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS readings_self_read ON readings;
CREATE POLICY readings_self_read ON readings
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS readings_self_insert ON readings;
CREATE POLICY readings_self_insert ON readings
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid())
    AND has_consent(patient_id, 'essential')
  );

DROP POLICY IF EXISTS readings_self_delete ON readings;
CREATE POLICY readings_self_delete ON readings
  FOR DELETE TO authenticated
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

-- Read-only for clinicians, by construction rather than by convention: there is
-- no UPDATE or INSERT policy for them anywhere in this file. A GP can never
-- alter a patient's record, which is what makes the record trustworthy as
-- evidence for both parties.
DROP POLICY IF EXISTS readings_clinician_read ON readings;
CREATE POLICY readings_clinician_read ON readings
  FOR SELECT TO authenticated
  USING (clinician_has_access(patient_id));

GRANT SELECT, INSERT, DELETE ON readings TO authenticated;
GRANT ALL ON readings TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- clinicians — own row only. The register is not a public directory.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE clinicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinicians FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinicians_self_read ON clinicians;
CREATE POLICY clinicians_self_read ON clinicians
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS clinicians_self_insert ON clinicians;
CREATE POLICY clinicians_self_insert ON clinicians
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Registration edits go through a reviewed server path. A clinician must not be
-- able to set their own status to 'verified', which is the obvious attack on
-- self-service verification.
GRANT SELECT, INSERT ON clinicians TO authenticated;
GRANT ALL ON clinicians TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- patient_shares — the patient's control surface
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE patient_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_shares FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shares_owner_read ON patient_shares;
CREATE POLICY shares_owner_read ON patient_shares
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS shares_owner_insert ON patient_shares;
CREATE POLICY shares_owner_insert ON patient_shares
  FOR INSERT TO authenticated
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

-- Revocation must always be possible, instantly, without a server round-trip
-- that could fail. This is the patient's emergency brake.
DROP POLICY IF EXISTS shares_owner_revoke ON patient_shares;
CREATE POLICY shares_owner_revoke ON patient_shares
  FOR UPDATE TO authenticated
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()))
  WITH CHECK (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

-- A clinician sees the share rows naming them, so the portal can list "patients
-- who shared with me" — and nothing else.
DROP POLICY IF EXISTS shares_clinician_read ON patient_shares;
CREATE POLICY shares_clinician_read ON patient_shares
  FOR SELECT TO authenticated
  USING (
    clinician_id IN (
      SELECT id FROM clinicians
       WHERE auth_user_id = auth.uid() AND status = 'verified'
    )
    AND revoked_at IS NULL
    AND expires_at > now()
  );

GRANT SELECT, INSERT, UPDATE ON patient_shares TO authenticated;
GRANT ALL ON patient_shares TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- referrals — write-mostly telemetry
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referrals_self_insert ON referrals;
CREATE POLICY referrals_self_insert ON referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id IS NULL
    OR patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS referrals_self_read ON referrals;
CREATE POLICY referrals_self_read ON referrals
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid()));

GRANT SELECT, INSERT ON referrals TO authenticated;
GRANT ALL ON referrals TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- audit_log — a patient may read their own trail; nobody may write directly
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- "Who opened my chart?" is a question the patient is entitled to ask.
DROP POLICY IF EXISTS audit_self_read ON audit_log;
CREATE POLICY audit_self_read ON audit_log
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- No INSERT policy: writes go exclusively through log_audit(), which is
-- SECURITY DEFINER. Combined with the DO INSTEAD NOTHING rules in 0004, no role
-- can rewrite history.
REVOKE ALL ON audit_log FROM anon, authenticated;
GRANT SELECT ON audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit(actor_type, text, text, uuid, jsonb, char)
  TO authenticated, anon;

GRANT EXECUTE ON FUNCTION clinician_has_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_consent(uuid, consent_scope) TO authenticated;

-- Future tables must be granted explicitly. Without this, adding a table and
-- forgetting a GRANT is the safe failure (nobody can read it) rather than the
-- unsafe one.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

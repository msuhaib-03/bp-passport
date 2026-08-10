-- ═══════════════════════════════════════════════════════════════════════════
-- 0003 — Clinicians, patient-controlled sharing, referrals
-- ═══════════════════════════════════════════════════════════════════════════

-- ── clinicians ─────────────────────────────────────────────────────────────
-- PMDC verification is a three-phase strategy because PMDC publishes no
-- real-time API: manual cross-check against the published register at pilot
-- scale, then a nightly batch reconciliation, then a live API if one appears.
-- The `pmdc_number` column is shaped for all three, so phase C is a service
-- change and not a migration.
CREATE TABLE IF NOT EXISTS clinicians (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        uuid UNIQUE,

  pmdc_number         text NOT NULL UNIQUE
                        CHECK (pmdc_number ~ '^[A-Za-z0-9/-]{4,24}$'),

  -- Same app-layer encryption as patients: the database holds ciphertext.
  name_enc            bytea NOT NULL,
  phone_hmac          char(64)
                        CHECK (phone_hmac IS NULL OR phone_hmac ~ '^[0-9a-f]{64}$'),

  clinic_name         text NOT NULL,
  city                text NOT NULL,

  status              verification_status NOT NULL DEFAULT 'pending',
  verified_at         timestamptz,
  -- Who approved it, for the SSDS-compliant traceability requirement.
  verified_by         uuid,
  -- Set when a nightly batch no longer finds the number in the register.
  lapsed_at           timestamptz,

  subscription_active boolean NOT NULL DEFAULT false,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT clinician_verified_has_timestamp
    CHECK (status <> 'verified' OR verified_at IS NOT NULL)
);

DROP TRIGGER IF EXISTS clinicians_touch ON clinicians;
CREATE TRIGGER clinicians_touch BEFORE UPDATE ON clinicians
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS clinicians_status_idx ON clinicians (status, city);

-- ── patient_shares ─────────────────────────────────────────────────────────
-- The patient's control surface over their own record, and the only route by
-- which a clinician ever sees clinical data.
--
-- ZERO-KNOWLEDGE TOKEN. The patient's device generates a random secret and
-- sends it to the clinician (via WhatsApp, typically). Only the HMAC of that
-- secret is stored here. The server therefore cannot mint a valid share URL for
-- a patient it was not given one for — a database dump does not yield working
-- share links.
CREATE TABLE IF NOT EXISTS patient_shares (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- NULL for an open link ("show this to whichever GP I see"); set when the
  -- patient shares with one named, verified clinician.
  clinician_id      uuid REFERENCES clinicians(id) ON DELETE CASCADE,

  token_hmac        char(64) NOT NULL UNIQUE
                      CHECK (token_hmac ~ '^[0-9a-f]{64}$'),

  -- Bounded by construction. An unbounded share is a permanent disclosure, and
  -- a patient who shared once at a clinic visit two years ago did not consent to
  -- that clinic reading their pressure today.
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,

  -- Surfaced back to the patient as "Dr Aminah opened your chart" — a visible
  -- audit trail is what makes the control real rather than nominal.
  first_accessed_at timestamptz,
  access_count      integer NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT share_expires_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS shares_token_idx ON patient_shares (token_hmac);
CREATE INDEX IF NOT EXISTS shares_patient_idx
  ON patient_shares (patient_id, created_at DESC);
-- Partial index over live shares only: the access check runs on every portal
-- request and must not scan revoked history.
CREATE INDEX IF NOT EXISTS shares_live_idx
  ON patient_shares (clinician_id, patient_id)
  WHERE revoked_at IS NULL;

-- Is this share currently usable? One definition, used by both the RLS policy
-- and the application, so they can never disagree about what "expired" means.
CREATE OR REPLACE FUNCTION share_is_live(s patient_shares)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$ SELECT s.revoked_at IS NULL AND s.expires_at > now() $$;

-- Does the CURRENT clinician hold a live share for this patient?
--
-- SECURITY DEFINER because the policy on `readings` must consult
-- `patient_shares`, and a clinician has no direct read grant on that table.
-- search_path is pinned to defeat search-path hijacking, which is the standard
-- attack on a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION clinician_has_access(p_patient uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM patient_shares s
      JOIN clinicians c ON c.id = s.clinician_id
     WHERE s.patient_id = p_patient
       AND c.auth_user_id = auth.uid()
       AND c.status = 'verified'          -- a lapsed registration loses access
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
  )
$$;

-- ── referrals ──────────────────────────────────────────────────────────────
-- Click tracking on the clinic directory. This is how the pilot's second KPI
-- gate ("> 25% referral click-through among amber/red users") is measured, so it
-- records the risk tier at the moment of referral rather than joining back to a
-- reading that may since have changed.
CREATE TABLE IF NOT EXISTS referrals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id          uuid REFERENCES checkins(id) ON DELETE SET NULL,
  patient_id          uuid REFERENCES patients(id) ON DELETE CASCADE,
  clinic_name         text NOT NULL,
  category_at_referral bp_category,
  clicked_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referrals_category_idx
  ON referrals (category_at_referral, clicked_at DESC);

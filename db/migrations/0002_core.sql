-- ═══════════════════════════════════════════════════════════════════════════
-- 0002 — Core patient tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ── campaigns ──────────────────────────────────────────────────────────────
-- One row per physical screening touchpoint. `code` is what appears in the QR
-- link (?c=lums-spring) and is printed on physical posters, so it is immutable
-- in practice: 500 printed posters cannot be reissued.
CREATE TABLE IF NOT EXISTS campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE
                CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,31}$'),
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  city        text NOT NULL,
  type        campaign_type NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  starts_on   date,
  ends_on     date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_dates_ordered
    CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

DROP TRIGGER IF EXISTS campaigns_touch ON campaigns;
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── patients ───────────────────────────────────────────────────────────────
-- Soft identity by design. A kiosk scan must be able to produce a usable record
-- in 60 seconds, so nothing here is mandatory except the row itself.
--
-- PII HANDLING
-- ------------
--  · phone_hmac  — HMAC-SHA256(phone, server pepper), computed in the app.
--    NOT a bare SHA-256: a Pakistani mobile number has ~10⁹ possible values,
--    so an unpeppered digest is brute-forceable in seconds and is not
--    anonymisation. The pepper never enters the database.
--  · display_name_enc — AES-256-GCM ciphertext produced by the app. Postgres
--    stores bytes it cannot read.
-- No column here holds plaintext identifying data.
CREATE TABLE IF NOT EXISTS patients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to Supabase Auth once the patient verifies a phone number. NULL for a
  -- device-only record, which is the normal state after a kiosk scan.
  auth_user_id       uuid UNIQUE,

  phone_hmac         char(64) UNIQUE
                       CHECK (phone_hmac IS NULL OR phone_hmac ~ '^[0-9a-f]{64}$'),
  display_name_enc   bytea,

  campaign_id        uuid REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Denormalised for the funnel query "scans → registrations by campaign",
  -- which the pilot KPI gates are measured on.
  registered_at      timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS patients_touch ON patients;
CREATE TRIGGER patients_touch BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS patients_campaign_idx
  ON patients (campaign_id, created_at DESC);

-- ── consents ───────────────────────────────────────────────────────────────
-- The architecture documents had no consent model at all, while simultaneously
-- describing a pharma-affiliated research dataset built from patient readings.
-- That is the single largest regulatory exposure in the product, so consent is
-- a first-class table rather than a boolean on `patients`.
--
-- APPEND-ONLY LEDGER. A withdrawal is a new row with granted = false, never an
-- UPDATE. Under the pending PDPB, "we can show exactly what this person agreed
-- to on this date, and when they withdrew it" is the only defensible position,
-- and a mutable flag cannot demonstrate that.
CREATE TABLE IF NOT EXISTS consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  scope          consent_scope NOT NULL,
  granted        boolean NOT NULL,

  -- Which wording the patient actually saw. Consent to v1 text is not consent
  -- to v2 text, and re-consent is required when the wording materially changes.
  policy_version text NOT NULL,
  locale         text NOT NULL CHECK (locale IN ('en', 'ur')),

  ip_hash        char(64),
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consents_patient_scope_idx
  ON consents (patient_id, scope, recorded_at DESC);

-- Current effective state per (patient, scope): the latest row wins.
CREATE OR REPLACE FUNCTION has_consent(p_patient uuid, p_scope consent_scope)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT granted
       FROM consents
      WHERE patient_id = p_patient AND scope = p_scope
      ORDER BY recorded_at DESC
      LIMIT 1),
    false  -- absence of consent is refusal, never assent
  )
$$;

-- ── checkins ───────────────────────────────────────────────────────────────
-- One row per completed Heart Audit. Distinct from `readings`: a checkin is a
-- screening *event* with lifestyle context and a Heart Score attached, whereas a
-- reading is a bare longitudinal measurement. Mixing them would make the funnel
-- metrics uncountable.
CREATE TABLE IF NOT EXISTS checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  campaign_id   uuid REFERENCES campaigns(id) ON DELETE SET NULL,

  -- NULL when the subject completed the audit without access to a cuff, which
  -- is the common case at a poster rather than a staffed kiosk.
  systolic      smallint CHECK (systolic IS NULL OR systolic BETWEEN 60 AND 260),
  diastolic     smallint CHECK (diastolic IS NULL OR diastolic BETWEEN 30 AND 160),

  -- Derived, never inserted. A client cannot write a wrong category.
  category      bp_category
                  GENERATED ALWAYS AS (
                    CASE WHEN systolic IS NOT NULL AND diastolic IS NOT NULL
                         THEN bp_category(systolic, diastolic) END
                  ) STORED,
  urgency       bp_urgency
                  GENERATED ALWAYS AS (
                    CASE WHEN systolic IS NOT NULL AND diastolic IS NOT NULL
                         THEN bp_urgency(systolic, diastolic) END
                  ) STORED,
  map           numeric(5, 1)
                  GENERATED ALWAYS AS (
                    CASE WHEN systolic IS NOT NULL AND diastolic IS NOT NULL
                         THEN bp_map(systolic, diastolic) END
                  ) STORED,

  -- The five lifestyle answers, as columns rather than JSON: they are a fixed,
  -- known set, and typed columns let the research views aggregate them without
  -- parsing.
  sleep         lifestyle_level NOT NULL,
  sodium        lifestyle_level NOT NULL,
  stress        lifestyle_level NOT NULL,
  stimulants    lifestyle_level NOT NULL,
  activity      lifestyle_level NOT NULL,
  last_check    lifestyle_level,

  heart_score   smallint NOT NULL CHECK (heart_score BETWEEN 5 AND 100),
  -- Which weight set produced this score. When PHL signs off on revised
  -- weights, historical scores must remain interpretable rather than silently
  -- re-meaning.
  score_version text NOT NULL DEFAULT 'v1-provisional',

  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Systolic is the peak of the cardiac cycle; equal or inverted values mean the
  -- fields were transposed on entry. Enforced here as well as in the app,
  -- because the app is not the only possible writer.
  CONSTRAINT checkin_systolic_above_diastolic
    CHECK (systolic IS NULL OR diastolic IS NULL OR systolic > diastolic),
  CONSTRAINT checkin_reading_complete
    CHECK ((systolic IS NULL) = (diastolic IS NULL))
);

CREATE INDEX IF NOT EXISTS checkins_patient_idx
  ON checkins (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS checkins_campaign_idx
  ON checkins (campaign_id, created_at DESC);
-- Supports the crisis-spike alert: "more than N emergency-tier readings at one
-- campaign inside a 2-hour window".
CREATE INDEX IF NOT EXISTS checkins_urgency_idx
  ON checkins (urgency, created_at DESC)
  WHERE urgency = 'emergency';

-- ── readings ───────────────────────────────────────────────────────────────
-- The longitudinal log. This table is the entire clinical thesis: a GP cannot
-- titrate from one measurement, and 14 days of these is what makes the Clinician
-- Portal worth paying for.
CREATE TABLE IF NOT EXISTS readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  systolic      smallint NOT NULL CHECK (systolic BETWEEN 60 AND 260),
  diastolic     smallint NOT NULL CHECK (diastolic BETWEEN 30 AND 160),

  category      bp_category
                  GENERATED ALWAYS AS (bp_category(systolic, diastolic)) STORED,
  urgency       bp_urgency
                  GENERATED ALWAYS AS (bp_urgency(systolic, diastolic)) STORED,
  map           numeric(5, 1)
                  GENERATED ALWAYS AS (bp_map(systolic, diastolic)) STORED,

  -- Morning and evening readings are not interchangeable: morning surge is a
-- distinct clinical pattern, and the Clinician Portal segments on it.
  taken_at_time reading_time NOT NULL DEFAULT 'random',

  took_meds     boolean,
  low_salt      boolean,
  walked        boolean,

  logged_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reading_systolic_above_diastolic CHECK (systolic > diastolic)
);

-- The workhorse index: every portal query is "this patient, last N days, newest
-- first".
CREATE INDEX IF NOT EXISTS readings_patient_logged_idx
  ON readings (patient_id, logged_at DESC);

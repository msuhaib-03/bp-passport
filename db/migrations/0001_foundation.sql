-- ═══════════════════════════════════════════════════════════════════════════
-- 0001 — Foundation: auth shim, enums, and the clinical functions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THERE IS NO pgcrypto HERE
-- ----------------------------
-- Phone numbers are hashed and names are encrypted in the APPLICATION layer,
-- not in SQL. If the database computed the HMAC it would need the pepper, and a
-- database compromise would then yield both the hashes and the secret that makes
-- them irreversible — which defeats the point of hashing at all. The pepper
-- lives only in the application environment; Postgres stores opaque bytes it
-- cannot itself reverse.
--
-- This also matches the Phase 5 architecture note: "AES-256-GCM applied at the
-- application layer before PostgreSQL write. Transparent to database."

-- ── auth.uid() shim ────────────────────────────────────────────────────────
-- Supabase provides the `auth` schema and `auth.uid()`. Self-hosted Postgres
-- (the PTCL production target) and local test databases do not, so create them
-- only when absent. Every RLS policy in 0005 depends on this function, and it
-- must behave identically in both environments.
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    -- Reads the `sub` claim from the request JWT, exactly as Supabase does.
    -- Returns NULL for an unauthenticated request, which makes every RLS
    -- policy fail closed.
    EXECUTE $fn$
      CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $body$
        SELECT NULLIF(
          current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
          ''
        )::uuid
      $body$;
    $fn$;
  END IF;
END $$;

-- ── Enums ──────────────────────────────────────────────────────────────────
-- Enums rather than CHECK constraints so the type system carries the domain and
-- an invalid value cannot be inserted from any client.

DO $$ BEGIN
  CREATE TYPE campaign_type AS ENUM
    ('campus', 'pharmacy', 'clinic', 'corporate', 'hospital', 'event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ISH 2020 office-BP categories. Mirrors lib/clinical/bp-classification.ts.
DO $$ BEGIN
  CREATE TYPE bp_category AS ENUM
    ('optimal', 'normal', 'high_normal', 'grade_1', 'grade_2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Urgency is deliberately separate from category: a reading can be grade_2
-- without being a hypertensive crisis.
DO $$ BEGIN
  CREATE TYPE bp_urgency AS ENUM ('routine', 'soon', 'urgent', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lifestyle_level AS ENUM ('good', 'fair', 'poor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reading_time AS ENUM ('morning', 'evening', 'random');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM
    ('pending', 'verified', 'rejected', 'lapsed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Consent is granular. `essential` covers storing the reading the patient just
-- entered; `research` covers anonymised inclusion in the RWE dataset;
-- `reminders` covers outbound WhatsApp/SMS. They are recorded separately
-- because a patient must be able to accept care without accepting research.
DO $$ BEGIN
  CREATE TYPE consent_scope AS ENUM ('essential', 'research', 'reminders');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE actor_type AS ENUM ('patient', 'clinician', 'admin', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CLINICAL FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The BP classification exists in two places: TypeScript (for the client, which
-- must work offline) and SQL (so the database can index and filter on it). That
-- duplication is a correctness risk, and it is managed three ways:
--
--   1. The SQL columns are GENERATED ALWAYS ... STORED, so a category can never
--      be *inserted* — only derived. No client can write a wrong one.
--   2. tests/db.test.ts runs the identical boundary table through both
--      implementations and asserts they agree, so drift fails CI.
--   3. Both files name the same guideline and the same thresholds in comments.

-- Category implied by the systolic value alone.
CREATE OR REPLACE FUNCTION bp_category_systolic(sbp smallint)
RETURNS bp_category
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN sbp >= 160 THEN 'grade_2'
    WHEN sbp >= 140 THEN 'grade_1'
    WHEN sbp >= 130 THEN 'high_normal'
    WHEN sbp >= 120 THEN 'normal'
    ELSE 'optimal'
  END::bp_category
$$;

-- Category implied by the diastolic value alone.
CREATE OR REPLACE FUNCTION bp_category_diastolic(dbp smallint)
RETURNS bp_category
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN dbp >= 100 THEN 'grade_2'
    WHEN dbp >= 90  THEN 'grade_1'
    WHEN dbp >= 85  THEN 'high_normal'
    WHEN dbp >= 80  THEN 'normal'
    ELSE 'optimal'
  END::bp_category
$$;

-- ISH 2020 "and/or" logic: the reading takes the HIGHER of the two categories.
-- A patient at 135/95 is grade_1 on the diastolic value alone; classifying on
-- systolic would under-triage them. Enum ordinal comparison gives us the max
-- for free because the enum is declared in severity order.
CREATE OR REPLACE FUNCTION bp_category(sbp smallint, dbp smallint)
RETURNS bp_category
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT GREATEST(
    bp_category_systolic(sbp),
    bp_category_diastolic(dbp)
  )
$$;

-- Hypertensive crisis (ACC/AHA thresholds), held apart from the category ladder.
CREATE OR REPLACE FUNCTION bp_is_crisis(sbp smallint, dbp smallint)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT sbp >= 180 OR dbp >= 120 $$;

CREATE OR REPLACE FUNCTION bp_urgency(sbp smallint, dbp smallint)
RETURNS bp_urgency
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN sbp >= 180 OR dbp >= 120 THEN 'emergency'
    WHEN sbp >= 160 OR dbp >= 100 THEN 'urgent'
    WHEN bp_category(sbp, dbp) IN ('grade_1', 'grade_2') THEN 'soon'
    ELSE 'routine'
  END::bp_urgency
$$;

-- Mean arterial pressure, (SBP + 2·DBP) / 3, to one decimal.
CREATE OR REPLACE FUNCTION bp_map(sbp smallint, dbp smallint)
RETURNS numeric(5, 1)
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT round((sbp + 2::numeric * dbp) / 3, 1) $$;

-- ── updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

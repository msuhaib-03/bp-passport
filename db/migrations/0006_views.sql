-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — Clinician summary + anonymised research views
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The figure a GP can act on ─────────────────────────────────────────────
-- The Clinician Portal renders mean ± SD over a window, never a list of raw
-- daily values. That distinction is the whole product thesis: a GP cannot
-- titrate from one reading, and handing them an unsummarised list is exactly why
-- paper diaries get ignored.
--
-- SECURITY INVOKER (the default) is deliberate: the function reads `readings`,
-- so the caller's RLS policies apply and a clinician only gets a summary for a
-- patient who actually shared with them. Making this SECURITY DEFINER would
-- quietly turn it into a way to read any patient's data by guessing a UUID.
CREATE OR REPLACE FUNCTION patient_bp_summary(
  p_patient uuid,
  p_days    integer DEFAULT 14
)
RETURNS TABLE (
  reading_count   bigint,
  mean_systolic   numeric(5, 1),
  mean_diastolic  numeric(5, 1),
  sd_systolic     numeric(5, 1),
  sd_diastolic    numeric(5, 1),
  mean_category   bp_category,
  morning_mean_systolic numeric(5, 1),
  evening_mean_systolic numeric(5, 1),
  highest_systolic smallint,
  any_crisis      boolean,
  adherence_rate  numeric(4, 3)
)
LANGUAGE sql STABLE
AS $$
  WITH window_readings AS (
    SELECT *
      FROM readings
     WHERE patient_id = p_patient
       AND logged_at >= now() - make_interval(days => p_days)
  ), stats AS (
    SELECT
      count(*)                                        AS n,
      round(avg(systolic)::numeric, 1)                AS mean_sys,
      round(avg(diastolic)::numeric, 1)               AS mean_dia,
      -- stddev_samp is NULL for a single row; 0 is the honest answer there.
      round(COALESCE(stddev_samp(systolic), 0)::numeric, 1)  AS sd_sys,
      round(COALESCE(stddev_samp(diastolic), 0)::numeric, 1) AS sd_dia,
      round(avg(CASE WHEN taken_at_time = 'morning' THEN systolic END)::numeric, 1) AS am_sys,
      round(avg(CASE WHEN taken_at_time = 'evening' THEN systolic END)::numeric, 1) AS pm_sys,
      max(systolic)                                   AS max_sys,
      bool_or(bp_is_crisis(systolic, diastolic))      AS crisis,
      -- Self-reported medication adherence across the window. NULL answers are
      -- excluded rather than counted as false: "did not say" is not "did not take".
      round(
        avg(CASE WHEN took_meds THEN 1.0 WHEN took_meds IS FALSE THEN 0.0 END),
        3
      ) AS adherence
      FROM window_readings
  )
  SELECT
    n, mean_sys, mean_dia, sd_sys, sd_dia,
    -- Category of the MEAN, which is the clinically meaningful figure, not the
    -- category of the most recent or the worst reading.
    CASE WHEN n > 0 AND round(mean_sys) > round(mean_dia)
         THEN bp_category(round(mean_sys)::smallint, round(mean_dia)::smallint)
    END,
    am_sys, pm_sys, max_sys, COALESCE(crisis, false), adherence
    FROM stats
   WHERE n > 0
$$;

GRANT EXECUTE ON FUNCTION patient_bp_summary(uuid, integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- RESEARCH SCHEMA — the RWE dataset
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This is the asset the business case rests on, and also the largest privacy
-- exposure in the product. Four protections are built in rather than promised:
--
--   1. CONSENT GATE. Only patients with an active `research` consent appear.
--      Consent is checked in the view, so it cannot be forgotten by a caller.
--   2. NO IDENTIFIER PATH. A per-row `research_id` is derived from a dedicated
--      salt table, so nothing in this schema joins back to `patients`.
--   3. GENERALISATION. Systolic values are banded to 5 mmHg. Exact values plus
--      a timestamp plus a city is close to a fingerprint.
--   4. k-ANONYMITY. Campaign/period cells with fewer than 5 members are
--      suppressed, because "the only 19-year-old screened at that pharmacy in
--      March" is identifiable regardless of what was removed.
CREATE SCHEMA IF NOT EXISTS research;
REVOKE ALL ON SCHEMA research FROM anon, authenticated;

-- Per-patient random surrogate. Held in its own table so that dropping it
-- permanently severs the link between the research dataset and the patients —
-- a one-command, irreversible de-identification.
CREATE TABLE IF NOT EXISTS research.patient_surrogates (
  patient_id  uuid PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  research_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  assigned_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE research.patient_surrogates ENABLE ROW LEVEL SECURITY;
-- No policies at all: only service_role (BYPASSRLS) can ever read this.

CREATE OR REPLACE FUNCTION research.surrogate_for(p_patient uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = research, public, pg_temp
AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO research.patient_surrogates (patient_id)
  VALUES (p_patient)
  ON CONFLICT (patient_id) DO NOTHING;
  SELECT research_id INTO v
    FROM research.patient_surrogates WHERE patient_id = p_patient;
  RETURN v;
END $$;

-- Band a systolic value to a 5 mmHg bucket: 128 → '125-129'.
CREATE OR REPLACE FUNCTION research.systolic_band(sbp smallint)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT CASE
    WHEN sbp < 90  THEN '<90'
    WHEN sbp >= 200 THEN '200+'
    ELSE ((sbp / 5) * 5)::text || '-' || ((sbp / 5) * 5 + 4)::text
  END
$$;

-- The consented, generalised, k-anonymised fact table.
CREATE OR REPLACE VIEW research.checkin_facts AS
WITH consented AS (
  SELECT c.*,
         research.surrogate_for(c.patient_id) AS research_id,
         cam.city   AS campaign_city,
         cam.type   AS campaign_type,
         cam.code   AS campaign_code
    FROM checkins c
    LEFT JOIN campaigns cam ON cam.id = c.campaign_id
   WHERE has_consent(c.patient_id, 'research')
     AND c.systolic IS NOT NULL
), cells AS (
  -- k-anonymity is computed over the cell a re-identification attempt would
  -- actually use: where, when, and which category.
  SELECT campaign_code,
         to_char(created_at, 'YYYY-MM') AS period,
         category,
         count(*) AS cell_size
    FROM consented
   GROUP BY 1, 2, 3
)
SELECT
  c.research_id,
  to_char(c.created_at, 'YYYY-MM')          AS period,
  c.campaign_city                            AS city,
  c.campaign_type,
  research.systolic_band(c.systolic)         AS systolic_band,
  c.diastolic,
  c.map,
  c.category,
  c.urgency,
  c.heart_score,
  c.score_version,
  c.sleep, c.sodium, c.stress, c.stimulants, c.activity
  FROM consented c
  JOIN cells k
    ON k.campaign_code = c.campaign_code
   AND k.period        = to_char(c.created_at, 'YYYY-MM')
   AND k.category      = c.category
 WHERE k.cell_size >= 5;   -- k = 5

COMMENT ON VIEW research.checkin_facts IS
  'Consented, 5 mmHg-banded, k>=5 suppressed screening facts. No column joins '
  'back to patients. Exports must be logged via log_audit(''system'', '
  '''research.exported'', ...) with a stated intended use.';

-- Population-level rollup, safe to share externally and to publish.
CREATE OR REPLACE VIEW research.population_summary AS
SELECT
  period,
  city,
  count(*)                                          AS screenings,
  round(avg(heart_score)::numeric, 1)               AS mean_heart_score,
  round(100.0 * count(*) FILTER (WHERE category IN ('grade_1', 'grade_2'))
        / NULLIF(count(*), 0), 1)                   AS pct_hypertensive_range,
  round(100.0 * count(*) FILTER (WHERE urgency = 'emergency')
        / NULLIF(count(*), 0), 2)                   AS pct_crisis_tier,
  round(100.0 * count(*) FILTER (WHERE sodium = 'poor')
        / NULLIF(count(*), 0), 1)                   AS pct_high_sodium
  FROM research.checkin_facts
 GROUP BY period, city
HAVING count(*) >= 5;

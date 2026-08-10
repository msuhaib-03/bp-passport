-- ═══════════════════════════════════════════════════════════════════════════
-- Development seed — DO NOT RUN AGAINST PRODUCTION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Campaign rows only. There is deliberately no fake patient data here: seeding
-- synthetic clinical records into a shared environment is how test readings end
-- up in a real pilot's KPI numbers, and how a demo ends up presenting invented
-- outcomes as real ones. Patient fixtures live in tests/db.test.ts, scoped to an
-- in-memory database that is discarded when the suite ends.
--
-- The three pilot sites named in the investment plan, plus a generic poster
-- campaign for QR codes printed without a specific host.

INSERT INTO campaigns (code, name, city, type, active) VALUES
  ('nicvd-opd',    'NICVD Outpatient Department', 'Karachi', 'hospital',  true),
  ('lums-campus',  'LUMS Campus Activation',      'Lahore',  'campus',    true),
  ('engro-hq',     'Engro Corporate Wellness',    'Karachi', 'corporate', true),
  ('dvago-karachi','DVAGO Pharmacy Network',      'Karachi', 'pharmacy',  true),
  ('poster',       'General Poster / Walk-up',    'National','event',     true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      city = EXCLUDED.city,
      type = EXCLUDED.type,
      active = EXCLUDED.active;

-- Sanity check the classification functions landed correctly. Any row printing
-- FAIL means 0001 did not apply as expected and nothing downstream is safe.
DO $$
DECLARE
  ok boolean := true;
BEGIN
  -- ISH "and/or": diastolic drives this one.
  IF bp_category(135::smallint, 95::smallint) <> 'grade_1' THEN
    RAISE WARNING 'FAIL: 135/95 should be grade_1'; ok := false;
  END IF;
  IF bp_category(119::smallint, 79::smallint) <> 'optimal' THEN
    RAISE WARNING 'FAIL: 119/79 should be optimal'; ok := false;
  END IF;
  IF NOT bp_is_crisis(180::smallint, 90::smallint) THEN
    RAISE WARNING 'FAIL: 180/90 should be a crisis'; ok := false;
  END IF;
  IF bp_urgency(165::smallint, 105::smallint) <> 'urgent' THEN
    RAISE WARNING 'FAIL: 165/105 should be urgent, not emergency'; ok := false;
  END IF;
  IF bp_map(120::smallint, 80::smallint) <> 93.3 THEN
    RAISE WARNING 'FAIL: MAP of 120/80 should be 93.3'; ok := false;
  END IF;

  IF ok THEN
    RAISE NOTICE 'Clinical functions verified. Seed complete.';
  ELSE
    RAISE EXCEPTION 'Clinical function verification failed — check 0001_foundation.sql';
  END IF;
END $$;

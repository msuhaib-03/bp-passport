-- 0009 — Reliable sync, clinician onboarding, and patient-controlled sharing
--
-- Client event IDs make browser retries idempotent. The RPCs below keep all
-- authorization at the database boundary and expose only the minimum identity
-- fields needed by the patient and clinician screens.

-- Superseded by sync_passport below, which records storage consent in the same
-- transaction and cannot persist clinical data without it.
DROP FUNCTION IF EXISTS create_passport(text,timestamptz,uuid,jsonb,jsonb,smallint);

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS client_event_id uuid;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS client_event_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkins_client_event_id_key'
  ) THEN
    ALTER TABLE checkins
      ADD CONSTRAINT checkins_client_event_id_key UNIQUE (client_event_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'readings_client_event_id_key'
  ) THEN
    ALTER TABLE readings
      ADD CONSTRAINT readings_client_event_id_key UNIQUE (client_event_id);
  END IF;
END $$;

DROP FUNCTION IF EXISTS sync_passport(
  text,timestamptz,uuid,jsonb,jsonb,smallint,lifestyle_level,uuid
);

CREATE OR REPLACE FUNCTION sync_passport(
  p_code text,
  p_created timestamptz,
  p_campaign uuid,
  p_answers jsonb,
  p_reading jsonb,
  p_score smallint,
  p_last_check lifestyle_level,
  p_event uuid,
  p_grant_storage boolean,
  p_policy text,
  p_locale text
)
RETURNS TABLE(patient_id uuid, passport_code text, created boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_patient patients;
  v_created boolean := false;
  v_consent_granted boolean;
  v_consent_policy text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_event IS NULL THEN
    RAISE EXCEPTION 'Client event ID required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  SELECT * INTO v_patient FROM patients WHERE auth_user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO patients(auth_user_id, passport_code, campaign_id, registered_at)
      VALUES(auth.uid(), p_code, p_campaign, p_created)
      RETURNING * INTO v_patient;
    v_created := true;
  ELSIF v_patient.passport_code IS NULL THEN
    UPDATE patients SET passport_code = p_code, last_seen_at = now()
      WHERE id = v_patient.id RETURNING * INTO v_patient;
  ELSE
    UPDATE patients SET last_seen_at = now() WHERE id = v_patient.id;
  END IF;

  SELECT granted, policy_version INTO v_consent_granted, v_consent_policy
  FROM consents
  WHERE consents.patient_id = v_patient.id AND scope = 'essential'
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF p_grant_storage THEN
    IF p_policy IS NULL OR length(trim(p_policy)) = 0 OR p_locale NOT IN ('en', 'ur') THEN
      RAISE EXCEPTION 'Invalid storage consent' USING ERRCODE = '22023';
    END IF;
    IF v_consent_granted IS DISTINCT FROM true OR v_consent_policy IS DISTINCT FROM p_policy THEN
      INSERT INTO consents(patient_id, scope, granted, policy_version, locale)
      VALUES(v_patient.id, 'essential', true, p_policy, p_locale);
    END IF;
  ELSIF v_consent_granted IS DISTINCT FROM true OR v_consent_policy IS DISTINCT FROM p_policy THEN
    RAISE EXCEPTION 'Storage consent required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO checkins(
    client_event_id, patient_id, campaign_id, systolic, diastolic,
    sleep, sodium, stress, stimulants, activity, last_check, heart_score
  )
  VALUES(
    p_event, v_patient.id, p_campaign,
    CASE WHEN p_reading IS NULL OR p_reading = 'null'::jsonb
      THEN NULL ELSE (p_reading->>'systolic')::smallint END,
    CASE WHEN p_reading IS NULL OR p_reading = 'null'::jsonb
      THEN NULL ELSE (p_reading->>'diastolic')::smallint END,
    (p_answers->>'sleep')::lifestyle_level,
    (p_answers->>'sodium')::lifestyle_level,
    (p_answers->>'stress')::lifestyle_level,
    (p_answers->>'stimulants')::lifestyle_level,
    (p_answers->>'activity')::lifestyle_level,
    p_last_check,
    p_score
  )
  ON CONFLICT (client_event_id) DO NOTHING;

  IF p_reading IS NOT NULL AND p_reading <> 'null'::jsonb THEN
    INSERT INTO readings(
      client_event_id, patient_id, systolic, diastolic, taken_at_time,
      logged_at
    )
    VALUES(
      p_event, v_patient.id,
      (p_reading->>'systolic')::smallint,
      (p_reading->>'diastolic')::smallint,
      COALESCE((p_reading->>'takenAtTime')::reading_time, 'random'),
      COALESCE((p_reading->>'at')::timestamptz, p_created)
    )
    ON CONFLICT (client_event_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_patient.id, v_patient.passport_code, v_created;
END $$;

REVOKE ALL ON FUNCTION sync_passport(
  text,timestamptz,uuid,jsonb,jsonb,smallint,lifestyle_level,uuid,boolean,text,text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_passport(
  text,timestamptz,uuid,jsonb,jsonb,smallint,lifestyle_level,uuid,boolean,text,text
) TO authenticated;

CREATE OR REPLACE FUNCTION record_reading(
  p_event uuid,
  p_systolic smallint,
  p_diastolic smallint,
  p_logged_at timestamptz,
  p_taken_at_time reading_time DEFAULT 'random',
  p_took_meds boolean DEFAULT NULL,
  p_low_salt boolean DEFAULT NULL,
  p_walked boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_patient uuid;
  v_reading uuid;
BEGIN
  SELECT id INTO v_patient FROM patients WHERE auth_user_id = auth.uid();
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Passport not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT has_consent(v_patient, 'essential') THEN
    RAISE EXCEPTION 'Storage consent required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO readings(
    client_event_id, patient_id, systolic, diastolic, taken_at_time,
    took_meds, low_salt, walked, logged_at
  )
  VALUES(
    p_event, v_patient, p_systolic, p_diastolic, p_taken_at_time,
    p_took_meds, p_low_salt, p_walked, p_logged_at
  )
  ON CONFLICT (client_event_id) DO NOTHING
  RETURNING id INTO v_reading;

  IF v_reading IS NULL THEN
    SELECT id INTO v_reading FROM readings
      WHERE patient_id = v_patient AND client_event_id = p_event;
  END IF;
  RETURN v_reading;
END $$;

REVOKE ALL ON FUNCTION record_reading(
  uuid,smallint,smallint,timestamptz,reading_time,boolean,boolean,boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_reading(
  uuid,smallint,smallint,timestamptz,reading_time,boolean,boolean,boolean
) TO authenticated;

-- Resolve a verified clinician and create a named share without exposing the
-- private clinician registry to arbitrary SELECT queries.
CREATE OR REPLACE FUNCTION create_patient_share(
  p_hash text,
  p_pmdc text,
  p_expires timestamptz
)
RETURNS TABLE(
  share_id uuid,
  clinician_id uuid,
  pmdc_number text,
  clinic_name text,
  city text,
  expires_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_patient uuid;
  v_clinician clinicians;
  v_share patient_shares;
BEGIN
  IF auth.uid() IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid share request' USING ERRCODE = '22023';
  END IF;
  IF p_expires <= now() OR p_expires > now() + interval '31 days' THEN
    RAISE EXCEPTION 'Invalid share expiry' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_patient FROM patients WHERE auth_user_id = auth.uid();
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Passport not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_clinician FROM clinicians
    WHERE upper(clinicians.pmdc_number) = upper(trim(p_pmdc))
      AND status = 'verified'
    ORDER BY created_at
    LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verified clinician not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO patient_shares(patient_id, clinician_id, token_hmac, expires_at)
    VALUES(v_patient, v_clinician.id, p_hash, p_expires)
    RETURNING * INTO v_share;

  RETURN QUERY SELECT v_share.id, v_clinician.id, v_clinician.pmdc_number,
    v_clinician.clinic_name, v_clinician.city, v_share.expires_at;
END $$;

REVOKE ALL ON FUNCTION create_patient_share(text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_patient_share(text,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION patient_share_list()
RETURNS TABLE(
  share_id uuid,
  pmdc_number text,
  clinic_name text,
  city text,
  expires_at timestamptz,
  revoked_at timestamptz,
  first_accessed_at timestamptz,
  access_count integer,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.id, c.pmdc_number, c.clinic_name, c.city, s.expires_at,
    s.revoked_at, s.first_accessed_at, s.access_count, s.created_at
  FROM patient_shares s
  JOIN patients p ON p.id = s.patient_id
  JOIN clinicians c ON c.id = s.clinician_id
  WHERE p.auth_user_id = auth.uid()
  ORDER BY s.created_at DESC
  LIMIT 100
$$;

REVOKE ALL ON FUNCTION patient_share_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION patient_share_list() TO authenticated;

CREATE OR REPLACE FUNCTION clinician_patient_share_list()
RETURNS TABLE(
  share_id uuid,
  patient_id uuid,
  passport_code text,
  expires_at timestamptz,
  first_accessed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.id, s.patient_id, p.passport_code, s.expires_at,
    s.first_accessed_at, s.created_at
  FROM patient_shares s
  JOIN clinicians c ON c.id = s.clinician_id
  JOIN patients p ON p.id = s.patient_id
  WHERE c.auth_user_id = auth.uid()
    AND c.status = 'verified'
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.created_at DESC
  LIMIT 100
$$;

REVOKE ALL ON FUNCTION clinician_patient_share_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clinician_patient_share_list() TO authenticated;

CREATE OR REPLACE FUNCTION open_patient_share_by_patient(p_patient uuid)
RETURNS TABLE(patient_id uuid, share_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_share patient_shares;
BEGIN
  SELECT s.* INTO v_share
  FROM patient_shares s
  JOIN clinicians c ON c.id = s.clinician_id
  WHERE s.patient_id = p_patient
    AND c.auth_user_id = auth.uid()
    AND c.status = 'verified'
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE OF s;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE patient_shares
    SET first_accessed_at = COALESCE(first_accessed_at, now()),
        access_count = access_count + 1
    WHERE id = v_share.id;
  RETURN QUERY SELECT v_share.patient_id, v_share.id;
END $$;

REVOKE ALL ON FUNCTION open_patient_share_by_patient(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION open_patient_share_by_patient(uuid) TO authenticated;

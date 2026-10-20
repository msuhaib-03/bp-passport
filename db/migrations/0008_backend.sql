-- Atomic patient onboarding under the caller's RLS policies.
CREATE OR REPLACE FUNCTION create_passport(p_code text, p_created timestamptz,
  p_campaign uuid, p_answers jsonb, p_reading jsonb, p_score smallint)
RETURNS TABLE(patient_id uuid, passport_code text, created boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_patient patients; v_created boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  -- Serialize retries for this identity, including simultaneous requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  SELECT * INTO v_patient FROM patients WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO patients(auth_user_id, passport_code, campaign_id, registered_at)
      VALUES(auth.uid(), p_code, p_campaign, p_created) RETURNING * INTO v_patient;
    INSERT INTO checkins(patient_id, campaign_id, systolic, diastolic,
      sleep, sodium, stress, stimulants, activity, heart_score)
    VALUES(v_patient.id, p_campaign, (p_reading->>'systolic')::smallint,
      (p_reading->>'diastolic')::smallint, (p_answers->>'sleep')::lifestyle_level,
      (p_answers->>'sodium')::lifestyle_level, (p_answers->>'stress')::lifestyle_level,
      (p_answers->>'stimulants')::lifestyle_level, (p_answers->>'activity')::lifestyle_level, p_score);
    IF p_reading IS NOT NULL AND p_reading <> 'null'::jsonb THEN
      INSERT INTO readings(patient_id, systolic, diastolic, logged_at)
      VALUES(v_patient.id, (p_reading->>'systolic')::smallint,
        (p_reading->>'diastolic')::smallint, COALESCE((p_reading->>'at')::timestamptz, p_created));
    END IF;
    v_created := true;
  END IF;
  RETURN QUERY SELECT v_patient.id, v_patient.passport_code, v_created;
END $$;
REVOKE ALL ON FUNCTION create_passport(text,timestamptz,uuid,jsonb,jsonb,smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_passport(text,timestamptz,uuid,jsonb,jsonb,smallint) TO authenticated;

-- Registration cannot grant clinical authority, even through direct REST calls.
DROP POLICY IF EXISTS clinicians_self_insert ON clinicians;
CREATE POLICY clinicians_self_insert ON clinicians FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid() AND status = 'pending'
    AND verified_at IS NULL AND verified_by IS NULL AND lapsed_at IS NULL
    AND subscription_active = false);

-- Invoker permissions preserve patient ownership and clinician RLS.
CREATE OR REPLACE FUNCTION share_is_live(s patient_shares) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT s.revoked_at IS NULL AND s.expires_at > now() $$;

-- Resolve a secret only for an already verified, named clinician. The hash is
-- passed instead of putting the secret into SQL logs. No service key is used.
CREATE OR REPLACE FUNCTION open_patient_share(p_hash text)
RETURNS TABLE(patient_id uuid, share_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_share patient_shares;
BEGIN
  SELECT s.* INTO v_share FROM patient_shares s JOIN clinicians c ON c.id = s.clinician_id
   WHERE s.token_hmac = p_hash AND c.auth_user_id = auth.uid()
     AND c.status = 'verified' AND s.revoked_at IS NULL AND s.expires_at > now()
   FOR UPDATE OF s;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE patient_shares SET first_accessed_at = COALESCE(first_accessed_at, now()),
    access_count = access_count + 1 WHERE id = v_share.id;
  RETURN QUERY SELECT v_share.patient_id, v_share.id;
END $$;
REVOKE ALL ON FUNCTION open_patient_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION open_patient_share(text) TO authenticated;

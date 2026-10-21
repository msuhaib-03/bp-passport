-- 0012 — Temporary pilot clinician access
--
-- PMDC does not currently provide this pilot with a verification integration.
-- During the pilot, a signed-in clinician with a pending profile may use only
-- patient-authorized, expiring, read-only shares. Rejected and lapsed profiles
-- remain blocked. Replace this migration with verified-only access before a
-- regulated production launch.

CREATE OR REPLACE FUNCTION clinician_has_access(p_patient uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM patient_shares s
    JOIN clinicians c ON c.id = s.clinician_id
    WHERE s.patient_id = p_patient
      AND c.auth_user_id = auth.uid()
      AND c.status IN ('pending', 'verified')
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
  )
$$;

DROP POLICY IF EXISTS shares_clinician_read ON patient_shares;
CREATE POLICY shares_clinician_read ON patient_shares
  FOR SELECT TO authenticated
  USING (
    clinician_id IN (
      SELECT id FROM clinicians
      WHERE auth_user_id = auth.uid() AND status IN ('pending', 'verified')
    )
    AND revoked_at IS NULL
    AND expires_at > now()
  );

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
    AND status IN ('pending', 'verified')
  ORDER BY created_at
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active pilot clinician not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO patient_shares(patient_id, clinician_id, token_hmac, expires_at)
  VALUES(v_patient, v_clinician.id, p_hash, p_expires)
  RETURNING * INTO v_share;

  RETURN QUERY SELECT v_share.id, v_clinician.id, v_clinician.pmdc_number,
    v_clinician.clinic_name, v_clinician.city, v_share.expires_at;
END $$;

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
    AND c.status IN ('pending', 'verified')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.created_at DESC
  LIMIT 100
$$;

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
    AND c.status IN ('pending', 'verified')
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

CREATE OR REPLACE FUNCTION open_patient_share(p_hash text)
RETURNS TABLE(patient_id uuid, share_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_share patient_shares;
BEGIN
  SELECT s.* INTO v_share
  FROM patient_shares s
  JOIN clinicians c ON c.id = s.clinician_id
  WHERE s.token_hmac = p_hash
    AND c.auth_user_id = auth.uid()
    AND c.status IN ('pending', 'verified')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  FOR UPDATE OF s;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE patient_shares
  SET first_accessed_at = COALESCE(first_accessed_at, now()),
      access_count = access_count + 1
  WHERE id = v_share.id;
  RETURN QUERY SELECT v_share.patient_id, v_share.id;
END $$;

REVOKE ALL ON FUNCTION clinician_has_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_patient_share(text,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION clinician_patient_share_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION open_patient_share_by_patient(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION open_patient_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clinician_has_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_patient_share(text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION clinician_patient_share_list() TO authenticated;
GRANT EXECUTE ON FUNCTION open_patient_share_by_patient(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION open_patient_share(text) TO authenticated;

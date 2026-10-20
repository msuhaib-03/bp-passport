-- 0010 — Audited clinician review workflow
--
-- Only the server-side service role may call this function. The browser never
-- receives that credential, and every approval or rejection is append-only in
-- the audit log.

CREATE OR REPLACE FUNCTION review_clinician(
  p_clinician uuid,
  p_status verification_status
)
RETURNS TABLE(
  clinician_id uuid,
  status verification_status,
  verified_at timestamptz
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_clinician clinicians;
BEGIN
  IF p_status NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status' USING ERRCODE = '22023';
  END IF;

  UPDATE clinicians
  SET status = p_status,
      verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE NULL END,
      verified_by = NULL,
      lapsed_at = NULL
  WHERE id = p_clinician
  RETURNING * INTO v_clinician;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clinician not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM log_audit(
    'admin',
    CASE WHEN p_status = 'verified' THEN 'clinician.verified' ELSE 'clinician.rejected' END,
    'clinician',
    v_clinician.id,
    jsonb_build_object('status', p_status)
  );

  RETURN QUERY SELECT v_clinician.id, v_clinician.status, v_clinician.verified_at;
END $$;

REVOKE ALL ON FUNCTION review_clinician(uuid, verification_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION review_clinician(uuid, verification_status) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 0004 — Append-only audit log
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Required by SSDS/provincial health-commission expectations and by the pending
-- PDPB, both of which ask a question the application cannot answer on its own:
-- *who accessed this patient's record, and when?*
--
-- APPEND-ONLY IS ENFORCED, NOT DOCUMENTED. Rules reject UPDATE and DELETE for
-- every role including the table owner. A log that the application can rewrite
-- is not evidence of anything.

CREATE TABLE IF NOT EXISTS audit_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  actor          actor_type NOT NULL,
  -- auth.uid() of the actor. NULL for `system` (cron pipelines, batch jobs).
  actor_id       uuid,

  -- Dotted verb: 'share.created', 'share.accessed', 'reading.logged',
  -- 'consent.withdrawn', 'guardrail.blocked', 'clinician.verified'.
  action         text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),

  resource_type  text,
  resource_id    uuid,

  -- Hashed, not stored raw: an IP address is personal data under the PDPB, and
  -- the log only ever needs to answer "same origin or different?".
  ip_hash        char(64),

  -- Small structured context. Must never carry PII or a clinical value — the
  -- audit log is retained far longer than clinical data and is read by more
  -- people, so widening it into a second copy of the record would be a leak.
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb
                   CHECK (pg_column_size(metadata) < 2048),

  occurred_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_resource_idx
  ON audit_log (resource_type, resource_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_idx
  ON audit_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_action_idx
  ON audit_log (action, occurred_at DESC);

-- Immutability. Rules fire before permission checks and apply to every role, so
-- this holds even for a superuser connection or a compromised service key.
CREATE OR REPLACE RULE audit_log_no_update AS
  ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_no_delete AS
  ON DELETE TO audit_log DO INSTEAD NOTHING;

-- The only supported way to write a log line. SECURITY DEFINER so callers need
-- no direct grant on the table, which means no role can be given INSERT and then
-- discover it also has UPDATE.
CREATE OR REPLACE FUNCTION log_audit(
  p_actor         actor_type,
  p_action        text,
  p_resource_type text DEFAULT NULL,
  p_resource_id   uuid DEFAULT NULL,
  p_metadata      jsonb DEFAULT '{}'::jsonb,
  p_ip_hash       char(64) DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO audit_log (actor, actor_id, action, resource_type, resource_id,
                         metadata, ip_hash)
  VALUES (p_actor, auth.uid(), p_action, p_resource_type, p_resource_id,
          COALESCE(p_metadata, '{}'::jsonb), p_ip_hash);
END $$;

-- ── Automatic logging of share access ──────────────────────────────────────
-- Clinician access to a patient record is the disclosure event that matters
-- most, so it is logged by a trigger rather than by application code. Trusting
-- the caller to remember is how audit gaps happen.
CREATE OR REPLACE FUNCTION on_share_accessed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.access_count > OLD.access_count THEN
    PERFORM log_audit(
      'clinician', 'share.accessed', 'patient_share', NEW.id,
      jsonb_build_object(
        'patient_id',   NEW.patient_id,
        'clinician_id', NEW.clinician_id,
        'first_access', OLD.first_accessed_at IS NULL
      )
    );
  END IF;
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    PERFORM log_audit('patient', 'share.revoked', 'patient_share', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shares_audit ON patient_shares;
CREATE TRIGGER shares_audit AFTER UPDATE ON patient_shares
  FOR EACH ROW EXECUTE FUNCTION on_share_accessed();

-- Consent changes are equally load-bearing under the PDPB.
CREATE OR REPLACE FUNCTION on_consent_recorded()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM log_audit(
    'patient',
    CASE WHEN NEW.granted THEN 'consent.granted' ELSE 'consent.withdrawn' END,
    'consent', NEW.id,
    jsonb_build_object('scope', NEW.scope, 'policy_version', NEW.policy_version)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS consents_audit ON consents;
CREATE TRIGGER consents_audit AFTER INSERT ON consents
  FOR EACH ROW EXECUTE FUNCTION on_consent_recorded();

-- 0011 — Immediate API token revocation
--
-- Supabase global sign-out revokes refresh tokens. This deny-list also rejects
-- the current access token immediately at our API boundary until it expires.

CREATE TABLE IF NOT EXISTS revoked_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT revoked_sessions_expiry_valid CHECK (expires_at > revoked_at)
);

CREATE INDEX IF NOT EXISTS revoked_sessions_expires_at_idx
  ON revoked_sessions(expires_at);

ALTER TABLE revoked_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revoked_sessions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE revoked_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE revoked_sessions TO service_role;

CREATE OR REPLACE FUNCTION purge_expired_revoked_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM revoked_sessions WHERE expires_at <= now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;

REVOKE ALL ON FUNCTION purge_expired_revoked_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_expired_revoked_sessions() TO service_role;

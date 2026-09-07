# Database

Nine tables, row-level security on all of them, an append-only audit log, and a consented + k-anonymised research schema. Plain PostgreSQL — no Supabase-only syntax — so the same migrations run on a managed Supabase project today and on self-hosted Postgres at PTCL later.

Verified by `tests/db.test.ts`, which applies these migrations to a real Postgres 18 (PGlite/WASM) and asserts the behaviour, including that RLS actually denies. **`npm run test:db`.**

---

## Applying the migrations

They are ordered and idempotent — safe to re-run.

| File | Contents |
|---|---|
| `0001_foundation.sql` | `auth.uid()` shim, enums, BP classification functions, `touch_updated_at` |
| `0002_core.sql` | `campaigns` · `patients` · `consents` · `checkins` · `readings` |
| `0003_clinical_network.sql` | `clinicians` · `patient_shares` · `referrals` · `clinician_has_access()` |
| `0004_audit.sql` | `audit_log`, immutability rules, `log_audit()`, share/consent triggers |
| `0005_rls.sql` | Roles, grants, every RLS policy |
| `0006_views.sql` | `patient_bp_summary()`, `research.*` |
| `0007_passport_code.sql` | Public `PE-XXXX` identifier for device passports |

### Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick **Singapore** or **Mumbai** — lowest latency to Pakistan.
2. SQL Editor → paste each file in numeric order → Run.
3. Copy the two keys into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server only — never NEXT_PUBLIC_
PHONE_PEPPER=<openssl rand -hex 32>
PII_ENCRYPTION_KEY=<openssl rand -hex 32>
```

4. Authentication → Providers → enable **Anonymous Sign-Ins** for the current device-first flow.

Supabase already provides `auth.uid()`, the `anon` / `authenticated` / `service_role` roles, and phone OTP. The `DO $$ ... $$` guards in `0001` and `0005` detect that and skip creating their own. The app currently uses an anonymous Auth identity per browser; phone OTP can replace that identity when account recovery is added.

### Self-hosted / psql

```bash
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$DATABASE_URL" -f db/seed.sql     # dev fixtures only
```

---

## Design decisions worth knowing

### The pepper never enters the database

Phone numbers are stored as `HMAC-SHA256(phone, pepper)` and names as AES-256-GCM ciphertext — **both computed in the application**, never in SQL. If Postgres computed the HMAC it would need the pepper, and a database compromise would then yield the hashes *and* the secret that makes them irreversible.

This is also a correction to the architecture documents, which specified a bare SHA-256 of the phone number. A Pakistani mobile has roughly 10⁹ possible values; an unpeppered digest is exhaustible in seconds and is not anonymisation.

### Categories are derived, never inserted

`category`, `urgency` and `map` are `GENERATED ALWAYS AS … STORED` columns computed by `IMMUTABLE` functions. No client can write a wrong category, and a category can never disagree with the reading it came from.

The classification therefore exists twice — TypeScript for the offline client, SQL for indexing and filtering. That is a real drift risk, managed by `tests/db.test.ts` running the same ISH boundary table plus a dense sweep of the plausible range through **both** implementations and asserting they agree.

### RLS is the security boundary, not the application

Every table has `ENABLE` **and** `FORCE ROW LEVEL SECURITY`. `FORCE` matters: without it the table owner silently bypasses every policy, which is exactly the connection a migration or a cron job runs under.

If a route handler forgets a `where patient_id = …`, the database still returns nothing. That property survives deadline pressure; careful application code does not.

Two policy details that are easy to get wrong and are tested:

- **`WITH CHECK` on the patient `UPDATE` policy.** Without it, a patient can set `auth_user_id` to someone else's — account takeover in one statement.
- **Clinicians have no `INSERT` or `UPDATE` policy anywhere.** Read-only is structural, not conventional. A GP can never alter a patient's record, which is what makes the record usable as evidence by both parties.

### Sharing is patient-controlled and zero-knowledge

The patient's device generates a random secret; only its HMAC is stored. The server cannot mint a working share URL for a patient who never issued one, so a database dump yields no usable links.

Access requires **all** of: a live share row, `revoked_at IS NULL`, `expires_at > now()`, and `clinicians.status = 'verified'`. Revocation and expiry both cut access immediately — tested.

### The audit log cannot be rewritten

`DO INSTEAD NOTHING` rules on `UPDATE` and `DELETE`. Rules fire before permission checks, so this holds for a superuser connection and for a leaked service key. Writes go only through `log_audit()` (`SECURITY DEFINER`), so no role is ever granted `INSERT` and then discovers it also has `UPDATE`.

Share access and consent changes are logged by **trigger**, not by application code — trusting a caller to remember is how audit gaps happen.

### Consent is a table, not a boolean

The architecture documents described a pharma-affiliated research dataset built from patient readings and contained **no consent model at all**. That was the largest regulatory exposure in the product.

`consents` is an append-only ledger keyed on `(patient_id, scope, policy_version, locale)`. Withdrawal is a new row. Three independent scopes — `essential`, `research`, `reminders` — because a patient must be able to accept care without accepting research. `has_consent()` returns **false** when no record exists: absence of consent is refusal, never assent.

### The research schema is gated four ways

`research.checkin_facts` applies, in the view itself so a caller cannot skip them:

1. **Consent gate** — only patients with active `research` consent appear.
2. **No identifier path** — a per-patient surrogate UUID lives in `research.patient_surrogates`; dropping that one table irreversibly severs the dataset from the patients.
3. **Generalisation** — systolic banded to 5 mmHg. Exact value + timestamp + city is close to a fingerprint. The view exposes `systolic_band` and *not* `systolic`.
4. **k-anonymity, k = 5** — campaign/period/category cells with fewer than five members are suppressed, because "the only person screened at that pharmacy in March" is identifiable no matter what was removed.

`research` is unreachable by `anon` and `authenticated`; only `service_role` can read it.

---

## Schema at a glance

```
campaigns ──┬─< patients ──┬─< consents            (append-only ledger)
            │              ├─< checkins ──< referrals
            │              ├─< readings             (the longitudinal log)
            │              └─< patient_shares >── clinicians
            └─< checkins

audit_log                    (append-only, trigger-fed)
research.patient_surrogates  (service_role only)
research.checkin_facts        (view: consented + banded + k≥5)
research.population_summary   (view: publishable rollup)
```

`checkins` and `readings` are separate on purpose. A checkin is a screening **event** carrying lifestyle answers and a Heart Score; a reading is a bare longitudinal **measurement**. Merging them would make the pilot funnel metrics uncountable.

---

## Still to do

- [ ] `patients.auth_user_id` should carry `REFERENCES auth.users(id) ON DELETE CASCADE` once running against Supabase. Omitted here so the migrations also apply to a bare Postgres with no `auth.users` table.
- [ ] Nightly `pg_cron` job to reconcile `clinicians.pmdc_number` against the published PMDC register and set `status = 'lapsed'`.
- [ ] Retention policy: audit log 24 months, readings indefinite while consent stands, orphaned drafts purged at 90 days.
- [ ] Reviewed erasure procedure. Deliberately no `DELETE` policy on `patients` — a cascade from the client would destroy the audit trail proving the erasure was lawful.
- [ ] `research` export path that requires a stated intended use and writes `log_audit('system', 'research.exported', …)`.

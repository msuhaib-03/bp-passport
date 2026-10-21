/**
 * Database contract suite — runs the real migrations against real Postgres.
 *
 * PGlite is Postgres 18 compiled to WASM, so these are not mocks: the schema,
 * the generated columns, the triggers, the rules and the RLS policies all
 * execute exactly as they will on Supabase or on the self-hosted PTCL instance.
 *
 * Three things are verified here that cannot be checked by reading SQL:
 *
 *  1. The migrations apply cleanly, in order, twice (idempotency).
 *  2. The SQL classification agrees with the TypeScript classification on every
 *     ISH boundary. That duplication is a real correctness risk and this is what
 *     stops it drifting.
 *  3. RLS actually denies access. Policies are easy to write and easy to write
 *     wrongly; the only way to know a patient cannot read another patient's
 *     readings is to sign in as one and try.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { classify, meanArterialPressure } from "@/lib/clinical/bp-classification";

const MIGRATIONS_DIR = path.resolve(__dirname, "../db/migrations");

let db: PGlite;

/** Impersonate a Supabase-authenticated user for the next statements. */
async function actAs(authUserId: string | null) {
  await db.exec("reset role");
  if (authUserId === null) {
    await db.exec(`select set_config('request.jwt.claims', '', true)`);
    await db.exec("set role anon");
    return;
  }
  await db.exec(
    `select set_config('request.jwt.claims', '${JSON.stringify({ sub: authUserId })}', false)`,
  );
  await db.exec("set role authenticated");
}

async function asOwner() {
  await db.exec("reset role");
}

beforeAll(async () => {
  db = await new PGlite();

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
}, 120_000);

afterAll(async () => {
  await db?.close();
});

// ═══════════════════════════════════════════════════════════════════════════
describe("migrations", () => {
  it("applies every migration and creates the expected tables", async () => {
    const res = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`,
    );
    const tables = res.rows.map((r) => r.table_name);
    expect(tables).toEqual([
      "audit_log",
      "campaigns",
      "checkins",
      "clinicians",
      "consents",
      "patient_shares",
      "patients",
      "readings",
      "referrals",
      "revoked_sessions",
    ]);
  });

  it("is idempotent — re-running every migration is a no-op", async () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      await expect(
        db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")),
      ).resolves.toBeDefined();
    }
  }, 120_000);

  it("enables and forces RLS on every table holding patient data", async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relname, relrowsecurity, relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by relname`,
    );
    for (const row of res.rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS enabled`).toBe(true);
      // FORCE matters: without it the table owner silently bypasses every policy.
      expect(row.relforcerowsecurity, `${row.relname} must FORCE RLS`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("clinical functions agree with the TypeScript implementation", () => {
  // The same boundary table as tests/clinical.test.ts. If either implementation
  // moves, this fails.
  const boundaries: Array<[number, number]> = [
    [119, 79], [120, 79], [119, 80], [129, 84], [130, 84], [119, 85],
    [139, 89], [140, 89], [139, 90], [159, 99], [160, 99], [139, 100],
    [135, 95], [165, 70], [200, 110], [185, 100], [150, 120], [179, 119],
  ];

  it("classifies every boundary identically in SQL and TypeScript", async () => {
    for (const [systolic, diastolic] of boundaries) {
      const res = await db.query<{ cat: string }>(
        "select bp_category($1::smallint, $2::smallint) as cat",
        [systolic, diastolic],
      );
      expect(res.rows[0]!.cat, `${systolic}/${diastolic}`).toBe(
        classify({ systolic, diastolic }),
      );
    }
  });

  it("computes MAP identically in SQL and TypeScript", async () => {
    for (const [systolic, diastolic] of boundaries) {
      const res = await db.query<{ map: string }>(
        "select bp_map($1::smallint, $2::smallint)::text as map",
        [systolic, diastolic],
      );
      expect(Number(res.rows[0]!.map), `${systolic}/${diastolic}`).toBeCloseTo(
        meanArterialPressure({ systolic, diastolic }),
        1,
      );
    }
  });

  it("agrees with TypeScript across a dense sweep of the plausible range", async () => {
    for (let s = 95; s <= 220; s += 7) {
      for (let d = 55; d < s && d <= 140; d += 5) {
        const res = await db.query<{ cat: string }>(
          "select bp_category($1::smallint, $2::smallint) as cat",
          [s, d],
        );
        expect(res.rows[0]!.cat, `${s}/${d}`).toBe(classify({ systolic: s, diastolic: d }));
      }
    }
  });

  it("flags a hypertensive crisis at the ACC/AHA threshold", async () => {
    const cases: Array<[number, number, boolean]> = [
      [180, 90, true], [150, 120, true], [179, 119, false], [140, 90, false],
    ];
    for (const [s, d, expected] of cases) {
      const res = await db.query<{ crisis: boolean }>(
        "select bp_is_crisis($1::smallint, $2::smallint) as crisis", [s, d],
      );
      expect(res.rows[0]!.crisis, `${s}/${d}`).toBe(expected);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("generated columns and constraints", () => {
  const PATIENT_AUTH = "11111111-1111-4111-8111-111111111111";
  let patientId: string;

  beforeAll(async () => {
    await asOwner();
    await db.exec(`
      insert into campaigns (code, name, city, type)
      values ('lums-spring', 'LUMS Spring Camp', 'Lahore', 'campus')
      on conflict (code) do nothing;
    `);
    const res = await db.query<{ id: string }>(
      `insert into patients (auth_user_id, campaign_id)
       values ($1, (select id from campaigns where code = 'lums-spring'))
       returning id`,
      [PATIENT_AUTH],
    );
    patientId = res.rows[0]!.id;
  });

  it("derives category, urgency and MAP rather than accepting them", async () => {
    const res = await db.query<{ category: string; urgency: string; map: string }>(
      `insert into readings (patient_id, systolic, diastolic)
       values ($1, 148, 94)
       returning category, urgency, map::text`,
      [patientId],
    );
    expect(res.rows[0]!.category).toBe("grade_1");
    expect(res.rows[0]!.urgency).toBe("soon");
    expect(Number(res.rows[0]!.map)).toBeCloseTo(112, 0);
  });

  it("refuses a transposed reading", async () => {
    await expect(
      db.query(
        "insert into readings (patient_id, systolic, diastolic) values ($1, 80, 120)",
        [patientId],
      ),
    ).rejects.toThrow();
  });

  it("refuses an out-of-range reading", async () => {
    await expect(
      db.query(
        "insert into readings (patient_id, systolic, diastolic) values ($1, 400, 90)",
        [patientId],
      ),
    ).rejects.toThrow();
  });

  it("refuses a checkin with only one half of a reading", async () => {
    await expect(
      db.query(
        `insert into checkins
           (patient_id, systolic, sleep, sodium, stress, stimulants, activity, heart_score)
         values ($1, 140, 'poor','poor','poor','poor','poor', 30)`,
        [patientId],
      ),
    ).rejects.toThrow();
  });

  it("refuses a heart score outside 5..100", async () => {
    await expect(
      db.query(
        `insert into checkins
           (patient_id, sleep, sodium, stress, stimulants, activity, heart_score)
         values ($1, 'good','good','good','good','good', 101)`,
        [patientId],
      ),
    ).rejects.toThrow();
  });

  it("refuses a malformed campaign code", async () => {
    await expect(
      db.query(
        "insert into campaigns (code, name, city, type) values ('Bad Code!', 'x', 'Karachi', 'clinic')",
      ),
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("consent ledger", () => {
  const AUTH = "22222222-2222-4222-8222-222222222222";
  let patientId: string;

  beforeAll(async () => {
    await asOwner();
    const res = await db.query<{ id: string }>(
      "insert into patients (auth_user_id) values ($1) returning id",
      [AUTH],
    );
    patientId = res.rows[0]!.id;
  });

  it("treats absence of consent as refusal", async () => {
    await asOwner();
    const res = await db.query<{ ok: boolean }>(
      "select has_consent($1, 'research') as ok", [patientId],
    );
    expect(res.rows[0]!.ok).toBe(false);
  });

  it("honours the most recent record per scope", async () => {
    await asOwner();
    await db.query(
      `insert into consents (patient_id, scope, granted, policy_version, locale)
       values ($1, 'research', true, 'v1', 'en')`,
      [patientId],
    );
    let res = await db.query<{ ok: boolean }>(
      "select has_consent($1, 'research') as ok", [patientId],
    );
    expect(res.rows[0]!.ok).toBe(true);

    // Withdrawal is a new row, never an update.
    await db.query(
      `insert into consents (patient_id, scope, granted, policy_version, locale)
       values ($1, 'research', false, 'v1', 'en')`,
      [patientId],
    );
    res = await db.query<{ ok: boolean }>(
      "select has_consent($1, 'research') as ok", [patientId],
    );
    expect(res.rows[0]!.ok).toBe(false);
  });

  it("keeps scopes independent — care consent is not research consent", async () => {
    await asOwner();
    await db.query(
      `insert into consents (patient_id, scope, granted, policy_version, locale)
       values ($1, 'essential', true, 'v1', 'en')`,
      [patientId],
    );
    const essential = await db.query<{ ok: boolean }>(
      "select has_consent($1, 'essential') as ok", [patientId],
    );
    const research = await db.query<{ ok: boolean }>(
      "select has_consent($1, 'research') as ok", [patientId],
    );
    expect(essential.rows[0]!.ok).toBe(true);
    expect(research.rows[0]!.ok).toBe(false);
  });

  it("writes an audit line for every consent change", async () => {
    await asOwner();
    const res = await db.query<{ n: string }>(
      `select count(*) as n from audit_log
        where action in ('consent.granted', 'consent.withdrawn')`,
    );
    expect(Number(res.rows[0]!.n)).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("audit log is append-only", () => {
  it("silently discards UPDATE and DELETE", async () => {
    await asOwner();
    await db.query("select log_audit('system', 'test.event', 'thing', null, '{}'::jsonb)");
    const before = await db.query<{ n: string }>("select count(*) as n from audit_log");

    // The rules are DO INSTEAD NOTHING, so these succeed but change nothing.
    await db.exec("update audit_log set action = 'tampered.event'");
    await db.exec("delete from audit_log");

    const after = await db.query<{ n: string }>("select count(*) as n from audit_log");
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);

    const tampered = await db.query<{ n: string }>(
      "select count(*) as n from audit_log where action = 'tampered.event'",
    );
    expect(Number(tampered.rows[0]!.n)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Row Level Security actually denies", () => {
  const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const DR_AMINAH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const DR_UNVERIFIED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  let alice: string;
  let bob: string;
  let aminah: string;

  beforeAll(async () => {
    await asOwner();
    const a = await db.query<{ id: string }>(
      "insert into patients (auth_user_id) values ($1) returning id", [ALICE]);
    alice = a.rows[0]!.id;
    const b = await db.query<{ id: string }>(
      "insert into patients (auth_user_id) values ($1) returning id", [BOB]);
    bob = b.rows[0]!.id;

    await db.query(
      `insert into readings (patient_id, systolic, diastolic) values
         ($1, 150, 95), ($1, 146, 92), ($1, 143, 90), ($1, 141, 88)`,
      [alice],
    );
    await db.query(
      "insert into readings (patient_id, systolic, diastolic) values ($1, 118, 76)",
      [bob],
    );

    const c = await db.query<{ id: string }>(
      `insert into clinicians
         (auth_user_id, pmdc_number, name_enc, clinic_name, city, status, verified_at)
       values ($1, 'PMDC-40021', '\\x00'::bytea, 'DHA Family Clinic', 'Karachi',
               'verified', now())
       returning id`,
      [DR_AMINAH],
    );
    aminah = c.rows[0]!.id;

    await db.query(
      `insert into clinicians
         (auth_user_id, pmdc_number, name_enc, clinic_name, city, status)
       values ($1, 'PMDC-99999', '\\x00'::bytea, 'Unverified Clinic', 'Lahore', 'pending')`,
      [DR_UNVERIFIED],
    );
  });

  it("lets a patient read their own readings", async () => {
    await actAs(ALICE);
    const res = await db.query<{ n: string }>("select count(*) as n from readings");
    expect(Number(res.rows[0]!.n)).toBe(4);
  });

  it("hides one patient's readings from another patient", async () => {
    await actAs(BOB);
    const res = await db.query<{ n: string }>("select count(*) as n from readings");
    // Bob sees only his own single reading — never Alice's four.
    expect(Number(res.rows[0]!.n)).toBe(1);
  });

  it("hides everything from an unauthenticated visitor", async () => {
    await actAs(null);
    await expect(db.query("select count(*) from readings")).rejects.toThrow();
  });

  it("still exposes active campaigns to an unauthenticated visitor", async () => {
    // The QR landing page must render before anyone signs in.
    await actAs(null);
    const res = await db.query<{ n: string }>("select count(*) as n from campaigns");
    expect(Number(res.rows[0]!.n)).toBeGreaterThanOrEqual(1);
  });

  it("stops a patient from writing a reading onto someone else's record", async () => {
    await actAs(BOB);
    await expect(
      db.query(
        "insert into readings (patient_id, systolic, diastolic) values ($1, 200, 130)",
        [alice],
      ),
    ).rejects.toThrow();
  });

  it("stops a patient from reassigning their row to another auth user", async () => {
    // Without WITH CHECK on the UPDATE policy this is account takeover.
    await actAs(BOB);
    await db.query("update patients set auth_user_id = $1", [ALICE]).catch(() => {});
    await asOwner();
    const res = await db.query<{ n: string }>(
      "select count(*) as n from patients where id = $1 and auth_user_id = $2",
      [bob, BOB],
    );
    expect(Number(res.rows[0]!.n)).toBe(1);
  });

  it("gives a clinician no access before a share exists", async () => {
    await actAs(DR_AMINAH);
    const res = await db.query<{ n: string }>("select count(*) as n from readings");
    expect(Number(res.rows[0]!.n)).toBe(0);
  });

  it("grants a clinician read access through a live share", async () => {
    await asOwner();
    await db.query(
      `insert into patient_shares (patient_id, clinician_id, token_hmac, expires_at)
       values ($1, $2, repeat('a', 64), now() + interval '30 days')`,
      [alice, aminah],
    );
    await actAs(DR_AMINAH);
    const res = await db.query<{ n: string }>("select count(*) as n from readings");
    expect(Number(res.rows[0]!.n)).toBe(4);
  });

  it("keeps the clinician read-only — no write path exists at all", async () => {
    await actAs(DR_AMINAH);
    await expect(
      db.query(
        "insert into readings (patient_id, systolic, diastolic) values ($1, 120, 80)",
        [alice],
      ),
    ).rejects.toThrow();
    await expect(db.query("update readings set systolic = 999")).rejects.toThrow();
  });

  it("revokes access the instant the patient revokes the share", async () => {
    await asOwner();
    await db.query(
      "update patient_shares set revoked_at = now() where patient_id = $1", [alice]);
    await actAs(DR_AMINAH);
    const res = await db.query<{ n: string }>("select count(*) as n from readings");
    expect(Number(res.rows[0]!.n)).toBe(0);
  });

  it("revokes access when the share expires", async () => {
    await asOwner();
    await db.query("delete from patient_shares where patient_id = $1", [alice]);
    await db.query(
      `insert into patient_shares (patient_id, clinician_id, token_hmac, expires_at, created_at)
       values ($1, $2, repeat('b', 64), now() - interval '1 day',
               now() - interval '31 days')`,
      [alice, aminah],
    );
    await actAs(DR_AMINAH);
    const res = await db.query<{ n: string }>("select count(*) as n from readings");
    expect(Number(res.rows[0]!.n)).toBe(0);
  });

  it("denies an unverified clinician even with a valid share", async () => {
    // A lapsed or pending PMDC registration must lose clinical access.
    await asOwner();
    await db.query("delete from patient_shares where patient_id = $1", [alice]);
    const unverified = await db.query<{ id: string }>(
      "select id from clinicians where pmdc_number = 'PMDC-99999'");
    await db.query(
      `insert into patient_shares (patient_id, clinician_id, token_hmac, expires_at)
       values ($1, $2, repeat('c', 64), now() + interval '30 days')`,
      [alice, unverified.rows[0]!.id],
    );
    await actAs(DR_UNVERIFIED);
    const res = await db.query<{ n: string }>("select count(*) as n from readings");
    expect(Number(res.rows[0]!.n)).toBe(0);
  });

  it("prevents a clinician from self-verifying", async () => {
    await actAs(DR_UNVERIFIED);
    await db.query("update clinicians set status = 'verified'").catch(() => {});
    await asOwner();
    const res = await db.query<{ status: string }>(
      "select status from clinicians where pmdc_number = 'PMDC-99999'");
    expect(res.rows[0]!.status).toBe("pending");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("clinician summary", () => {
  const AUTH = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  let patientId: string;

  beforeAll(async () => {
    await asOwner();
    const p = await db.query<{ id: string }>(
      "insert into patients (auth_user_id) values ($1) returning id", [AUTH]);
    patientId = p.rows[0]!.id;
    await db.query(
      `insert into readings (patient_id, systolic, diastolic, taken_at_time, took_meds)
       values
         ($1, 152, 96, 'morning', true),
         ($1, 148, 94, 'morning', true),
         ($1, 138, 86, 'evening', true),
         ($1, 134, 84, 'evening', false)`,
      [patientId],
    );
  });

  it("returns mean ± SD, not the latest reading", async () => {
    await asOwner();
    const res = await db.query<{
      reading_count: string; mean_systolic: string; sd_systolic: string;
      mean_category: string; morning_mean_systolic: string;
      evening_mean_systolic: string; adherence_rate: string;
    }>("select * from patient_bp_summary($1, 14)", [patientId]);

    const row = res.rows[0]!;
    expect(Number(row.reading_count)).toBe(4);
    expect(Number(row.mean_systolic)).toBeCloseTo(143, 0);
    expect(Number(row.sd_systolic)).toBeGreaterThan(0);
    // Category of the mean (143/90) is grade_1.
    expect(row.mean_category).toBe("grade_1");
    // Morning surge is visible and separated, which is the point of the split.
    expect(Number(row.morning_mean_systolic)).toBeGreaterThan(
      Number(row.evening_mean_systolic),
    );
    expect(Number(row.adherence_rate)).toBeCloseTo(0.75, 2);
  });

  it("returns no row when the window is empty", async () => {
    await asOwner();
    const res = await db.query("select * from patient_bp_summary($1, 14)", [
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
    ]);
    expect(res.rows).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("reliable sync and patient-controlled sharing", () => {
  const PATIENT_AUTH = "77777777-7777-4777-8777-777777777777";
  const CLINICIAN_AUTH = "88888888-8888-4888-8888-888888888888";
  const AUDIT_EVENT = "99999999-9999-4999-8999-999999999999";
  const READING_EVENT = "12121212-1212-4121-8121-121212121212";
  let patientId: string;

  it("refuses clinical persistence until essential storage consent exists", async () => {
    const withoutConsent = "67676767-6767-4676-8676-676767676767";
    await asOwner();
    const patient = await db.query<{ id: string }>(
      "insert into patients (auth_user_id, passport_code) values ($1, 'PE-NCNS') returning id",
      [withoutConsent],
    );
    await actAs(withoutConsent);
    await expect(
      db.query(
        "insert into readings (patient_id, systolic, diastolic) values ($1, 130, 85)",
        [patient.rows[0]!.id],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `select record_reading(
          '34343434-3434-4343-8343-343434343434', 130::smallint, 85::smallint,
          now(), 'random'::reading_time, null, null, null
        )`,
      ),
    ).rejects.toThrow(/Storage consent required/);
  });

  it("makes passport and reading retries idempotent", async () => {
    await actAs(PATIENT_AUTH);
    const sql = `select * from sync_passport(
      'PE-TST2', '2026-10-20T10:00:00Z'::timestamptz, null::uuid,
      '{"sleep":"good","sodium":"fair","stress":"good","stimulants":"fair","activity":"good"}'::jsonb,
      '{"systolic":132,"diastolic":86,"at":"2026-10-20T10:00:00Z","takenAtTime":"morning"}'::jsonb,
      82::smallint, 'good'::lifestyle_level, $1::uuid,
      true, 'v1', 'en'
    )`;
    const first = await db.query<{ patient_id: string; created: boolean }>(sql, [AUDIT_EVENT]);
    const retry = await db.query<{ patient_id: string; created: boolean }>(sql, [AUDIT_EVENT]);
    patientId = first.rows[0]!.patient_id;

    expect(first.rows[0]!.created).toBe(true);
    expect(retry.rows[0]!.created).toBe(false);
    expect(retry.rows[0]!.patient_id).toBe(patientId);

    const firstReading = await db.query<{ id: string }>(
      `select record_reading(
        $1::uuid, 128::smallint, 82::smallint,
        '2026-10-21T07:00:00Z'::timestamptz, 'morning'::reading_time,
        true, true, true
      ) as id`,
      [READING_EVENT],
    );
    const retriedReading = await db.query<{ id: string }>(
      `select record_reading(
        $1::uuid, 128::smallint, 82::smallint,
        '2026-10-21T07:00:00Z'::timestamptz, 'morning'::reading_time,
        true, true, true
      ) as id`,
      [READING_EVENT],
    );
    expect(retriedReading.rows[0]!.id).toBe(firstReading.rows[0]!.id);

    const counts = await db.query<{ checkins: string; readings: string }>(
      `select
        (select count(*) from checkins where patient_id = $1) as checkins,
        (select count(*) from readings where patient_id = $1) as readings`,
      [patientId],
    );
    expect(Number(counts.rows[0]!.checkins)).toBe(1);
    expect(Number(counts.rows[0]!.readings)).toBe(2);
  });

  it("resolves a verified clinician without exposing the clinician registry", async () => {
    await asOwner();
    await db.query(
      `insert into clinicians
        (auth_user_id, pmdc_number, name_enc, clinic_name, city, status, verified_at)
       values ($1, 'PMDC-NEW01', '\\x00'::bytea, 'North Clinic', 'Islamabad',
               'verified', now())`,
      [CLINICIAN_AUTH],
    );

    await actAs(PATIENT_AUTH);
    const share = await db.query<{ share_id: string; pmdc_number: string }>(
      `select * from create_patient_share(
        repeat('d', 64), 'pmdc-new01', now() + interval '7 days'
      )`,
    );
    expect(share.rows[0]!.pmdc_number).toBe("PMDC-NEW01");

    const patientList = await db.query<{ share_id: string }>("select share_id from patient_share_list()");
    expect(patientList.rows.map((row) => row.share_id)).toContain(share.rows[0]!.share_id);

    await actAs(CLINICIAN_AUTH);
    const clinicianList = await db.query<{ patient_id: string }>(
      "select patient_id from clinician_patient_share_list()",
    );
    expect(clinicianList.rows).toEqual([{ patient_id: patientId }]);

    const opened = await db.query<{ patient_id: string }>(
      "select patient_id from open_patient_share_by_patient($1)",
      [patientId],
    );
    expect(opened.rows).toEqual([{ patient_id: patientId }]);

    const readings = await db.query<{ n: string }>("select count(*) as n from readings");
    expect(Number(readings.rows[0]!.n)).toBe(2);
  });

  it("restricts clinician approval to the service role and writes an audit event", async () => {
    await asOwner();
    const pending = await db.query<{ id: string }>(
      `insert into clinicians
        (auth_user_id, pmdc_number, name_enc, clinic_name, city, status)
       values ('56565656-5656-4565-8565-565656565656', 'PMDC-REVIEW',
               '\\x00'::bytea, 'Review Clinic', 'Lahore', 'pending')
       returning id`,
    );

    await actAs(PATIENT_AUTH);
    await expect(
      db.query("select * from review_clinician($1, 'verified')", [pending.rows[0]!.id]),
    ).rejects.toThrow();

    await asOwner();
    await db.exec("set role service_role");
    const reviewed = await db.query<{ status: string; verified_at: string | null }>(
      "select status, verified_at from review_clinician($1, 'verified')",
      [pending.rows[0]!.id],
    );
    expect(reviewed.rows[0]!.status).toBe("verified");
    expect(reviewed.rows[0]!.verified_at).not.toBeNull();

    await asOwner();
    const audit = await db.query<{ n: string }>(
      `select count(*) as n from audit_log
        where action = 'clinician.verified' and resource_id = $1`,
      [pending.rows[0]!.id],
    );
    expect(Number(audit.rows[0]!.n)).toBe(1);
  });
});

describe("research views protect the dataset", () => {
  it("bands systolic values to 5 mmHg", async () => {
    await asOwner();
    const res = await db.query<{ b: string }>(
      "select research.systolic_band(128::smallint) as b");
    expect(res.rows[0]!.b).toBe("125-129");
  });

  it("excludes patients who have not consented to research", async () => {
    await asOwner();
    const p = await db.query<{ id: string }>(
      "insert into patients (auth_user_id) values (gen_random_uuid()) returning id");
    const pid = p.rows[0]!.id;
    await db.query(
      `insert into checkins
         (patient_id, systolic, diastolic, sleep, sodium, stress, stimulants,
          activity, heart_score)
       values ($1, 150, 95, 'poor','poor','poor','poor','poor', 28)`,
      [pid],
    );
    const res = await db.query<{ n: string }>(
      "select count(*) as n from research.checkin_facts");
    // No consent anywhere in the fixtures, so the view must be empty.
    expect(Number(res.rows[0]!.n)).toBe(0);
  });

  it("suppresses cells below k = 5 even with consent", async () => {
    await asOwner();
    await db.exec(`
      insert into campaigns (code, name, city, type)
      values ('k-test', 'K Test', 'Karachi', 'pharmacy')
      on conflict (code) do nothing;
    `);
    // Four consented, identical-cell screenings — one short of k = 5.
    for (let i = 0; i < 4; i += 1) {
      const p = await db.query<{ id: string }>(
        "insert into patients (auth_user_id) values (gen_random_uuid()) returning id");
      const pid = p.rows[0]!.id;
      await db.query(
        `insert into consents (patient_id, scope, granted, policy_version, locale)
         values ($1, 'research', true, 'v1', 'en')`, [pid]);
      await db.query(
        `insert into checkins
           (patient_id, campaign_id, systolic, diastolic, sleep, sodium, stress,
            stimulants, activity, heart_score)
         values ($1, (select id from campaigns where code = 'k-test'),
                 150, 95, 'poor','poor','poor','poor','poor', 28)`,
        [pid],
      );
    }
    let res = await db.query<{ n: string }>(
      "select count(*) as n from research.checkin_facts");
    expect(Number(res.rows[0]!.n)).toBe(0);

    // The fifth member makes the cell releasable.
    const p = await db.query<{ id: string }>(
      "insert into patients (auth_user_id) values (gen_random_uuid()) returning id");
    const pid = p.rows[0]!.id;
    await db.query(
      `insert into consents (patient_id, scope, granted, policy_version, locale)
       values ($1, 'research', true, 'v1', 'en')`, [pid]);
    await db.query(
      `insert into checkins
         (patient_id, campaign_id, systolic, diastolic, sleep, sodium, stress,
          stimulants, activity, heart_score)
       values ($1, (select id from campaigns where code = 'k-test'),
               150, 95, 'poor','poor','poor','poor','poor', 28)`,
      [pid],
    );
    res = await db.query<{ n: string }>(
      "select count(*) as n from research.checkin_facts");
    expect(Number(res.rows[0]!.n)).toBe(5);
  });

  it("exposes no column that joins back to a patient", async () => {
    await asOwner();
    const res = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'research' and table_name = 'checkin_facts'`,
    );
    const columns = res.rows.map((r) => r.column_name);
    expect(columns).not.toContain("patient_id");
    expect(columns).not.toContain("phone_hmac");
    expect(columns).not.toContain("display_name_enc");
    expect(columns).toContain("research_id");
    // Exact systolic must not leak alongside the band.
    expect(columns).not.toContain("systolic");
    expect(columns).toContain("systolic_band");
  });

  it("keeps the research schema unreachable by app roles", async () => {
    await actAs("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await expect(
      db.query("select count(*) from research.checkin_facts"),
    ).rejects.toThrow();
  });
});

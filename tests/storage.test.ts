import { describe, expect, it } from "vitest";

import {
  applyCompletedAudit,
  mergePassports,
  type AuditDraft,
  type Passport,
} from "@/lib/storage";

const answers = {
  sleep: "good",
  sodium: "fair",
  stress: "good",
  stimulants: "fair",
  activity: "good",
} as const;

function passport(overrides: Partial<Passport> = {}): Passport {
  return {
    id: "PE-TST2",
    createdAt: "2026-01-01T00:00:00.000Z",
    answers,
    lastAuditId: "11111111-1111-4111-8111-111111111111",
    lastAuditAt: "2026-01-01T00:00:00.000Z",
    readings: [],
    ...overrides,
  };
}

describe("passport synchronization", () => {
  it("keeps the newer cloud audit when a device has a stale local copy", () => {
    const cloud = passport({
      answers: { ...answers, sleep: "poor" },
      lastAuditId: "22222222-2222-4222-8222-222222222222",
      lastAuditAt: "2026-03-01T00:00:00.000Z",
    });
    const local = passport({
      answers: { ...answers, sleep: "fair" },
      lastAuditAt: "2026-02-01T00:00:00.000Z",
    });

    const merged = mergePassports(cloud, local);
    expect(merged.answers.sleep).toBe("poor");
    expect(merged.lastAuditId).toBe(cloud.lastAuditId);
  });

  it("keeps a newer completed local audit ready for upload", () => {
    const cloud = passport();
    const local = passport({
      answers: { ...answers, sodium: "poor" },
      lastAuditId: "22222222-2222-4222-8222-222222222222",
      lastAuditAt: "2026-03-01T00:00:00.000Z",
    });

    const merged = mergePassports(cloud, local);
    expect(merged.answers.sodium).toBe("poor");
    expect(merged.lastAuditId).toBe(local.lastAuditId);
  });

  it("applies a completed audit exactly once", () => {
    const draft: AuditDraft = {
      auditId: "22222222-2222-4222-8222-222222222222",
      completedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      answers: { ...answers, activity: "poor" },
      reading: { systolic: 142, diastolic: 92 },
    };

    const first = applyCompletedAudit(passport(), draft);
    const retry = applyCompletedAudit(first.passport, draft);
    expect(first.applied).toBe(true);
    expect(first.passport.readings).toHaveLength(1);
    expect(first.passport.lastAuditAt).toBe(draft.completedAt);
    expect(retry.applied).toBe(false);
    expect(retry.passport.readings).toHaveLength(1);
  });
});

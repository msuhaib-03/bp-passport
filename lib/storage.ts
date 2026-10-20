/**
 * Client-side persistence.
 *
 * Local-first posture: a 60-second kiosk audit needs no account or round trip.
 * When the user grants storage consent, the Supabase adapter merges this local
 * record with its cloud copy using stable event IDs; browser storage remains
 * the offline fallback.
 *
 * Two stores, deliberately:
 *   · sessionStorage — the in-progress audit. Abandoned attempts should not
 *     linger on a shared kiosk device.
 *   · localStorage   — the saved Passport, only after explicit user action.
 *
 * All access is guarded: Safari private mode throws on write, and a storage
 * exception must never take down a clinical screen.
 */

import type { LifestyleAnswers } from "./clinical/heart-score";
import type { BpReading } from "./clinical/bp-classification";

const DRAFT_KEY = "bpp.audit.draft.v1";
const PASSPORT_KEY = "bpp.passport.v1";

export interface AuditDraft {
  /** Stable client event ID used to make cloud retries idempotent. */
  auditId?: string;
  answers: Partial<LifestyleAnswers>;
  lastCheck?: "good" | "fair" | "poor";
  reading?: BpReading | null;
  /** ?c= campaign code from the QR link, for attribution. */
  campaign?: string;
  /** Set only after all seven audit steps have been completed. */
  completedAt?: string;
  updatedAt: string;
}

export interface LoggedReading extends BpReading {
  /** Stable client event ID. Older locally saved readings are upgraded on read. */
  clientId: string;
  /** Database identifier, present after a cloud fetch. */
  serverId?: string;
  /** ISO timestamp. */
  at: string;
  takenAtTime?: "morning" | "evening" | "random";
  tookMeds?: boolean;
  lowSalt?: boolean;
  walked?: boolean;
}

export interface Passport {
  id: string;
  createdAt: string;
  /** Auth identity this local copy was last synchronized with. */
  cloudOwnerId?: string;
  displayName?: string;
  answers: LifestyleAnswers;
  lastCheck?: "good" | "fair" | "poor";
  /** The most recent audit already applied to this passport. */
  lastAuditId?: string;
  /** Completion time used to resolve cross-device audit conflicts. */
  lastAuditAt?: string;
  readings: LoggedReading[];
  campaign?: string;
}

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(store: Storage | undefined, key: string, value: string): boolean {
  try {
    store?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const session = () => (typeof window === "undefined" ? undefined : window.sessionStorage);
const local = () => (typeof window === "undefined" ? undefined : window.localStorage);

// ── Draft ──────────────────────────────────────────────────────────────────

export function readDraft(): AuditDraft | null {
  const raw = safeGet(session(), DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditDraft;
  } catch {
    return null;
  }
}

export function writeDraft(draft: Omit<AuditDraft, "updatedAt">): boolean {
  return safeSet(
    session(),
    DRAFT_KEY,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
  );
}

export function clearDraft(): void {
  try {
    session()?.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clean up */
  }
}

// ── Passport ───────────────────────────────────────────────────────────────

/**
 * Human-readable identifier shown on the Passport card.
 * Format `PE-XXXX` — short enough to read aloud to a receptionist.
 */
function generatePassportId(): string {
  // Excludes I, O, 0 and 1: they are indistinguishable when read aloud or
  // written by hand, which matters when a patient dictates this at a clinic desk.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `PE-${code}`;
}

export function readPassport(): Passport | null {
  const raw = safeGet(local(), PASSPORT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Passport;
    if (!Array.isArray(parsed.readings)) return null;

    // Passport records created before cloud idempotency shipped have no event
    // IDs. Upgrade them once on read so subsequent retries remain safe.
    let changed = false;
    const readings = parsed.readings.map((reading) => {
      if (reading.clientId) return reading;
      changed = true;
      return { ...reading, clientId: crypto.randomUUID() };
    });
    const upgraded = { ...parsed, readings };
    if (changed) safeSet(local(), PASSPORT_KEY, JSON.stringify(upgraded));
    return upgraded;
  } catch {
    return null;
  }
}

export function createPassport(input: {
  answers: LifestyleAnswers;
  reading?: BpReading | null;
  campaign?: string;
  displayName?: string;
  lastCheck?: "good" | "fair" | "poor";
  auditId?: string;
  createdAt?: string;
}): Passport {
  const now = input.createdAt ?? new Date().toISOString();
  const auditId = input.auditId ?? crypto.randomUUID();
  const passport: Passport = {
    id: generatePassportId(),
    createdAt: now,
    displayName: input.displayName,
    answers: input.answers,
    lastCheck: input.lastCheck,
    lastAuditId: auditId,
    lastAuditAt: now,
    campaign: input.campaign,
    readings: input.reading
      ? [{ ...input.reading, clientId: auditId, at: now, takenAtTime: "random" }]
      : [],
  };
  savePassport(passport);
  return passport;
}

export function savePassport(passport: Passport): boolean {
  return safeSet(local(), PASSPORT_KEY, JSON.stringify(passport));
}

export function appendReading(
  reading: Omit<LoggedReading, "clientId"> & { clientId?: string },
): Passport | null {
  const passport = readPassport();
  if (!passport) return null;
  const nextReading: LoggedReading = {
    ...reading,
    clientId: reading.clientId ?? crypto.randomUUID(),
  };
  const updated: Passport = {
    ...passport,
    readings: [...passport.readings, nextReading],
  };
  savePassport(updated);
  return updated;
}

/**
 * Apply a completed audit to an existing passport exactly once. This is what
 * makes retaking the Heart Audit update the same longitudinal record instead of
 * being ignored after the first passport has been created.
 */
export function applyCompletedAudit(
  passport: Passport,
  draft: AuditDraft,
): { passport: Passport; applied: boolean } {
  const answers = draft.answers as LifestyleAnswers;
  if (!draft.auditId || !draft.completedAt || passport.lastAuditId === draft.auditId) {
    return { passport, applied: false };
  }

  const readings = draft.reading
    ? [
        ...passport.readings.filter((reading) => reading.clientId !== draft.auditId),
        {
          ...draft.reading,
          clientId: draft.auditId,
          at: draft.completedAt,
          takenAtTime: "random" as const,
        },
      ]
    : passport.readings;

  const updated: Passport = {
    ...passport,
    answers,
    lastCheck: draft.lastCheck,
    lastAuditId: draft.auditId,
    lastAuditAt: draft.completedAt,
    campaign: draft.campaign ?? passport.campaign,
    readings,
  };
  savePassport(updated);
  return { passport: updated, applied: true };
}

export function mergePassports(cloud: Passport, localPassport: Passport): Passport {
  const readings = [...cloud.readings];
  for (const localReading of localPassport.readings) {
    const duplicate = readings.some(
      (cloudReading) =>
        cloudReading.clientId === localReading.clientId ||
        (cloudReading.systolic === localReading.systolic &&
          cloudReading.diastolic === localReading.diastolic &&
          cloudReading.at === localReading.at),
    );
    if (!duplicate) readings.push(localReading);
  }
  readings.sort((a, b) => a.at.localeCompare(b.at));

  const localAuditTime = Date.parse(localPassport.lastAuditAt ?? "");
  const cloudAuditTime = Date.parse(cloud.lastAuditAt ?? "");
  const localIsNewerAudit = Boolean(
    localPassport.lastAuditId
      && localPassport.lastAuditId !== cloud.lastAuditId
      && Number.isFinite(localAuditTime)
      && (!Number.isFinite(cloudAuditTime) || localAuditTime > cloudAuditTime),
  );
  const merged: Passport = {
    ...cloud,
    answers: localIsNewerAudit ? localPassport.answers : cloud.answers,
    lastCheck: localIsNewerAudit ? localPassport.lastCheck : cloud.lastCheck,
    lastAuditId: localIsNewerAudit
      ? localPassport.lastAuditId
      : cloud.lastAuditId ?? localPassport.lastAuditId,
    lastAuditAt: localIsNewerAudit
      ? localPassport.lastAuditAt
      : cloud.lastAuditAt ?? localPassport.lastAuditAt,
    campaign: localPassport.campaign ?? cloud.campaign,
    readings,
  };
  savePassport(merged);
  return merged;
}

/**
 * Consecutive-day logging streak, with a 48-hour grace window.
 *
 * Strict streaks punish a single missed day and are a documented cause of
 * abandonment in self-monitoring apps: the user breaks the chain once and stops
 * entirely. One day of slack keeps the habit alive without making the number
 * meaningless.
 */
export function currentStreak(readings: LoggedReading[], now = new Date()): number {
  if (readings.length === 0) return 0;

  const dayOf = (iso: string) => {
    const d = new Date(iso);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };

  const days = [...new Set(readings.map((r) => dayOf(r.at)))].sort((a, b) => b - a);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000;

  // Streak is already broken if the most recent log is more than a day old.
  if (days[0]! < today - 1) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i += 1) {
    const gap = days[i - 1]! - days[i]!;
    if (gap <= 2) streak += 1; // 1 = consecutive, 2 = one day of grace
    else break;
  }
  return streak;
}

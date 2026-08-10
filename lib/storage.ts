/**
 * Client-side persistence.
 *
 * MVP posture (Horizon 1): the browser is the system of record. No account, no
 * server round-trip, nothing to sign up for — which is what makes a 60-second
 * kiosk scan possible at all. Every function is written behind a narrow
 * interface so that swapping the implementation for Supabase in V1.0 touches
 * this file and nothing else.
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
  answers: Partial<LifestyleAnswers>;
  lastCheck?: "good" | "fair" | "poor";
  reading?: BpReading | null;
  /** ?c= campaign code from the QR link, for attribution. */
  campaign?: string;
  updatedAt: string;
}

export interface LoggedReading extends BpReading {
  /** ISO timestamp. */
  at: string;
  tookMeds?: boolean;
  lowSalt?: boolean;
  walked?: boolean;
}

export interface Passport {
  id: string;
  createdAt: string;
  displayName?: string;
  answers: LifestyleAnswers;
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
    return Array.isArray(parsed.readings) ? parsed : null;
  } catch {
    return null;
  }
}

export function createPassport(input: {
  answers: LifestyleAnswers;
  reading?: BpReading | null;
  campaign?: string;
  displayName?: string;
}): Passport {
  const now = new Date().toISOString();
  const passport: Passport = {
    id: generatePassportId(),
    createdAt: now,
    displayName: input.displayName,
    answers: input.answers,
    campaign: input.campaign,
    readings: input.reading ? [{ ...input.reading, at: now }] : [],
  };
  safeSet(local(), PASSPORT_KEY, JSON.stringify(passport));
  return passport;
}

export function appendReading(reading: LoggedReading): Passport | null {
  const passport = readPassport();
  if (!passport) return null;
  const updated: Passport = { ...passport, readings: [...passport.readings, reading] };
  safeSet(local(), PASSPORT_KEY, JSON.stringify(updated));
  return updated;
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

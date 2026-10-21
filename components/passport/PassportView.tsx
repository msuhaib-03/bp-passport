"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Cloud, Flame, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import { BpEntry } from "@/components/audit/BpEntry";
import { PrivacyControls } from "@/components/passport/PrivacyControls";
import { SharePanel } from "@/components/passport/SharePanel";
import { WhatsAppShareButton } from "@/components/passport/WhatsAppShareButton";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";
import { Link } from "@/lib/i18n/navigation";
import {
  appendReading,
  applyCompletedAudit,
  createPassport,
  currentStreak,
  mergePassports,
  readDraft,
  readPassport,
  savePassport,
  type Passport,
} from "@/lib/storage";
import {
  fetchCloudPassport,
  isCloudPersistenceConfigured,
  syncMissingReadings,
  syncPassport,
  syncReading,
} from "@/lib/supabase/persistence";
import { fetchConsents, recordConsent } from "@/lib/supabase/patient";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { classify, summariseSeries, type BpReading } from "@/lib/clinical/bp-classification";
import { CATEGORY_VISUAL } from "@/lib/clinical/presentation";
import type { LifestyleAnswers } from "@/lib/clinical/heart-score";

/**
 * BP Passport dashboard (SCR-05) — the returning-user surface.
 *
 * RETENTION DESIGN
 * ----------------
 * The longitudinal thesis lives or dies on repeat logging, and 60–80% of users
 * of self-monitoring tools disengage inside 30 days. Three choices target that:
 *
 *  · The Passport ID is displayed prominently and reads aloud cleanly (PE-XXXX,
 *    with no I/O/0/1). It makes the record feel like a possession rather than a
 *    form submission — and possessions get returned to.
 *  · Logging is one screen and one action, reachable from the top of the page.
 *    Anything more and the daily habit does not form.
 *  · The streak has a 48-hour grace window. Strict streaks punish one missed day
 *    and cause the user to quit entirely; a forgiving streak survives real life.
 *
 * The 14-day mean ± SD is shown because that is the figure a GP can act on. A
 * single latest reading is what paper diaries already provide, and it is exactly
 * why clinicians ignore them.
 */
export function PassportView() {
  const t = useTranslations("result");
  const tc = useTranslations("common");

  const [passport, setPassport] = useState<Passport | null>(null);
  const [logging, setLogging] = useState(false);
  const [ready, setReady] = useState(false);
  const [cloudState, setCloudState] = useState<"connected" | "offline" | "syncing" | "consent" | "paused">("syncing");
  const [syncError, setSyncError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let localPassport = readPassport();
      const draft = readDraft();
      const answers = draft?.answers as LifestyleAnswers | undefined;
      const complete = answers && (["sleep", "sodium", "stress", "stimulants", "activity"] as const)
        .every((key) => answers[key]);
      if (draft && complete && draft.completedAt) {
        if (localPassport) {
          const applied = applyCompletedAudit(localPassport, draft);
          localPassport = applied.passport;
        } else {
          localPassport = createPassport({
            answers,
            reading: draft.reading ?? null,
            campaign: draft.campaign,
            lastCheck: draft.lastCheck,
            auditId: draft.auditId,
            createdAt: draft.completedAt,
          });
        }
      }
      if (!cancelled) setPassport(localPassport);

      if (!isCloudPersistenceConfigured()) {
        if (!cancelled) {
          setCloudState("offline");
          setReady(true);
        }
        return;
      }

      try {
        const cloud = await fetchCloudPassport();
        if (cancelled) return;
        const session = await getSupabaseBrowserClient()?.auth.getSession();
        const activeCloudUserId = session?.data.session?.user.id;
        if (cloud) {
          // A different passport code may belong to another person who used
          // this browser. Never merge two identities merely because they share
          // a device; the signed-in cloud record wins in that case.
          const active = localPassport?.id === cloud.id
            ? mergePassports(cloud, localPassport)
            : cloud;
          savePassport(active);
          setPassport(active);

          const consents = await fetchConsents();
          const policyVersion = process.env.NEXT_PUBLIC_CONSENT_POLICY_VERSION || "v1";
          const storageConsent = consents.find(
            (record) => record.scope === "essential" && record.policy_version === policyVersion,
          );
          if (!storageConsent?.granted) {
            setCloudState("paused");
            return;
          }

          if (active.lastAuditId && active.lastAuditId !== cloud.lastAuditId) {
            await syncPassport(active);
          }
          await syncMissingReadings(active, cloud);
          const refreshed = await fetchCloudPassport();
          if (refreshed) {
            const merged = mergePassports(refreshed, active);
            setPassport(merged);
          }
          setCloudState("connected");
          return;
        }

        if (
          localPassport?.cloudOwnerId
          && activeCloudUserId
          && localPassport.cloudOwnerId !== activeCloudUserId
        ) {
          setPassport(null);
          setCloudState("connected");
          return;
        }

        if (localPassport) {
          setCloudState("consent");
        } else {
          setCloudState("connected");
        }
      } catch (caught) {
        if (localPassport) setPassport(localPassport);
        setSyncError(caught instanceof Error ? caught.message : "Cloud connection failed.");
        setCloudState("offline");
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const connectCloud = useCallback(async (recordStorageConsent = true) => {
    if (!passport) return;
    setCloudState("syncing");
    setSyncError("");
    try {
      if (passport.lastAuditId) await syncPassport(passport, recordStorageConsent);
      else if (recordStorageConsent) {
        await recordConsent("essential", true, document.documentElement.lang === "ur" ? "ur" : "en");
      }
      await syncMissingReadings(passport, null);
      const cloud = await fetchCloudPassport();
      if (cloud) setPassport(mergePassports(cloud, passport));
      setCloudState("connected");
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : "Cloud sync failed.");
      setCloudState("offline");
    }
  }, [passport]);

  const handleLog = (reading: BpReading | null) => {
    setLogging(false);
    if (!reading) return;
    const updated = appendReading({ ...reading, at: new Date().toISOString() });
    if (updated) {
      setPassport(updated);
      setSavedMessage("Today's reading is saved. You can stay here, return to care, or manage your account.");
      if (cloudState === "connected") {
        void syncReading(updated.readings[updated.readings.length - 1]!).catch((caught) => {
          setSyncError(caught instanceof Error ? caught.message : "Reading sync failed.");
          setCloudState("offline");
        });
      }
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-ink-400">…</p>
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <LogoMark size={56} className="mx-auto" decorative />
        <p className="mt-6 text-lg text-ink-600">{t("nextBody")}</p>
        <Link
          href="/audit"
          className="brand-gradient mt-6 inline-flex min-h-[3.5rem] items-center justify-center rounded-xl px-7 font-bold text-white"
        >
          {tc("start")}
        </Link>
      </div>
    );
  }

  const streak = currentStreak(passport.readings);
  const recent = passport.readings.slice(-14);
  const summary = summariseSeries(recent);

  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 pb-12">
      <nav className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm" aria-label="Passport navigation">
        <Link href="/care" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-cyan-700">← Patient dashboard</Link>
        <div className="flex flex-wrap gap-2"><Link href="/" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-ink-600">Home</Link><Link href="/account" className="inline-flex min-h-11 items-center rounded-xl border border-border-strong px-4 text-sm font-bold text-ink-700">Sign in / account</Link></div>
      </nav>
      {/* ── Passport card ─────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-ink-900 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-cyan-300 uppercase">
              BP Passport
            </p>
            <p className="numeric mt-1.5 text-2xl font-bold">{passport.id}</p>
          </div>
          <LogoMark size={44} decorative />
        </div>

        <div className="mt-6 flex items-center gap-5">
          <div>
            <p className="numeric text-3xl font-bold">{passport.readings.length}</p>
            <p className="mt-0.5 text-xs text-ink-300">readings</p>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
              <Flame size={18} className="text-[var(--color-coral-500)]" aria-hidden />
              <span className="numeric text-lg font-bold">{streak}</span>
              <span className="text-sm text-ink-200">day streak</span>
            </div>
          )}
        </div>
      </section>

      <p className="mt-3 text-center text-sm text-ink-500" role="status">
        {cloudStatus(cloudState)}
      </p>
      <Link href="/account" className="mt-2 block text-center text-sm font-semibold text-cyan-600">
        Sign in or manage account
      </Link>
      {savedMessage && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-900" role="status">{savedMessage}</div>}

      {(cloudState === "consent" || cloudState === "paused") && (
        <section className="card mt-5 p-6">
          <div className="flex gap-3">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-cyan-600" aria-hidden />
            <div>
              <h2 className="text-lg font-bold text-ink-900">Keep a secure cloud copy?</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                With your permission, BP Passport will store this passport and future readings in your protected account. You can pause future uploads at any time. Research and reminder consent remain separate and optional.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void connectCloud(true)} className="brand-gradient mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-5 font-bold text-white">
            <Cloud size={19} aria-hidden /> Enable secure backup
          </button>
        </section>
      )}

      {cloudState === "offline" && isCloudPersistenceConfigured() && (
        <button type="button" onClick={() => void connectCloud(true)} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-white px-4 text-sm font-bold text-ink-700">
          <RefreshCw size={17} aria-hidden /> Retry cloud sync
        </button>
      )}
      {syncError && <p className="mt-3 text-center text-xs text-[var(--color-risk-grade2-ink)]" role="alert">{syncError}</p>}

      {/* ── Log action, kept at the top where the habit forms ─────────── */}
      {!logging && (
        <Button
          size="lg"
          fullWidth
          className="mt-5"
          onClick={() => setLogging(true)}
        >
          <Plus size={20} aria-hidden />
          Log today&apos;s reading
        </Button>
      )}

      {logging && (
        <section className="card mt-5 p-6">
          <h2 className="text-lg font-bold text-ink-900">Today&apos;s reading</h2>
          <div className="mt-5">
            <BpEntry onSubmit={handleLog} />
          </div>
        </section>
      )}

      {/* ── The figure a clinician can act on ─────────────────────────── */}
      {summary && summary.count >= 2 && (
        <section className="card mt-5 p-6">
          <p className="text-sm font-bold text-ink-500">
            Your average over the last {summary.count} readings
          </p>
          <p className="numeric mt-2 text-4xl font-bold text-ink-900">
            {summary.meanSystolic}/{summary.meanDiastolic}
          </p>
          <p className="numeric mt-1 text-sm text-ink-400">
            ± {summary.sdSystolic}/{summary.sdDiastolic} mmHg
          </p>

          <div
            className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-bold"
            style={{
              background: CATEGORY_VISUAL[summary.category].surface,
              color: CATEGORY_VISUAL[summary.category].onSurface,
            }}
          >
            {t(`category.${summary.category}`)}
          </div>

          {summary.systolicTrend !== 0 && (
            <p className="mt-4 text-base text-ink-700">
              {summary.systolicTrend < 0
                ? `Down ${Math.abs(summary.systolicTrend)} mmHg since you started. Keep going.`
                : `Up ${summary.systolicTrend} mmHg. Worth showing a doctor.`}
            </p>
          )}
        </section>
      )}

      {summary && (
        <WhatsAppShareButton
          className="mt-4 w-full"
          report={`BP Passport · 14-day report\nPassport: ${passport.id}\nAverage: ${summary.meanSystolic}/${summary.meanDiastolic} mmHg\nReadings: ${summary.count}\nSystolic trend: ${summary.systolicTrend > 0 ? "+" : ""}${summary.systolicTrend} mmHg\n\nShared by the patient. This report is not a diagnosis.`}
        />
      )}

      {passport.readings.length === 1 && (
        <p className="mt-5 text-center text-base text-ink-500">
          Log again tomorrow. Two weeks of readings is what a doctor needs to act.
        </p>
      )}

      {passport.readings.length > 0 && (
        <section className="card mt-5 p-6">
          <h2 className="text-lg font-bold text-ink-900">Recent readings</h2>
          <ul className="mt-4 divide-y divide-border">
            {[...passport.readings].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10).map((reading) => (
              <li key={reading.clientId} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="numeric text-lg font-bold text-ink-900">{reading.systolic}/{reading.diastolic}</p>
                  <p className="mt-0.5 text-xs text-ink-500">{new Date(reading.at).toLocaleString()}</p>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{
                  background: CATEGORY_VISUAL[classify(reading)].surface,
                  color: CATEGORY_VISUAL[classify(reading)].onSurface,
                }}>
                  {t(`category.${classify(reading)}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SharePanel enabled={cloudState === "connected"} />
      <PrivacyControls
        enabled={cloudState === "connected"}
        onEssentialChange={(granted) => {
          if (granted) void connectCloud(false);
          else setCloudState("paused");
        }}
      />
    </div>
  );
}

function cloudStatus(state: "connected" | "offline" | "syncing" | "consent" | "paused") {
  if (state === "connected") return "Cloud backup connected";
  if (state === "syncing") return "Connecting to cloud backup…";
  if (state === "consent") return "Saved on this device · cloud backup needs permission";
  if (state === "paused") return "Cloud backup paused · saved on this device";
  return "Offline mode: saved on this device";
}

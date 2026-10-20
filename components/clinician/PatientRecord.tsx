"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";

import { Link } from "@/lib/i18n/navigation";
import { CATEGORY_VISUAL } from "@/lib/clinical/presentation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { openSharedPatient, type PatientSummary, type SharedReading } from "@/lib/supabase/clinician";

export function PatientRecord({ reference, locale }: { reference: string; locale: string }) {
  const [readings, setReadings] = useState<SharedReading[]>([]);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const client = getSupabaseBrowserClient();
      const session = await client?.auth.getSession();
      if (!session?.data.session || session.data.session.user.is_anonymous || !session.data.session.user.email_confirmed_at) {
        if (!cancelled) { setNeedsSignIn(true); setLoading(false); }
        return;
      }
      try {
        const data = await openSharedPatient(reference);
        if (cancelled) return;
        setReadings(data.readings ?? []);
        setSummary(data.summary);
        if (!/^[0-9a-f-]{36}$/i.test(reference)) {
          window.history.replaceState(null, "", `/${locale}/portal/${data.patientId}`);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to open this patient share.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [locale, reference]);

  if (loading) return <section className="card p-8 text-center text-ink-500">Opening the shared record…</section>;
  if (needsSignIn) return (
    <section className="card p-8 text-center">
      <h1 className="text-2xl font-bold text-ink-900">Sign in to open this share</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">Only the verified clinician named by the patient can use this link.</p>
      <Link href="/account" onClick={() => rememberReturnPath(`/${locale}/portal/${reference}`)} className="brand-gradient mt-6 inline-flex min-h-14 items-center rounded-xl px-6 font-bold text-white">Sign in</Link>
    </section>
  );
  if (error) return (
    <section className="card p-8 text-center">
      <AlertTriangle size={38} className="mx-auto text-[var(--color-risk-grade1)]" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-ink-900">Share unavailable</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">{error}</p>
      <Link href="/portal" className="mt-5 inline-flex min-h-12 items-center gap-2 font-bold text-cyan-600"><ArrowLeft size={17} aria-hidden /> Portal home</Link>
    </section>
  );

  return (
    <div>
      <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600"><ArrowLeft size={17} aria-hidden /> Shared patients</Link>
      <h1 className="mt-6 text-3xl font-bold text-ink-900">14-day BP record</h1>
      <p className="mt-2 text-sm text-ink-500">Read-only patient-authorised clinical view</p>

      {summary ? (
        <section className="card mt-5 p-6">
          <p className="text-sm font-bold text-ink-500">Mean ± sample SD ({summary.reading_count} readings)</p>
          <p className="numeric mt-2 text-4xl font-bold text-ink-900">{summary.mean_systolic}/{summary.mean_diastolic}</p>
          <p className="numeric mt-1 text-sm text-ink-400">± {summary.sd_systolic}/{summary.sd_diastolic} mmHg</p>
          <div className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-bold" style={{ background: CATEGORY_VISUAL[summary.mean_category].surface, color: CATEGORY_VISUAL[summary.mean_category].onSurface }}>
            {categoryLabel(summary.mean_category)}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Metric label="Highest systolic" value={`${summary.highest_systolic} mmHg`} />
            <Metric label="Morning mean" value={summary.morning_mean_systolic ? `${summary.morning_mean_systolic} mmHg` : "—"} />
            <Metric label="Evening mean" value={summary.evening_mean_systolic ? `${summary.evening_mean_systolic} mmHg` : "—"} />
            <Metric label="Medication adherence" value={summary.adherence_rate == null ? "Not reported" : `${Math.round(summary.adherence_rate * 100)}%`} />
          </dl>
          {summary.any_crisis && <p className="mt-5 flex gap-2 rounded-xl bg-[var(--color-risk-crisis-soft)] p-4 text-sm font-bold text-[var(--color-risk-crisis-ink)]"><AlertTriangle size={18} className="shrink-0" aria-hidden /> At least one crisis-threshold reading occurred in this window.</p>}
        </section>
      ) : <p className="card mt-5 p-6 text-ink-600">No readings were logged in the last 14 days.</p>}

      {readings.length > 0 && (
        <section className="card mt-5 overflow-hidden">
          <h2 className="p-6 pb-3 text-lg font-bold text-ink-900">Readings</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-start text-sm">
              <thead className="bg-ink-50 text-ink-500"><tr><th className="px-6 py-3 text-start">Date</th><th className="px-4 py-3 text-start">BP</th><th className="px-4 py-3 text-start">Range</th><th className="px-4 py-3 text-start">Time</th></tr></thead>
              <tbody className="divide-y divide-border">
                {readings.map((reading) => <tr key={`${reading.logged_at}-${reading.systolic}-${reading.diastolic}`}><td className="px-6 py-3 text-ink-600">{new Date(reading.logged_at).toLocaleString()}</td><td className="numeric px-4 py-3 font-bold text-ink-900">{reading.systolic}/{reading.diastolic}</td><td className="px-4 py-3 text-ink-700">{categoryLabel(reading.category)}</td><td className="px-4 py-3 capitalize text-ink-600">{reading.taken_at_time}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-5 flex gap-2 text-xs leading-relaxed text-ink-500"><ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />This screen supports clinical review; it does not diagnose or prescribe. Access is logged and controlled by the patient.</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-ink-500">{label}</dt><dd className="numeric mt-1 font-bold text-ink-900">{value}</dd></div>;
}

function categoryLabel(category: SharedReading["category"]) {
  return ({ optimal: "Optimal", normal: "Normal", high_normal: "High-normal", grade_1: "Grade 1", grade_2: "Grade 2" })[category];
}

function rememberReturnPath(path: string) {
  try { window.sessionStorage.setItem("bpp.auth.return.v1", path); } catch { /* storage may be blocked */ }
}

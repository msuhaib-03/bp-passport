"use client";

import { FormEvent, useState } from "react";
import { Check, Info, LockKeyhole, RefreshCw, ShieldCheck, X } from "lucide-react";

interface ReviewRow {
  id: string;
  name: string | null;
  pmdcNumber: string;
  clinicName: string;
  city: string;
  status: "pending" | "rejected";
  createdAt: string;
}

export function ClinicianReview() {
  const [token, setToken] = useState("");
  const [clinicians, setClinicians] = useState<ReviewRow[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function request<T>(options?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/api/v1/admin/clinicians`, {
      method: options?.method ?? "GET",
      headers: {
        "X-Admin-Token": token,
        ...(options?.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? "Admin request failed");
    return payload as T;
  }

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusyId("load");
    setError("");
    try {
      const data = await request<{ clinicians: ReviewRow[] }>();
      setClinicians(data.clinicians);
      setAuthenticated(true);
    } catch (caught) {
      setAuthenticated(false);
      setError(messageOf(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function review(clinicianId: string, status: "verified" | "rejected") {
    setBusyId(clinicianId);
    setError("");
    try {
      await request({ method: "POST", body: { clinicianId, status } });
      setClinicians((rows) => rows.filter((row) => row.id !== clinicianId));
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusyId(null);
    }
  }

  if (!authenticated) {
    return (
      <section className="card p-6">
        <ShieldCheck size={34} className="text-cyan-600" aria-hidden />
        <p className="mt-4 text-xs font-extrabold tracking-[.14em] text-cyan-700 uppercase">Programme staff workspace</p>
        <h1 className="mt-2 text-2xl font-bold text-ink-900">BP Passport administration</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          This is separate from patient and clinician accounts. It controls sensitive programme operations, so real data stays locked behind the server administrator token configured on Render.
        </p>
        <div className="mt-5 flex gap-3 rounded-xl bg-cyan-50 p-4 text-sm leading-6 text-ink-700"><Info size={19} className="mt-0.5 shrink-0 text-cyan-700" /><p>PMDC review is paused for pilot clinicians, but the queue is preserved for the future verified rollout. The token is used for this request only and is never stored in the browser.</p></div>
        <form onSubmit={load} className="mt-6">
          <label className="text-sm font-semibold text-ink-700">
            Administrator token
            <input required minLength={32} type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border border-border-strong px-4 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
          </label>
          <button disabled={busyId !== null} className="brand-gradient mt-4 min-h-14 w-full rounded-xl px-5 font-bold text-white disabled:opacity-60">
            <LockKeyhole size={17} className="me-2 inline" />{busyId ? "Checking…" : "Open live operations"}
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
        <div className="mt-7 border-t border-border pt-6">
          <p className="text-xs font-extrabold tracking-wide text-ink-400 uppercase">Sample queue preview</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-ink-50 p-4"><strong className="text-ink-900">Dr. Ayesha Khan</strong><p className="mt-1 text-xs text-ink-500">PILOT-DR-001 · Karachi Heart Clinic</p><span className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Pending</span></div>
            <div className="rounded-xl border border-border bg-ink-50 p-4"><strong className="text-ink-900">Dr. Hamza Ali</strong><p className="mt-1 text-xs text-ink-500">PMDC-45821 · City Medical Centre</p><span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Example approved</span></div>
          </div>
          <p className="mt-3 text-xs text-ink-400">Fictional data for demonstration. Buttons appear only after authorized access.</p>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Clinician review queue</h1>
          <p className="mt-1 text-sm text-ink-500">Cross-check the PMDC register before approving.</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="Refresh review queue" className="tap flex items-center justify-center rounded-xl border border-border-strong text-ink-600">
          <RefreshCw size={18} aria-hidden />
        </button>
      </div>

      {clinicians.length === 0 ? (
        <p className="card mt-5 p-6 text-center text-ink-600">No pending registrations.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {clinicians.map((clinician) => (
            <li key={clinician.id} className="card p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">{clinician.status}</p>
              <h2 className="mt-2 text-lg font-bold text-ink-900">{clinician.name ?? "Encrypted name unavailable"}</h2>
              <p className="mt-1 text-sm text-ink-600">PMDC {clinician.pmdcNumber}</p>
              <p className="mt-1 text-sm text-ink-600">{clinician.clinicName} · {clinician.city}</p>
              <p className="mt-2 text-xs text-ink-400">Submitted {new Date(clinician.createdAt).toLocaleString()}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busyId !== null} onClick={() => void review(clinician.id, "rejected")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border-strong font-bold text-ink-700 disabled:opacity-60">
                  <X size={17} aria-hidden /> Reject
                </button>
                <button type="button" disabled={busyId !== null} onClick={() => void review(clinician.id, "verified")} className="brand-gradient inline-flex min-h-12 items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-60">
                  <Check size={17} aria-hidden /> Approve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
    </div>
  );
}

function messageOf(value: unknown) {
  return value instanceof Error ? value.message : "Unable to review clinicians.";
}

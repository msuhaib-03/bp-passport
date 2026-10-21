"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, ShieldAlert, Stethoscope, UserRound } from "lucide-react";

import { ClinicianDemo } from "@/components/clinician/ClinicianDemo";
import { Link } from "@/lib/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchClinicianPatients,
  fetchClinicianProfile,
  registerClinician,
  type ClinicianProfile,
  type ClinicianShare,
} from "@/lib/supabase/clinician";

export function ClinicianPortal() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<ClinicianProfile | null>(null);
  const [patients, setPatients] = useState<ClinicianShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setSignedIn(false);
      setError("Cloud accounts are not configured on this deployment.");
      setLoading(false);
      return;
    }
    const session = await client.auth.getSession();
    const namedUser = Boolean(
      session.data.session
        && !session.data.session.user.is_anonymous
        && session.data.session.user.email_confirmed_at,
    );
    setSignedIn(namedUser);
    if (!namedUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextProfile = await fetchClinicianProfile();
      setProfile(nextProfile);
      if (nextProfile && (nextProfile.status === "verified" || nextProfile.status === "pending")) {
        setPatients(await fetchClinicianPatients());
      }
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const client = getSupabaseBrowserClient();
    if (!client) return () => window.clearTimeout(timer);
    const { data } = client.auth.onAuthStateChange(() => { void load(); });
    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [load]);

  if (demo) return <ClinicianDemo onExit={() => setDemo(false)} />;
  if (loading) return <PortalMessage>Loading clinician access…</PortalMessage>;

  if (!signedIn) {
    return (
      <PortalMessage>
        <Stethoscope size={42} className="mx-auto text-cyan-600" aria-hidden />
        <h1 className="mt-5 text-2xl font-bold text-ink-900">Clinician portal</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          Explore the clinician workspace with sample data now, or sign in to open patient-authorized records.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setDemo(true)} className="brand-gradient inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 font-bold text-white"><Eye size={18} />Open sample dashboard</button>
          <Link href="/account?next=portal" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-border-strong px-6 font-bold text-ink-700">Sign in for live shares</Link>
        </div>
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
      </PortalMessage>
    );
  }

  if (!profile) {
    return <ClinicianRegistration onRegistered={setProfile} onDemo={() => setDemo(true)} />;
  }

  if (profile.status === "rejected" || profile.status === "lapsed") {
    return (
      <PortalMessage>
        <ShieldAlert size={42} className="mx-auto text-[var(--color-risk-high-normal)]" aria-hidden />
        <h1 className="mt-5 text-2xl font-bold text-ink-900">Clinician access unavailable</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          This profile has been {profile.status}. Contact the BP Passport programme administrator if this needs correction.
        </p>
        <button type="button" onClick={() => setDemo(true)} className="brand-gradient mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-bold text-white"><Eye size={17} />Open sample dashboard</button>
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
      </PortalMessage>
    );
  }

  return (
    <div>
      <section className="rounded-2xl bg-ink-900 p-6 text-white">
        <p className="text-xs font-bold tracking-[0.12em] text-cyan-300 uppercase">{profile.status === "verified" ? "Verified clinician" : "Pilot clinician access"}</p>
        <h1 className="mt-2 text-2xl font-bold">{profile.name ?? "Clinician portal"}</h1>
        <p className="mt-2 text-sm text-ink-200">{profile.clinicName} · {profile.city}</p>
        <p className="mt-1 text-xs text-ink-300">Clinician ID {profile.pmdcNumber}</p>
      </section>

      <section className="card mt-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Shared patients</h2>
            <p className="mt-1 text-sm text-ink-500">Only active, patient-authorised shares appear here.</p>
          </div>
          <button type="button" onClick={() => void load()} aria-label="Refresh patients" className="tap flex items-center justify-center rounded-xl border border-border-strong text-ink-600">
            <RefreshCw size={18} aria-hidden />
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="mt-5 rounded-xl bg-ink-50 p-5 text-center">
            <UserRound size={30} className="mx-auto text-ink-400" aria-hidden />
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              No active shares yet. Ask the patient to enter your clinician ID on their Passport, or open the sample dashboard to see the full workflow.
            </p>
            <button type="button" onClick={() => setDemo(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-white px-4 text-sm font-bold text-cyan-700"><Eye size={17} />View sample dashboard</button>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {patients.map((share) => (
              <li key={share.share_id}>
                <Link href={`/portal/${share.patient_id}`} className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-border p-4 hover:border-cyan-500 hover:bg-cyan-100/40">
                  <div>
                    <p className="font-bold text-ink-900">{share.passport_code ?? "Patient passport"}</p>
                    <p className="mt-1 text-xs text-ink-500">Shared {new Date(share.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-semibold text-cyan-600">Open record</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
      </section>

      <p className="mt-5 flex gap-2 text-xs leading-relaxed text-ink-500">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
        Access is read-only, expires automatically, and is removed immediately when the patient revokes it.
      </p>
    </div>
  );
}

function ClinicianRegistration({ onRegistered, onDemo }: { onRegistered: (profile: ClinicianProfile) => void; onDemo: () => void }) {
  const [form, setForm] = useState({ name: "", pmdcNumber: "", clinicName: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { onRegistered(await registerClinician(form)); }
    catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  return (
    <section className="card p-6">
      <Stethoscope size={34} className="text-cyan-600" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-ink-900">Register as a clinician</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">
        PMDC verification is temporarily optional during the pilot. Use your PMDC number if available, or a clinic-issued pilot ID. Patient records remain read-only and appear only after the patient shares them.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field label="Full name" value={form.name} onChange={(name) => setForm({ ...form, name })} autoComplete="name" />
        <Field label="Clinician ID / PMDC number" value={form.pmdcNumber} onChange={(pmdcNumber) => setForm({ ...form, pmdcNumber })} placeholder="e.g. PILOT-DR-001" />
        <Field label="Clinic or hospital" value={form.clinicName} onChange={(clinicName) => setForm({ ...form, clinicName })} autoComplete="organization" />
        <Field label="City" value={form.city} onChange={(city) => setForm({ ...form, city })} autoComplete="address-level2" />
        <button disabled={busy} className="brand-gradient min-h-14 rounded-xl px-5 font-bold text-white disabled:opacity-60">
          {busy ? "Creating workspace…" : "Create pilot workspace"}
        </button>
        <button type="button" onClick={onDemo} className="min-h-14 rounded-xl border border-border-strong px-5 font-bold text-ink-700">Preview with sample data</button>
      </form>
      {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
    </section>
  );
}

function Field({ label, value, onChange, autoComplete, placeholder }: { label: string; value: string; onChange: (value: string) => void; autoComplete?: string; placeholder?: string }) {
  return (
    <label className="text-sm font-semibold text-ink-700">
      {label}
      <input required minLength={2} maxLength={160} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} className="mt-2 min-h-14 w-full rounded-xl border border-border-strong px-4 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
    </label>
  );
}

function PortalMessage({ children }: { children: React.ReactNode }) {
  return <section className="card p-8 text-center">{children}</section>;
}

function messageOf(value: unknown) {
  return value instanceof Error ? value.message : "Unable to load the clinician portal.";
}

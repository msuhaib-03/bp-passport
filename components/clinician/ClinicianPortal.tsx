"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Clock3, RefreshCw, ShieldAlert, Stethoscope, UserRound } from "lucide-react";

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
      if (nextProfile?.status === "verified") {
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

  if (loading) return <PortalMessage>Loading clinician access…</PortalMessage>;

  if (!signedIn) {
    return (
      <PortalMessage>
        <Stethoscope size={42} className="mx-auto text-cyan-600" aria-hidden />
        <h1 className="mt-5 text-2xl font-bold text-ink-900">Clinician portal</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          Sign in with a confirmed email account before registering your PMDC details or opening a patient share.
        </p>
        <Link href="/account" className="brand-gradient mt-6 inline-flex min-h-14 items-center justify-center rounded-xl px-6 font-bold text-white">
          Sign in or create an account
        </Link>
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
      </PortalMessage>
    );
  }

  if (!profile) {
    return <ClinicianRegistration onRegistered={setProfile} />;
  }

  if (profile.status !== "verified") {
    return (
      <PortalMessage>
        <Clock3 size={42} className="mx-auto text-[var(--color-risk-high-normal)]" aria-hidden />
        <h1 className="mt-5 text-2xl font-bold text-ink-900">Verification {profile.status}</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          {profile.status === "pending"
            ? `Your PMDC registration (${profile.pmdcNumber}) is awaiting manual verification. Patient records remain inaccessible until approval.`
            : "Your registration is not currently approved. Contact the BP Passport administrator before requesting patient access."}
        </p>
        <button type="button" onClick={() => void load()} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl border border-border-strong px-5 font-bold text-ink-700">
          <RefreshCw size={17} aria-hidden /> Check status
        </button>
        {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
      </PortalMessage>
    );
  }

  return (
    <div>
      <section className="rounded-2xl bg-ink-900 p-6 text-white">
        <p className="text-xs font-bold tracking-[0.12em] text-cyan-300 uppercase">Verified clinician</p>
        <h1 className="mt-2 text-2xl font-bold">{profile.name ?? "Clinician portal"}</h1>
        <p className="mt-2 text-sm text-ink-200">{profile.clinicName} · {profile.city}</p>
        <p className="mt-1 text-xs text-ink-300">PMDC {profile.pmdcNumber}</p>
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
              No active shares yet. Ask the patient to enter your PMDC number on their Passport and send you the secure link.
            </p>
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

function ClinicianRegistration({ onRegistered }: { onRegistered: (profile: ClinicianProfile) => void }) {
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
        Your name is encrypted before storage. PMDC verification is manual during the pilot and clinical records stay locked until approval.
      </p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field label="Full name" value={form.name} onChange={(name) => setForm({ ...form, name })} autoComplete="name" />
        <Field label="PMDC registration number" value={form.pmdcNumber} onChange={(pmdcNumber) => setForm({ ...form, pmdcNumber })} />
        <Field label="Clinic or hospital" value={form.clinicName} onChange={(clinicName) => setForm({ ...form, clinicName })} autoComplete="organization" />
        <Field label="City" value={form.city} onChange={(city) => setForm({ ...form, city })} autoComplete="address-level2" />
        <button disabled={busy} className="brand-gradient min-h-14 rounded-xl px-5 font-bold text-white disabled:opacity-60">
          {busy ? "Submitting…" : "Submit for verification"}
        </button>
      </form>
      {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
    </section>
  );
}

function Field({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  return (
    <label className="text-sm font-semibold text-ink-700">
      {label}
      <input required minLength={2} maxLength={160} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="mt-2 min-h-14 w-full rounded-xl border border-border-strong px-4 text-base outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" />
    </label>
  );
}

function PortalMessage({ children }: { children: React.ReactNode }) {
  return <section className="card p-8 text-center">{children}</section>;
}

function messageOf(value: unknown) {
  return value instanceof Error ? value.message : "Unable to load the clinician portal.";
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Check, Clipboard, Share2, Stethoscope, X } from "lucide-react";

import {
  createPatientShare,
  fetchPatientShares,
  revokePatientShare,
  type PatientShare,
} from "@/lib/supabase/patient";

export function SharePanel({ enabled }: { enabled: boolean }) {
  const locale = useLocale();
  const [pmdcNumber, setPmdcNumber] = useState("");
  const [shares, setShares] = useState<PatientShare[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [referenceTime, setReferenceTime] = useState(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      setShares(await fetchPatientShares());
      setReferenceTime(Date.now());
    }
    catch (caught) { setError(messageOf(caught)); }
  }, [enabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setShareUrl("");
    try {
      const created = await createPatientShare(pmdcNumber.trim());
      setShareUrl(`${window.location.origin}/${locale}/portal/${created.token}`);
      setPmdcNumber("");
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError("");
    try {
      await revokePatientShare(id);
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select and copy the link manually.");
    }
  }

  if (!enabled) return null;
  const activeShares = shares.filter(
    (share) => !share.revoked_at && new Date(share.expires_at).getTime() > referenceTime,
  );

  return (
    <section className="card mt-5 p-6">
      <div className="flex items-start gap-3">
        <Share2 className="mt-0.5 shrink-0 text-cyan-600" size={22} aria-hidden />
        <div>
          <h2 className="text-lg font-bold text-ink-900">Share with a clinician</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Enter the clinician&apos;s PMDC number. Links expire after 30 days and can be revoked instantly.
          </p>
        </div>
      </div>

      <form onSubmit={create} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1 text-sm font-semibold text-ink-700">
          PMDC registration number
          <input
            required
            minLength={4}
            maxLength={24}
            value={pmdcNumber}
            onChange={(event) => setPmdcNumber(event.target.value)}
            placeholder="e.g. 12345-P"
            className="mt-2 min-h-14 w-full rounded-xl border border-border-strong px-4 uppercase outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
        <button disabled={busy} className="brand-gradient min-h-14 self-end rounded-xl px-5 font-bold text-white disabled:opacity-60">
          Create link
        </button>
      </form>

      {shareUrl && (
        <div className="mt-5 rounded-xl bg-cyan-100 p-4">
          <p className="flex items-center gap-2 font-bold text-ink-900">
            <Stethoscope size={18} aria-hidden /> Secure link ready
          </p>
          <input readOnly value={shareUrl} className="numeric mt-3 w-full rounded-lg border border-cyan-300 bg-white px-3 py-2 text-xs text-ink-700" />
          <button type="button" onClick={copy} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink-900 px-4 text-sm font-bold text-white">
            {copied ? <Check size={17} aria-hidden /> : <Clipboard size={17} aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      {activeShares.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-ink-700">Active access</h3>
          <ul className="mt-3 space-y-3">
            {activeShares.map((share) => (
              <li key={share.share_id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-4">
                <div>
                  <p className="font-semibold text-ink-900">{share.clinic_name}</p>
                  <p className="mt-1 text-xs text-ink-500">PMDC {share.pmdc_number} · {share.city}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    Expires {new Date(share.expires_at).toLocaleDateString()} · opened {share.access_count} time{share.access_count === 1 ? "" : "s"}
                  </p>
                </div>
                <button type="button" disabled={busy} onClick={() => revoke(share.share_id)} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border-strong px-3 text-xs font-bold text-ink-700 disabled:opacity-60">
                  <X size={15} aria-hidden /> Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
    </section>
  );
}

function messageOf(value: unknown) {
  return value instanceof Error ? value.message : "Sharing request failed.";
}

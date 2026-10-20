"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Bell, Database, FlaskConical, ShieldCheck } from "lucide-react";

import {
  fetchConsents,
  recordConsent,
  type ConsentRecord,
  type ConsentScope,
} from "@/lib/supabase/patient";

export function PrivacyControls({
  enabled,
  onEssentialChange,
}: {
  enabled: boolean;
  onEssentialChange: (granted: boolean) => void;
}) {
  const locale = useLocale() === "ur" ? "ur" : "en";
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [busy, setBusy] = useState<ConsentScope | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchConsents()
      .then((data) => { if (!cancelled) setRecords(data); })
      .catch((caught) => { if (!cancelled) setError(messageOf(caught)); });
    return () => { cancelled = true; };
  }, [enabled]);

  const current = useMemo(() => {
    const values = new Map<ConsentScope, boolean>();
    const policyVersion = process.env.NEXT_PUBLIC_CONSENT_POLICY_VERSION || "v1";
    for (const record of records) {
      if (record.policy_version === policyVersion && !values.has(record.scope)) {
        values.set(record.scope, record.granted);
      }
    }
    return values;
  }, [records]);

  async function toggle(scope: ConsentScope, granted: boolean) {
    setBusy(scope);
    setError("");
    try {
      await recordConsent(scope, granted, locale);
      setRecords((existing) => [{
        id: crypto.randomUUID(),
        scope,
        granted,
        policy_version: process.env.NEXT_PUBLIC_CONSENT_POLICY_VERSION || "v1",
        locale,
        recorded_at: new Date().toISOString(),
      }, ...existing]);
      if (scope === "essential") onEssentialChange(granted);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!enabled) return null;

  return (
    <section className="card mt-5 p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-cyan-600" size={22} aria-hidden />
        <div>
          <h2 className="text-lg font-bold text-ink-900">Privacy and consent</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            Each choice is recorded separately. Research and reminders are always optional.
          </p>
        </div>
      </div>

      <div className="mt-5 divide-y divide-border rounded-xl border border-border">
        <ConsentToggle
          icon={Database}
          label="Secure cloud storage"
          description="Store this passport and future readings so you can recover them on another device."
          checked={current.get("essential") ?? true}
          disabled={busy !== null}
          onChange={(value) => toggle("essential", value)}
        />
        <ConsentToggle
          icon={FlaskConical}
          label="Anonymised research"
          description="Include de-identified, grouped data in approved population-health research."
          checked={current.get("research") ?? false}
          disabled={busy !== null}
          onChange={(value) => toggle("research", value)}
        />
        <ConsentToggle
          icon={Bell}
          label="Health reminders"
          description="Allow reminders when messaging support is introduced. No messages are sent yet."
          checked={current.get("reminders") ?? false}
          disabled={busy !== null}
          onChange={(value) => toggle("reminders", value)}
        />
      </div>
      {error && <p className="mt-4 text-sm text-[var(--color-risk-grade2-ink)]" role="alert">{error}</p>}
    </section>
  );
}

function ConsentToggle({ icon: Icon, label, description, checked, disabled, onChange }: {
  icon: typeof Database;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 p-4">
      <Icon size={19} className="mt-1 shrink-0 text-ink-500" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink-900">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-500">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-5 accent-cyan-600"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function messageOf(value: unknown) {
  return value instanceof Error ? value.message : "Unable to update consent.";
}
